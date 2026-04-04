/**
 * Sprint 18 — Fase 1: Modelo y permisos de Plantillas.
 *
 * Esta migración crea la base persistente para definir plantillas de layouts
 * dentro del módulo Control de Proyectos. No incluye todavía el motor de
 * render temporal ni las rutas; solo deja listo el modelo relacional.
 */

function createUuidPrimary(table, knex) {
  table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
}

function addAuditColumns(table, knex, options = {}) {
  const { withProject = false } = options;

  if (withProject) {
    table
      .uuid('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
  }

  table
    .uuid('created_by')
    .nullable()
    .references('id')
    .inTable('users')
    .onDelete('SET NULL');

  table
    .uuid('updated_by')
    .nullable()
    .references('id')
    .inTable('users')
    .onDelete('SET NULL');

  table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
}

export async function up(knex) {
  const hasTemplates = await knex.schema.hasTable('layout_templates');
  if (!hasTemplates) {
    await knex.schema.createTable('layout_templates', (table) => {
      createUuidPrimary(table, knex);
      addAuditColumns(table, knex, { withProject: true });

      table.string('name', 160).notNullable();
      table.string('base_level', 40).notNullable();
      table.string('time_metric', 80).notNullable();
      table.string('time_mode', 30).notNullable().defaultTo('cumulative');
      table.string('time_scale', 30).notNullable().defaultTo('weekly');
      table.boolean('is_active').notNullable().defaultTo(true);
      table.text('notes').nullable();

      table.unique(['project_id', 'name']);
      table.index(['project_id'], 'idx_layout_templates_project');
      table.index(['project_id', 'is_active'], 'idx_layout_templates_project_active');
    });
  } else {
    const templateColumns = [
      ['project_id', (table) => table.uuid('project_id').nullable()],
      ['name', (table) => table.string('name', 160)],
      ['base_level', (table) => table.string('base_level', 40)],
      ['time_metric', (table) => table.string('time_metric', 80)],
      ['time_mode', (table) => table.string('time_mode', 30).notNullable().defaultTo('cumulative')],
      ['time_scale', (table) => table.string('time_scale', 30).notNullable().defaultTo('weekly')],
      ['is_active', (table) => table.boolean('is_active').notNullable().defaultTo(true)],
      ['notes', (table) => table.text('notes').nullable()],
      ['created_by', (table) => table.uuid('created_by').nullable()],
      ['updated_by', (table) => table.uuid('updated_by').nullable()],
      ['created_at', (table) => table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())],
      ['updated_at', (table) => table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())],
    ];

    for (const [columnName, addColumn] of templateColumns) {
      const hasColumn = await knex.schema.hasColumn('layout_templates', columnName);
      if (!hasColumn) {
        await knex.schema.alterTable('layout_templates', (table) => addColumn(table));
      }
    }

    if (!(await knex.schema.hasColumn('layout_templates', 'project_id'))) {
      // guarded above, kept for readability
    }
  }

  const hasColumnsTable = await knex.schema.hasTable('layout_template_columns');
  if (!hasColumnsTable) {
    await knex.schema.createTable('layout_template_columns', (table) => {
      createUuidPrimary(table, knex);

      table
        .uuid('template_id')
        .notNullable()
        .references('id')
        .inTable('layout_templates')
        .onDelete('CASCADE');

      table.string('column_key', 100).notNullable();
      table.integer('display_order').notNullable().defaultTo(0);
      table.boolean('is_visible').notNullable().defaultTo(true);
      table.boolean('is_frozen').notNullable().defaultTo(false);
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

      table.unique(['template_id', 'column_key']);
      table.index(['template_id', 'display_order'], 'idx_layout_template_columns_order');
    });
  } else {
    const columnTableColumns = [
      ['column_key', (table) => table.string('column_key', 100)],
      ['display_order', (table) => table.integer('display_order').notNullable().defaultTo(0)],
      ['is_visible', (table) => table.boolean('is_visible').notNullable().defaultTo(true)],
      ['is_frozen', (table) => table.boolean('is_frozen').notNullable().defaultTo(false)],
      ['created_at', (table) => table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())],
      ['updated_at', (table) => table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())],
    ];

    for (const [columnName, addColumn] of columnTableColumns) {
      const hasColumn = await knex.schema.hasColumn('layout_template_columns', columnName);
      if (!hasColumn) {
        await knex.schema.alterTable('layout_template_columns', (table) => addColumn(table));
      }
    }
  }

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'layout_templates_project_id_fkey'
      ) THEN
        ALTER TABLE layout_templates
        ADD CONSTRAINT layout_templates_project_id_fkey
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
      END IF;
    END
    $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'layout_templates_created_by_fkey'
      ) THEN
        ALTER TABLE layout_templates
        ADD CONSTRAINT layout_templates_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'layout_templates_updated_by_fkey'
      ) THEN
        ALTER TABLE layout_templates
        ADD CONSTRAINT layout_templates_updated_by_fkey
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_layout_templates_project
      ON layout_templates (project_id);
    CREATE INDEX IF NOT EXISTS idx_layout_templates_project_active
      ON layout_templates (project_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_layout_template_columns_order
      ON layout_template_columns (template_id, display_order);
  `);
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('layout_template_columns');
  await knex.schema.dropTableIfExists('layout_templates');
}
