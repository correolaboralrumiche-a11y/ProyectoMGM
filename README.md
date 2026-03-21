# ProyectoMGM - Primera versión ejecutable

Aplicación web ligera de control de entregables inspirada en Primavera P6, sin Gantt.

## Stack
- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Express
- Base de datos: SQLite (`better-sqlite3`)

## Qué incluye
- CRUD de proyectos
- WBS jerárquico por proyecto
- Actividades por WBS
- Vista tipo tabla para actividades
- Edición inline
- Recalculo automático de códigos WBS

## Instalación

### Backend
```bash
cd server
npm install
npm run dev
```

### Frontend
```bash
cd client
npm install
npm run dev
```

## URLs
- API: http://localhost:4000
- UI: http://localhost:5173

## Base de datos
Se crea automáticamente en:

```txt
server/data/app.db
```

## Notas
- Esta versión ya es funcional y sirve como base real del sistema.
- La vista de actividades ya separa filas WBS no editables y actividades editables.
- La navegación de Enter/Tab está soportada a nivel básico por input.
- La virtualización de filas y columnas dinámicas quedó preparada para una siguiente iteración.
