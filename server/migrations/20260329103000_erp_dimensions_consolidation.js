async function createStandardCatalogTable(knex, tableName) {
  const exists = await knex.schema.hasTable(tableName);
  if (exists) return;

  await knex.schema.createTable(tableName, (table) => {
    table.string('code', 50).primary();
    table.string('name', 120).notNullable();
    table.text('description').notNullable().defaultTo('');
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.uuid('updated_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

async function seedCatalog(knex, table, rows, actorId) {
  for (const row of rows) {
    await knex(table)
      .insert({
        ...row,
        created_by: actorId,
        updated_by: actorId,
      })
      .onConflict('code')
      .merge({
        name: row.name,
        description: row.description,
        is_active: row.is_active,
        sort_order: row.sort_order,
        updated_by: actorId,
        updated_at: knex.fn.now(),
      });
  }
}

export async function up(knex) {
  await createStandardCatalogTable(knex, 'project_priorities');
  await createStandardCatalogTable(knex, 'currencies');
  await createStandardCatalogTable(knex, 'disciplines');

  const adminUser = await knex('users').select('id').whereRaw('LOWER(username) = LOWER(?)', ['admin']).first();
  const actorId = adminUser?.id || null;

  await seedCatalog(
    knex,
    'project_priorities',
    [
      { code: 'low', name: 'Low', description: 'Proyecto de prioridad baja', is_active: true, sort_order: 10 },
      { code: 'medium', name: 'Medium', description: 'Proyecto de prioridad media', is_active: true, sort_order: 20 },
      { code: 'high', name: 'High', description: 'Proyecto de prioridad alta', is_active: true, sort_order: 30 },
      { code: 'critical', name: 'Critical', description: 'Proyecto de prioridad crítica', is_active: true, sort_order: 40 },
    ],
    actorId
  );

  await seedCatalog(
    knex,
    'currencies',
    [
      { code: 'USD', name: 'US Dollar', description: 'Dólar estadounidense', is_active: true, sort_order: 10 },
      { code: 'PEN', name: 'Peruvian Sol', description: 'Sol peruano', is_active: true, sort_order: 20 },
      { code: 'EUR', name: 'Euro', description: 'Euro', is_active: true, sort_order: 30 },
    ],
    actorId
  );

  await seedCatalog(
    knex,
    'disciplines',
    [
      { code: 'general', name: 'General', description: 'Disciplina no clasificada', is_active: true, sort_order: 10 },
      { code: 'civil', name: 'Civil', description: 'Ingeniería civil', is_active: true, sort_order: 20 },
      { code: 'structural', name: 'Structural', description: 'Ingeniería estructural', is_active: true, sort_order: 30 },
      { code: 'mechanical', name: 'Mechanical', description: 'Ingeniería mecánica', is_active: true, sort_order: 40 },
      { code: 'electrical', name: 'Electrical', description: 'Ingeniería eléctrica', is_active: true, sort_order: 50 },
      { code: 'instrumentation', name: 'Instrumentation', description: 'Instrumentación y control', is_active: true, sort_order: 60 },
      { code: 'process', name: 'Process', description: 'Ingeniería de procesos', is_active: true, sort_order: 70 },
      { code: 'piping', name: 'Piping', description: 'Tuberías', is_active: true, sort_order: 80 },
    ],
    actorId
  );

  if (!(await knex.schema.hasColumn('projects', 'priority_code'))) {
    await knex.schema.alterTable('projects', (table) => {
      table.string('priority_code', 50).notNullable().defaultTo('medium');
    });
  }

  if (!(await knex.schema.hasColumn('projects', 'currency_code'))) {
    await knex.schema.alterTable('projects', (table) => {
      table.string('currency_code', 50).notNullable().defaultTo('USD');
    });
  }

  if (!(await knex.schema.hasColumn('activities', 'discipline_code'))) {
    await knex.schema.alterTable('activities', (table) => {
      table.string('discipline_code', 50).notNullable().defaultTo('general');
    });
  }

  await knex.raw(`
    UPDATE projects
    SET
      priority_code = COALESCE(NULLIF(BTRIM(priority_code), ''), 'medium'),
      currency_code = UPPER(COALESCE(NULLIF(BTRIM(currency_code), ''), 'USD'))
  `);

  await knex.raw(`
    UPDATE activities
    SET discipline_code = COALESCE(NULLIF(BTRIM(discipline_code), ''), 'general')
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_projects_priority_catalog'
      ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT fk_projects_priority_catalog
        FOREIGN KEY (priority_code) REFERENCES project_priorities(code);
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_projects_currency_catalog'
      ) THEN
        ALTER TABLE projects
        ADD CONSTRAINT fk_projects_currency_catalog
        FOREIGN KEY (currency_code) REFERENCES currencies(code);
      END IF;
    END $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_activities_discipline_catalog'
      ) THEN
        ALTER TABLE activities
        ADD CONSTRAINT fk_activities_discipline_catalog
        FOREIGN KEY (discipline_code) REFERENCES disciplines(code);
      END IF;
    END $$;
  `);

  await knex.raw('CREATE INDEX IF NOT EXISTS idx_projects_priority_code ON projects(priority_code)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_projects_currency_code ON projects(currency_code)');
  await knex.raw('CREATE INDEX IF NOT EXISTS idx_activities_discipline_code ON activities(discipline_code)');
}

export async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_activities_discipline_code');
  await knex.raw('DROP INDEX IF EXISTS idx_projects_currency_code');
  await knex.raw('DROP INDEX IF EXISTS idx_projects_priority_code');

  await knex.raw('ALTER TABLE activities DROP CONSTRAINT IF EXISTS fk_activities_discipline_catalog');
  await knex.raw('ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_projects_currency_catalog');
  await knex.raw('ALTER TABLE projects DROP CONSTRAINT IF EXISTS fk_projects_priority_catalog');

  if (await knex.schema.hasColumn('activities', 'discipline_code')) {
    await knex.schema.alterTable('activities', (table) => {
      table.dropColumn('discipline_code');
    });
  }

  if (await knex.schema.hasColumn('projects', 'currency_code')) {
    await knex.schema.alterTable('projects', (table) => {
      table.dropColumn('currency_code');
    });
  }

  if (await knex.schema.hasColumn('projects', 'priority_code')) {
    await knex.schema.alterTable('projects', (table) => {
      table.dropColumn('priority_code');
    });
  }

  await knex.schema.dropTableIfExists('disciplines');
  await knex.schema.dropTableIfExists('currencies');
  await knex.schema.dropTableIfExists('project_priorities');
}
