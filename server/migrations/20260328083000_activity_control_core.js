export async function up(knex) {
  await knex.schema.createTable('activity_progress_updates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table
      .uuid('activity_id')
      .notNullable()
      .references('id')
      .inTable('activities')
      .onDelete('CASCADE');

    table
      .uuid('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');

    table.date('update_date').notNullable();
    table.decimal('progress_percent', 5, 2).notNullable().defaultTo(0);
    table.string('status_code', 50).notNullable();
    table.text('notes').nullable();
    table.string('source_type', 30).notNullable().defaultTo('manual');

    table
      .uuid('created_by')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['activity_id', 'update_date']);
    table.index(['project_id', 'update_date']);
    table.index(['created_by']);
  });

  await knex.raw(`
    ALTER TABLE activity_progress_updates
    ADD CONSTRAINT fk_activity_progress_updates_status_code
    FOREIGN KEY (status_code)
    REFERENCES activity_statuses(code)
  `);

  await knex.raw(`
    ALTER TABLE activity_progress_updates
    ADD CONSTRAINT chk_activity_progress_updates_progress
    CHECK (progress_percent >= 0 AND progress_percent <= 100)
  `);

  await knex.schema.createTable('activity_actuals', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));

    table
      .uuid('activity_id')
      .notNullable()
      .references('id')
      .inTable('activities')
      .onDelete('CASCADE');

    table
      .uuid('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');

    table.date('actual_date').notNullable();
    table.decimal('actual_hours', 14, 2).notNullable().defaultTo(0);
    table.decimal('actual_cost', 14, 2).notNullable().defaultTo(0);
    table.text('notes').nullable();
    table.string('source_type', 30).notNullable().defaultTo('manual');

    table
      .uuid('created_by')
      .nullable()
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');

    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.index(['activity_id', 'actual_date']);
    table.index(['project_id', 'actual_date']);
    table.index(['created_by']);
  });

  await knex.raw(`
    ALTER TABLE activity_actuals
    ADD CONSTRAINT chk_activity_actuals_hours
    CHECK (actual_hours >= 0)
  `);

  await knex.raw(`
    ALTER TABLE activity_actuals
    ADD CONSTRAINT chk_activity_actuals_cost
    CHECK (actual_cost >= 0)
  `);

  await knex.raw(`
    ALTER TABLE activity_actuals
    ADD CONSTRAINT chk_activity_actuals_nonzero
    CHECK (actual_hours > 0 OR actual_cost > 0)
  `);

  await knex.raw(`
    INSERT INTO activity_progress_updates (
      activity_id,
      project_id,
      update_date,
      progress_percent,
      status_code,
      notes,
      source_type,
      created_by,
      created_at
    )
    SELECT
      a.id,
      a.project_id,
      COALESCE(a.updated_at::date, CURRENT_DATE),
      COALESCE(a.progress_percent, 0),
      CASE
        WHEN LOWER(COALESCE(a.status, '')) IN ('not started', 'not_started') THEN 'not_started'
        WHEN LOWER(COALESCE(a.status, '')) IN ('in progress', 'in_progress') THEN 'in_progress'
        WHEN LOWER(COALESCE(a.status, '')) = 'completed' THEN 'completed'
        WHEN LOWER(COALESCE(a.status, '')) IN ('on hold', 'on_hold') THEN 'on_hold'
        ELSE 'not_started'
      END,
      CASE
        WHEN COALESCE(a.notes, '') = '' THEN 'Seed inicial desde resumen de actividad'
        ELSE CONCAT('Seed inicial: ', a.notes)
      END,
      'seed',
      a.updated_by,
      COALESCE(a.updated_at, NOW())
    FROM activities a
    WHERE NOT EXISTS (
      SELECT 1
      FROM activity_progress_updates apu
      WHERE apu.activity_id = a.id
    )
  `);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('activity_actuals');
  await knex.schema.dropTableIfExists('activity_progress_updates');
}
