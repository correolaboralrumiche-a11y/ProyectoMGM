export async function up(knex) {
  const hasDescription = await knex.schema.hasColumn('projects', 'description');
  if (!hasDescription) {
    await knex.schema.alterTable('projects', (table) => {
      table.text('description').notNullable().defaultTo('');
    });
  }

  const hasStatus = await knex.schema.hasColumn('projects', 'status');
  if (!hasStatus) {
    await knex.schema.alterTable('projects', (table) => {
      table.string('status', 50).notNullable().defaultTo('active');
    });
  }

  const hasUpdatedAt = await knex.schema.hasColumn('projects', 'updated_at');
  if (!hasUpdatedAt) {
    await knex.schema.alterTable('projects', (table) => {
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    });
  }

  const hasProjectBaselines = await knex.schema.hasTable('project_baselines');
  if (!hasProjectBaselines) {
    await knex.schema.createTable('project_baselines', (table) => {
      table
        .uuid('id')
        .primary()
        .defaultTo(knex.raw('gen_random_uuid()'));

      table
        .uuid('project_id')
        .notNullable()
        .references('id')
        .inTable('projects')
        .onDelete('CASCADE');

      table.string('name', 100).notNullable();
      table.text('description').notNullable().defaultTo('');
      table.string('project_name_snapshot', 255).notNullable();
      table.text('project_description_snapshot').notNullable().defaultTo('');
      table.timestamp('source_project_created_at', { useTz: true }).nullable();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.string('baseline_type', 50).notNullable().defaultTo('MANUAL');

      table.unique(['project_id', 'name']);
      table.index(['project_id']);
      table.index(['created_at']);
    });
  }

  const hasBaselineWbs = await knex.schema.hasTable('baseline_wbs');
  if (!hasBaselineWbs) {
    await knex.schema.createTable('baseline_wbs', (table) => {
      table
        .uuid('id')
        .primary()
        .defaultTo(knex.raw('gen_random_uuid()'));

      table
        .uuid('baseline_id')
        .notNullable()
        .references('id')
        .inTable('project_baselines')
        .onDelete('CASCADE');

      table.uuid('source_wbs_id').nullable();
      table
        .uuid('parent_id')
        .nullable()
        .references('id')
        .inTable('baseline_wbs')
        .onDelete('CASCADE');

      table.string('name', 255).notNullable();
      table.string('code', 100).notNullable();
      table.integer('sort_order').notNullable().defaultTo(0);

      table.index(['baseline_id']);
      table.index(['source_wbs_id']);
      table.index(['parent_id']);
      table.index(['baseline_id', 'code']);
    });
  }

  const hasBaselineActivities = await knex.schema.hasTable('baseline_activities');
  if (!hasBaselineActivities) {
    await knex.schema.createTable('baseline_activities', (table) => {
      table
        .uuid('id')
        .primary()
        .defaultTo(knex.raw('gen_random_uuid()'));

      table
        .uuid('baseline_id')
        .notNullable()
        .references('id')
        .inTable('project_baselines')
        .onDelete('CASCADE');

      table
        .uuid('baseline_wbs_id')
        .notNullable()
        .references('id')
        .inTable('baseline_wbs')
        .onDelete('CASCADE');

      table.uuid('source_activity_id').nullable();
      table.uuid('project_id').notNullable();
      table.string('activity_id', 100).notNullable();
      table.string('name', 255).notNullable();
      table.date('start_date').nullable();
      table.date('end_date').nullable();
      table.decimal('duration', 10, 2).notNullable().defaultTo(0);
      table.decimal('progress', 5, 2).notNullable().defaultTo(0);
      table.decimal('hours', 14, 2).notNullable().defaultTo(0);
      table.decimal('cost', 14, 2).notNullable().defaultTo(0);
      table.string('status', 50).notNullable().defaultTo('Not Started');
      table.integer('sort_order').notNullable().defaultTo(0);
      table.timestamp('source_created_at', { useTz: true }).nullable();
      table.timestamp('source_updated_at', { useTz: true }).nullable();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.index(['baseline_id']);
      table.index(['baseline_wbs_id']);
      table.index(['source_activity_id']);
      table.index(['project_id', 'activity_id']);
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('baseline_activities');
  await knex.schema.dropTableIfExists('baseline_wbs');
  await knex.schema.dropTableIfExists('project_baselines');

  const hasDescription = await knex.schema.hasColumn('projects', 'description');
  if (hasDescription) {
    await knex.schema.alterTable('projects', (table) => {
      table.dropColumn('description');
    });
  }
}
