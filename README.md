# ProyectoMGM

ERP web ligero para **Control de Proyectos** y **Control Documentario**, inspirado en prácticas de Primavera P6 y en flujos de seguimiento documental de ingeniería.

La solución está orientada a:
- estructuración jerárquica WBS
- control de actividades
- baseline y valor ganado básico
- períodos financieros y snapshots
- seguimiento documentario de entregables
- seguridad, auditoría y gobierno del dato

---

## Estado actual

La base vigente del proyecto opera sobre:

- **PostgreSQL**
- **Migraciones con Knex**
- **Seguridad ERP con login, roles y permisos**
- **Auditoría y trazabilidad**
- **Catálogos maestros**
- **Baseline y EV básico por actividad**
- **Períodos financieros definidos por proyecto**
- **Registro y seguimiento documentario**
- **Seeds, healthchecks, verificación de plataforma y pruebas base**
- **Pruebas de integración del dominio**

---

## Enfoque funcional actual

La aplicación quedó organizada en **dos módulos principales** desde la pantalla inicial:

1. **Módulo 1 — Control de Proyectos**
2. **Módulo 2 — Control Documentario**

Esto evita mezclar navegación operativa y permite mantener separados los flujos de control de proyecto y de seguimiento documental.

---

## Alcance funcional actual

### Módulo 1 — Control de Proyectos

#### Proyectos
- Crear, editar y eliminar proyectos.
- Gestión de proyecto activo.
- Estado del proyecto normalizado por catálogo.
- Prioridad y moneda por proyecto.
- Restricciones operativas por permisos y estado del proyecto.

#### WBS jerárquico
- Creación de nodos padre e hijo.
- Reordenamiento de nodos.
- Recálculo automático de códigos WBS.
- Consistencia estructural y validaciones jerárquicas.
- Control de acceso por permisos finos.

#### Actividades
- Alta, edición y eliminación de actividades por nodo WBS.
- Validación de fechas.
- Reordenamiento con `sort_order` consistente.
- Visualización integrada dentro del contexto WBS.
- Soporte para catálogos de actividad, estado, prioridad y disciplina.
- Persistencia de visibilidad de columnas en la grilla.

#### Control operativo por actividad
- Presupuesto de horas hombre y costo por actividad.
- Registro de avance acumulado por actividad.
- Historial operativo de avance.
- Registro de actuals básicos.
- Resumen operativo con presupuesto, real y saldo.
- Fecha de última actualización operativa.

#### Baseline
- Generación de líneas base del proyecto.
- Snapshot de WBS y actividades.
- Presupuesto base de horas y costo por actividad.
- Base lista para comparación y control de variaciones.

#### Valor Ganado básico (EV)
- Cálculo de **EV monetario** por actividad.
- Fórmula base: **EV = % avance acumulado × presupuesto costo de línea base**.
- El EV se calcula contra la línea base, no contra el presupuesto operativo actual.
- El EV queda disponible para snapshot financiero y análisis posterior.

#### Períodos financieros
- Definición previa de períodos financieros por proyecto.
- Soporte para fechas de corte semanales u otra periodicidad definida por el usuario.
- Selección del período financiero desde la pestaña **Actividades**.
- Guardado de snapshot financiero desde **Actividades**.
- Snapshot asociado a un período financiero definido y con fecha de snapshot.
- Base temporal para análisis acumulado y parcial en futuros layouts o plantillas.

### Módulo 2 — Control Documentario

#### Registro maestro de entregables
- Alta y edición de entregables documentarios.
- Código documental único por entregable.
- Asociación con proyecto, WBS y actividad cuando corresponde.

#### Seguimiento documentario
- Tipo de entregable.
- Estado documentario.
- Disciplina y prioridad.
- Fechas planificadas, forecast y reales.
- Responsable y observaciones operativas.

#### Revisiones y respuestas
- Registro de revisiones por entregable.
- Control de emisión y respuesta.
- Datos de transmittal y respuesta documental.
- Códigos de respuesta documental.
- Actualización del estado documental actual con base en la última revisión.

> Alcance actual del módulo 2: **seguimiento y registro de data documentaria**.
> No está orientado todavía a gestión de archivos adjuntos ni a workflow documental completo.

---

## Funcionalidades transversales

### Seguridad ERP
- Login de usuarios.
- Roles y permisos.
- Protección de rutas y acceso por sesión.
- Permisos finos por módulo y acción.
- Usuarios base reproducibles por seed.

### Auditoría y trazabilidad
- Registro de eventos relevantes del sistema.
- Trazabilidad de login, logout y operaciones principales.
- Metadata de creación y actualización.
- Endpoint y vista de auditoría para perfiles autorizados.
- `request_id` para soporte técnico y depuración.

### Catálogos maestros
- Administración de valores normalizados.
- Base para listas controladas tipo ERP.
- Soporte para estados, prioridades, disciplinas, monedas y otros valores controlados.

### Calidad de plataforma
- Seeds reproducibles.
- Healthchecks.
- Verificación de plataforma.
- Pruebas base automatizadas.
- Pruebas de integración del dominio para baseline, actividades, períodos financieros y deliverables.
- Scripts base de respaldo y restauración.
- Manejo más claro de errores técnicos en frontend/backend.

---

## Arquitectura

### Frontend
- React
- Vite
- TailwindCSS

### Backend
- Node.js
- Express
- Arquitectura modular por dominio

### Base de datos
- PostgreSQL
- Knex para migraciones

---

## Evolución del proyecto

La primera versión pública del repositorio partió como una aplicación funcional inicial con:
- React + Vite + TailwindCSS
- Node.js + Express
- SQLite
- CRUD de proyectos
- WBS jerárquico
- Actividades por WBS

Desde esa base, el proyecto evolucionó hacia una estructura más cercana a un ERP vertical para control de proyectos y seguimiento documentario.

---

## Sprints aplicados en la versión actual

### Sprint 1 — Hardening técnico
- Consistencia de `sort_order` en WBS y actividades.
- Validaciones técnicas más estrictas.
- Operaciones críticas más robustas.

### Sprint 2 — Seguridad ERP
- Usuarios.
- Login.
- Roles.
- Permisos.
- Protección básica de acceso.

### Sprint 3 — Auditoría, trazabilidad y gobierno del dato
- Tabla de auditoría.
- Registro de eventos clave.
- Metadata de usuario creador/modificador.

### Sprint 4 — Catálogos maestros y normalización del dato
- Catálogos administrables.
- Normalización de estados.
- Base para reglas de negocio futuras.

### Sprint 5 — Estabilización funcional y UX operativa
- Mejoras de estabilidad en frontend.
- Recargas más consistentes entre pestañas.
- Manejo homogéneo de errores.

### Sprint 6 — Permisos finos y control operativo
- Permisos por módulo y acción.
- Restricciones operativas más específicas.
- Ocultamiento o bloqueo de acciones según perfil.

### Sprint 7 — Calidad de plataforma y confiabilidad
- Seeds reproducibles.
- Validación de plataforma.
- Healthchecks.
- Logging técnico base.
- Pruebas automatizadas iniciales.

### Sprint 8 — Presupuesto, avance y actuals básicos por actividad
- Historial operativo de avance.
- Historial de actuals básicos.
- Resumen presupuesto vs real por actividad.
- Panel operativo en actividades.
- Corrección de manejo de fechas en control operativo.

### Sprint 9 — Refactor frontend
- Reorganización del frontend para bajar deuda técnica.
- Mejor separación entre páginas, hooks, servicios y utilitarios.
- Mejor base para crecer por módulos.

### Sprint 10 — Consolidación del modelo ERP
- Aprovechamiento del catálogo existente.
- Nuevas dimensiones maestras para proyecto y actividades.
- Mejor conexión entre frontend, backend y catálogos.

### Sprint 11 — Separación por módulos y control documentario
- Pantalla inicial de selección de módulo.
- **Módulo 1: Control de Proyectos**.
- **Módulo 2: Control Documentario**.
- Registro maestro de entregables y revisiones documentarias.

### Sprint 12 — Períodos financieros, baseline y EV
- Renombre funcional de Corte a **Período Financiero**.
- Definición previa de períodos financieros por proyecto.
- Snapshot financiero asociado a período definido.
- Corrección de generación de baseline.
- Cálculo de EV contra presupuesto base.
- Guardado de snapshot financiero desde la pestaña Actividades.
- Persistencia de configuración visible de columnas en Actividades.

### Sprint 13 — Consolidación del flujo baseline → EV → Período Financiero
- Ajustes para enriquecer snapshots con baseline y EV calculado.
- Mejor consolidación del flujo de captura desde Actividades.
- Mejora del visor/histórico de Períodos Financieros.

### Sprint 14 — Paridad de esquema, bootstrap y verificación
- Revisión de coherencia entre esquema, seed y runtime.
- Verificación reforzada de tablas, roles y permisos.
- Consolidación del arranque limpio del entorno.

### Sprint 15 — Refactor de capas y reducción de acoplamiento
- Reorganización de páginas grandes del frontend.
- Mejor separación de responsabilidades en Activities, Projects y Periodos Financieros.
- Refactor del servicio de Períodos Financieros para hacerlo más mantenible.

### Sprint 16 — Pruebas de integración del dominio
- Cobertura de pruebas para baseline.
- Cobertura de rutas críticas de actividades.
- Cobertura de períodos financieros.
- Cobertura de control documentario.
- Mejor protección de reglas de negocio críticas.

### Sprint 17 — Consolidación pública y release de fase
- Documentación pública alineada al estado real del ERP.
- Instrucciones operativas consolidadas.
- Notas de release y limitaciones conocidas antes del bloque de Plantillas.

---

## Estructura general del proyecto

```text
ProyectoMGM/
├─ client/
│  ├─ src/
│  └─ package.json
├─ server/
│  ├─ migrations/
│  ├─ scripts/
│  ├─ tests/
│  ├─ src/
│  │  ├─ config/
│  │  ├─ errors/
│  │  ├─ middleware/
│  │  ├─ modules/
│  │  └─ utils/
│  ├─ .env
│  ├─ .env.example
│  ├─ knexfile.js
│  └─ package.json
├─ INSTRUCCIONES.txt
└─ README.md
```

---

## Requisitos

- Node.js 18 o superior
- npm
- PostgreSQL local instalado y operativo

---

## Configuración del backend

Ubícate en la carpeta `server`.

Instala dependencias:

```bash
npm install
```

Crea un archivo `.env` con una configuración similar a esta:

```env
DB_CLIENT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=proyectomgm
DB_USER=proyectomgm_user
DB_PASSWORD=TU_PASSWORD
DB_ENGINE=postgres
```

Ejecuta migraciones:

```bash
npx knex migrate:latest --env development
```

Carga usuarios base y datos de plataforma:

```bash
npm run db:seed
```

Verifica el estado de la plataforma:

```bash
npm run platform:verify
```

Ejecuta pruebas:

```bash
npm test
```

Levanta el backend:

```bash
npm run dev
```

---

## Configuración del frontend

Ubícate en la carpeta `client`.

Instala dependencias:

```bash
npm install
```

Levanta el frontend:

```bash
npm run dev
```

Si deseas cambiar la URL del backend, define `VITE_API_URL` en el entorno del frontend.

---

## Ejecución local

Debes abrir dos terminales:

### Terminal 1 — backend
```bash
cd server
npm run dev
```

### Terminal 2 — frontend
```bash
cd client
npm run dev
```

### URLs esperadas
- API: `http://localhost:4000`
- UI: `http://localhost:5173`

---

## Acceso inicial

La plataforma puede sembrar usuarios base mediante el script de seed:

- usuario: `admin` / contraseña: `Admin123!`
- usuario: `planner` / contraseña: `Planner123!`
- usuario: `viewer` / contraseña: `Viewer123!`

> Recomendación: cambiar estas contraseñas al formalizar el entorno.

---

## Healthchecks y verificación

### Healthchecks disponibles
- `GET /health/live`
- `GET /health/ready`
- `GET /health`

### Scripts útiles
```bash
npm run db:seed
npm run platform:verify
npm test
```

---

## Flujo operativo recomendado

### Para Control de Proyectos
1. Crear proyecto.
2. Construir WBS.
3. Crear actividades.
4. Generar línea base.
5. Definir períodos financieros del proyecto.
6. Registrar avance acumulado en Actividades.
7. Revisar EV calculado contra presupuesto base.
8. Seleccionar período financiero desde Actividades.
9. Guardar snapshot financiero del período.
10. Revisar histórico y detalle del snapshot.

### Para Control Documentario
1. Entrar al módulo Control Documentario.
2. Crear entregables.
3. Registrar revisiones y respuestas.
4. Consultar estado documentario actual por entregable.

---

## Limitaciones conocidas

- El módulo documentario actual no gestiona archivos adjuntos ni workflow documental completo.
- El EV implementado es básico y está orientado a captura acumulada por actividad.
- Todavía no existen plantillas/layouts time-phased configurables por usuario.
- La distribución temporal de HH y presupuesto de línea base aún no está implementada.
- La analítica avanzada de CPI, SPI, ETC, EAC y forecasting aún no forma parte del alcance actual.

---

## Release de consolidación actual

Esta fase del proyecto ya puede considerarse una **release de consolidación** del ERP liviano, con dos módulos estables y una base temporal suficiente para entrar al siguiente bloque funcional.

Estado consolidado de la release:
- navegación por módulos
- baseline funcional
- EV básico por actividad
- períodos financieros definidos y snapshots
- control documentario de registro, revisión y respuesta
- verificación de plataforma y pruebas del dominio

---

## Hoja de ruta sugerida

Siguientes pasos recomendados:

1. Implementar la funcionalidad de **Plantillas** para layouts temporales.
2. Incorporar distribución temporal calculada de HH y presupuesto de línea base.
3. Profundizar control analítico (EV acumulado/parcial, comparativas, curvas).
4. Incorporar dashboards analíticos.
5. Endurecer performance, despliegue y operación productiva.

---

## Notas

- Esta versión ya no debe considerarse una demo inicial.
- El sistema ya incluye base para ERP liviano con separación por módulos.
- El módulo documentario actual está orientado a **seguimiento de data** y no todavía a gestión documental completa.
- Antes de construir plantillas analíticas avanzadas, conviene seguir usando como fuente temporal principal los **Períodos Financieros**.
