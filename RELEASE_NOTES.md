# Release Notes — Consolidación ERP (Sprint 17)

## Resumen

Esta release consolida la fase actual del proyecto antes de entrar al bloque funcional de **Plantillas / layouts time-phased**.

El sistema queda estabilizado en torno a dos módulos:
- **Control de Proyectos**
- **Control Documentario**

## Lo consolidado en esta fase

### Control de Proyectos
- proyectos con prioridad y moneda
- WBS jerárquico
- actividades con catálogos, control operativo y persistencia de columnas
- baseline funcional por proyecto
- EV básico por actividad calculado contra presupuesto base
- períodos financieros definidos por proyecto
- snapshot financiero desde Actividades

### Control Documentario
- registro maestro de entregables
- revisiones y respuestas
- estado documental actual derivado de la última revisión

### Base técnica
- seguridad ERP con roles y permisos
- auditoría y trazabilidad
- verificación de plataforma
- pruebas de integración del dominio
- mejor organización de capas en frontend y en servicios clave

## Objetivo de la consolidación

Dejar el repo y la operación local listos para crecer sobre una base más estable, antes de introducir:
- plantillas time-phased
- distribución temporal de HH y presupuesto LB
- analítica EV más profunda
- dashboards

## Limitaciones actuales

- EV básico, sin CPI/SPI/ETC/EAC
- sin plantillas configurables
- sin control documental de adjuntos ni workflow completo
- sin distribución temporal calculada de HH y presupuesto LB

## Siguiente bloque sugerido

### Sprint 18
- Plantillas / layouts time-phased
- métrica temporal configurable
- modos acumulado y parcial
- vistas semanales y mensuales
