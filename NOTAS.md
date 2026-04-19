Sprint 23 — Hardening UX, permisos finos y cierre de release de Plantillas

Archivos para reemplazar:
- client/src/App.jsx
- client/src/hooks/useLayoutTemplates.js
- client/src/pages/TemplatesPage.jsx
- client/src/components/templates/TemplateViewer.jsx
- client/src/components/templates/TimeGrid.jsx
- README.md
- RELEASE_NOTES.md
- NOTAS.md
- INSTRUCCIONES.txt

Notas:
- No requiere migraciones nuevas.
- No agrega rutas nuevas ni cambia nombres existentes.
- Mantiene funcionalidad de Sprint 19–22 y solo endurece UX, persistencia y documentación.
- La pestaña Plantillas queda visible solo para usuarios con `layout_templates.read`.
- La distribución temporal sigue en consulta cuando el proyecto no está Activo, pero el resto del ERP no entra en modo lectura global.
