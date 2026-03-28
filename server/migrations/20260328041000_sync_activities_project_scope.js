export async function up(knex) {
  await knex.raw(`
    UPDATE activities AS a
    SET project_id = w.project_id
    FROM wbs_nodes AS w
    WHERE w.id = a.wbs_id
      AND a.project_id IS DISTINCT FROM w.project_id
  `);
}

export async function down() {
  // No-op: this migration only repairs data consistency.
}
