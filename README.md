# ProyectoMGM

Aplicación web ERP ligera para control de proyectos y entregables, inspirada en Primavera P6, con enfoque en WBS jerárquico, actividades, control operativo y gobierno del dato.

> **Estado actual**
>
> La versión local actual del proyecto ya no corresponde a la primera versión publicada en GitHub. El README público todavía menciona SQLite, pero la versión de trabajo actual ya opera sobre **PostgreSQL** con **migraciones Knex**, seguridad, auditoría y catálogos maestros.

---

## Alcance funcional actual

ProyectoMGM está orientado a control de proyectos sin Gantt, con una experiencia tipo ERP enfocada en estructura, actividades y trazabilidad.

### Módulos implementados

- **Proyectos**
  - Crear, editar y eliminar proyectos.
  - Gestión de proyecto activo.
  - Estado del proyecto normalizado por catálogo.

- **WBS jerárquico**
  - Creación de nodos padre e hijo.
  - Reordenamiento de nodos.
  - Recálculo automático de códigos WBS.
  - Mantenimiento de consistencia estructural.

- **Actividades**
  - Alta, edición y eliminación de actividades por nodo WBS.
  - Validación de fechas.
  - Reordenamiento con `sort_order` consistente.
  - Visualización integrada dentro del contexto WBS.

- **Baseline**
  - Generación de líneas base del proyecto.
  - Snapshot de WBS y actividades.

- **Seguridad ERP**
  - Login de usuarios.
  - Roles y permisos.
  - Protección de rutas y acceso por sesión.

- **Auditoría y trazabilidad**
  - Registro de eventos relevantes del sistema.
  - Trazabilidad básica de login, logout y operaciones principales.
  - Metadata de creación y actualización.

- **Catálogos maestros**
  - Administración de valores normalizados.
  - Base para listas controladas tipo ERP.

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

Esa descripción aún aparece en el README público del repositorio. Sin embargo, la versión local actual ya fue evolucionada a una base más cercana a un ERP, con PostgreSQL, hardening técnico, seguridad, auditoría y catálogos maestros.

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

---

## Estructura del proyecto

```text
ProyectoMGM/
├─ client/
│  ├─ src/
│  └─ package.json
├─ server/
│  ├─ migrations/
│  ├─ src/
│  │  ├─ config/
│  │  ├─ errors/
│  │  ├─ middleware/
│  │  ├─ modules/
│  │  └─ utils/
│  ├─ .env
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

---

## Ejecución local

Debes abrir **dos terminales**:

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

La versión actual puede incluir un usuario administrador inicial sembrado por migración.

Ejemplo utilizado durante la implementación:

- **usuario:** `admin`
- **contraseña:** `Admin123!`

> Recomendación: cambiar esta contraseña al formalizar el entorno.

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

## Estado del repositorio público

El README actualmente publicado en GitHub todavía describe una "primera versión ejecutable" basada en SQLite. La versión local actual ya está por encima de ese estado y este documento está pensado para reemplazar ese README desactualizado.

---

## Hoja de ruta sugerida

Siguientes pasos recomendados para continuar profesionalizando el sistema:

1. Corrección de errores visibles y estabilización UX.
2. Refinamiento de permisos por módulo y acción.
3. Mejoras en auditoría y consulta histórica.
4. Catálogos adicionales para disciplina, prioridad, tipo de actividad, moneda y unidades.
5. Evolución hacia control de HH, presupuesto, avance, baseline avanzada y EV.

---

## Notas

- Esta versión ya no debe considerarse una demo inicial.
- El sistema cuenta con una base técnica razonablemente sólida para seguir evolucionando como ERP liviano de control de proyectos.
- Antes de introducir módulos de presupuesto, HH o EV, conviene seguir estabilizando flujos operativos y corrección de bugs funcionales.
