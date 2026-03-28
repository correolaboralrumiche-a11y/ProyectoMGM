# ProyectoMGM

Aplicación web ERP ligera para control de proyectos y entregables, inspirada en Primavera P6, con enfoque en **WBS jerárquico**, **actividades**, **control operativo**, **seguridad**, **auditoría** y **gobierno del dato**.

## Estado actual

La versión actual del proyecto ya no corresponde a la primera versión publicada basada en SQLite. La base de trabajo vigente opera sobre:

- **PostgreSQL**
- **Migraciones con Knex**
- **Seguridad ERP con login, roles y permisos**
- **Auditoría y trazabilidad**
- **Catálogos maestros**
- **Presupuesto, avance y actuals básicos por actividad**
- **Seeds, healthchecks, verificación de plataforma y pruebas base**

---

## Alcance funcional actual

ProyectoMGM está orientado a control de proyectos sin Gantt, con una experiencia tipo ERP enfocada en estructura, actividades, trazabilidad y control operativo.

### Módulos implementados

#### Proyectos
- Crear, editar y eliminar proyectos.
- Gestión de proyecto activo.
- Estado del proyecto normalizado por catálogo.
- Restricciones operativas por permisos y estado del proyecto.

#### WBS jerárquico
- Creación de nodos padre e hijo.
- Reordenamiento de nodos.
- Recálculo automático de códigos WBS.
- Mantenimiento de consistencia estructural.
- Control de acceso por permisos finos.

#### Actividades
- Alta, edición y eliminación de actividades por nodo WBS.
- Validación de fechas.
- Reordenamiento con `sort_order` consistente.
- Visualización integrada dentro del contexto WBS.
- Control de acceso por permisos finos.

#### Control operativo por actividad
- Presupuesto de horas hombre y costo por actividad.
- Registro de avance por actividad.
- Registro de actuals básicos por actividad.
- Historial de avances y actuals.
- Resumen operativo con presupuesto, real y saldo.
- Fecha de última actualización operativa.

#### Baseline
- Generación de líneas base del proyecto.
- Snapshot de WBS y actividades.
- Base lista para comparación y control de variaciones.

#### Seguridad ERP
- Login de usuarios.
- Roles y permisos.
- Protección de rutas y acceso por sesión.
- Permisos finos por módulo y acción.
- Usuarios base reproducibles por seed.

#### Auditoría y trazabilidad
- Registro de eventos relevantes del sistema.
- Trazabilidad de login, logout y operaciones principales.
- Metadata de creación y actualización.
- Endpoint y vista de auditoría para perfiles autorizados.

#### Catálogos maestros
- Administración de valores normalizados.
- Base para listas controladas tipo ERP.
- Normalización de estados y datos del sistema.

#### Calidad de plataforma
- Seeds reproducibles.
- Healthchecks.
- Verificación de plataforma.
- Pruebas base automatizadas.
- Scripts iniciales de backup y restore.
- Logging con `request_id`.

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

La primera versión pública del repositorio fue publicada como una aplicación funcional inicial con:

- React + Vite + TailwindCSS en frontend
- Node.js + Express en backend
- SQLite como base de datos
- CRUD de proyectos
- WBS jerárquico
- Actividades por WBS

A partir de esa base, el sistema fue evolucionado hacia una estructura más cercana a un ERP especializado de control de proyectos.

---

## Sprints aplicados en la versión actual

### Sprint 1 — Hardening técnico
- Consistencia de `sort_order` en WBS y actividades.
- Validaciones técnicas más estrictas.
- Operaciones críticas más robustas.
- Mejora de estabilidad en backend.

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
- Base para listas controladas y futuras reglas de negocio.

### Sprint 5 — Estabilización funcional y UX operativa
- Mejoras de estabilidad en frontend.
- Recargas más consistentes entre pestañas.
- Manejo homogéneo de errores.
- Correcciones de comportamiento en actividades.

### Sprint 6 — Permisos finos y control operativo
- Permisos por módulo y acción.
- Restricciones operativas más específicas.
- Ocultamiento/bloqueo de acciones según perfil.

### Sprint 7 — Calidad de plataforma y confiabilidad
- Seeds reproducibles.
- Validación de plataforma.
- Healthchecks.
- Logging técnico base.
- Pruebas automatizadas iniciales.
- Scripts de respaldo y restauración.

### Sprint 8 — Presupuesto, avance y actuals básicos por actividad
- Historial operativo de avance.
- Historial de actuals básicos.
- Resumen presupuesto vs real por actividad.
- Panel operativo en actividades.
- Corrección de manejo de fechas en control operativo.

---

## Estructura del proyecto

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

Ejecuta pruebas base:

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

## Catálogos maestros

Los catálogos maestros funcionan como listas controladas del sistema, similares conceptualmente a una lista desplegable de Excel, pero centralizadas y gobernadas por el ERP.

Sirven para:
- evitar texto libre inconsistente
- mantener estados normalizados
- facilitar filtros y reportes
- preparar reglas de negocio futuras

---

## Auditoría

La solución actual ya incorpora una base de trazabilidad para eventos relevantes del sistema.

Objetivos:
- saber quién hizo un cambio
- saber cuándo ocurrió
- registrar eventos de operación clave
- preparar el sistema para mayor gobierno del dato

---

## Estado actual del sistema

La solución ya debe considerarse un **ERP web ligero especializado en control de proyectos**, no una demo inicial.

Aun así, el proyecto sigue en evolución y todavía tiene espacio de maduración en:
- corrección de errores visibles
- endurecimiento UX
- mayor profundidad funcional de control
- despliegue más formal
- mayor cobertura de pruebas

---

## Hoja de ruta sugerida

Siguientes pasos recomendados para continuar profesionalizando el sistema:

1. Corrección de errores visibles y estabilización adicional de flujos.
2. Refinamiento de permisos por módulo y acción.
3. Mejoras en auditoría y consulta histórica.
4. Catálogos adicionales para disciplina, prioridad, tipo de actividad, moneda y unidades.
5. Evolución hacia control más completo de HH, presupuesto, avance, baseline comparativa y EV.

---

## Notas

- Esta versión ya no debe considerarse una demo inicial.
- El sistema cuenta con una base técnica razonablemente sólida para seguir evolucionando como ERP liviano de control de proyectos.
- Antes de introducir módulos más avanzados como EV, ETC, EAC o forecasting, conviene seguir estabilizando flujos operativos y calidad funcional.
