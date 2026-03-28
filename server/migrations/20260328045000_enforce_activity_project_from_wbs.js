export async function up(knex) {
  await knex.raw(`
    UPDATE activities a
    SET project_id = w.project_id,
        updated_at = NOW()
    FROM wbs_nodes w
    WHERE w.id = a.wbs_id
      AND a.project_id IS DISTINCT FROM w.project_id
  `);

  await knex.raw(`
    CREATE OR REPLACE FUNCTION sync_activity_project_from_wbs()
    RETURNS TRIGGER AS $$
    BEGIN
      SELECT project_id INTO NEW.project_id
      FROM wbs_nodes
      WHERE id = NEW.wbs_id;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await knex.raw(`DROP TRIGGER IF EXISTS trg_sync_activity_project_from_wbs ON activities`);

  await knex.raw(`
    CREATE TRIGGER trg_sync_activity_project_from_wbs
    BEFORE INSERT OR UPDATE OF wbs_id, project_id ON activities
    FOR EACH ROW
    EXECUTE FUNCTION sync_activity_project_from_wbs();
  `);
}

export async function down(knex) {
  await knex.raw(`DROP TRIGGER IF EXISTS trg_sync_activity_project_from_wbs ON activities`);
  await knex.raw(`DROP FUNCTION IF EXISTS sync_activity_project_from_wbs()`);
}
