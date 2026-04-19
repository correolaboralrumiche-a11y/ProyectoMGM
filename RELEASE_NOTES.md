# Release Notes — Hardening ERP transversal (Sprint 24)

## Resumen

Esta release consolida la plataforma completa después del cierre funcional del módulo de **Plantillas**.

El foco del Sprint 24 es transversal:
- alinear contratos entre `App.jsx` y las páginas de dominio
- normalizar permisos entre frontend y backend
- endurecer la navegación por módulos
- reducir riesgo de regresiones por props inconsistentes

## Lo consolidado en esta fase

### Shell y navegación ERP
- visibilidad de pestañas alineada con permisos reales
- pestaña **Plantillas** visible únicamente con `layout_templates.read`
- navegación de módulos más consistente entre Control de Proyectos y Control Documentario

### Contratos entre capas
- `App.jsx` vuelve a pasar props coherentes a Proyectos, WBS, Actividades, Períodos y Deliverables
- compatibilidad defensiva en páginas clave para aceptar tanto contratos directos como contratos legacy
- alias funcional para permisos documentarios tipo `deliverables.write` en frontend

### Robustez del ERP
- WBS y Actividades aceptan handlers de recarga legacy sin romper la operación
- Períodos Financieros y Deliverables aceptan flags directos o permisos compuestos
- Plantillas deja de depender del lock operativo global para su configuración

### Calidad de plataforma
- suite backend estabilizada con pruebas verdes
- release enfocada en coherencia de plataforma, no en features nuevas

## Alcance resultante

El sistema queda con una base más sólida para la siguiente fase funcional, evitando que el crecimiento del ERP dependa de acoplamientos frágiles en el shell principal.

## Siguiente bloque sugerido

### Sprint 25
- ETC / EAC y forecasting operativo
- consolidación de lógica analítica en backend
- preparación para reporting ejecutivo y exportación
