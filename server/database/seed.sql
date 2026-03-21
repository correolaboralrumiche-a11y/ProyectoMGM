INSERT INTO projects (id, name, description)
VALUES
('proj-demo-001', 'Proyecto Demo', 'Proyecto inicial para validar la primera versión');

INSERT INTO wbs (id, project_id, parent_id, name, code, sort_order)
VALUES
('wbs-demo-001', 'proj-demo-001', NULL, 'Ingeniería', '1', 1),
('wbs-demo-002', 'proj-demo-001', 'wbs-demo-001', 'Civil', '1.1', 1),
('wbs-demo-003', 'proj-demo-001', 'wbs-demo-001', 'Mecánica', '1.2', 2),
('wbs-demo-004', 'proj-demo-001', NULL, 'Procura', '2', 2);

INSERT INTO activities (
  id, wbs_id, name, start_date, end_date, duration, progress, hours, cost, status, sort_order
) VALUES
('act-demo-001', 'wbs-demo-002', 'Emitir planos de cimentación', '2026-03-02', '2026-03-10', 8, 35, 120, 3500, 'In Progress', 1),
('act-demo-002', 'wbs-demo-002', 'Revisión interdisciplinaria', '2026-03-12', '2026-03-15', 3, 0, 40, 950, 'Not Started', 2),
('act-demo-003', 'wbs-demo-003', 'Modelado de fajas', '2026-03-05', '2026-03-20', 15, 60, 180, 7200, 'In Progress', 1);
