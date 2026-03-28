export async function up(knex) {
  await knex.raw(`
    WITH ordered AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY project_id, COALESCE(parent_id::text, '__root__')
          ORDER BY sort_order ASC, LOWER(name) ASC, id ASC
        ) AS next_sort_order
      FROM wbs_nodes
    )
    UPDATE wbs_nodes AS target
    SET sort_order = ordered.next_sort_order
    FROM ordered
    WHERE target.id = ordered.id
  `);

  await knex.raw(`
    WITH ordered AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY wbs_id
          ORDER BY sort_order ASC, LOWER(activity_id) ASC, LOWER(name) ASC, id ASC
        ) AS next_sort_order
      FROM activities
    )
    UPDATE activities AS target
    SET sort_order = ordered.next_sort_order
    FROM ordered
    WHERE target.id = ordered.id
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_wbs_nodes_root_sort_order
    ON wbs_nodes (project_id, sort_order)
    WHERE parent_id IS NULL
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_wbs_nodes_child_sort_order
    ON wbs_nodes (project_id, parent_id, sort_order)
    WHERE parent_id IS NOT NULL
  `);

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_activities_wbs_sort_order
    ON activities (wbs_id, sort_order)
  `);
}

export async function down(knex) {
  await knex.raw('DROP INDEX IF EXISTS ux_activities_wbs_sort_order');
  await knex.raw('DROP INDEX IF EXISTS ux_wbs_nodes_child_sort_order');
  await knex.raw('DROP INDEX IF EXISTS ux_wbs_nodes_root_sort_order');
}
