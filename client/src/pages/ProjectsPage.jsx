import { useState } from 'react';
import SectionCard from '../components/common/SectionCard.jsx';
import ProjectsTable from '../components/projects/ProjectsTable.jsx';
import { projectsApi } from '../services/projectsApi.js';

const EMPTY_FORM = { name: '', description: '' };

export default function ProjectsPage({
  projects,
  activeProjectId,
  setActiveProjectId,
  reloadProjects,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    if (editingId) {
      await projectsApi.update(editingId, form);
    } else {
      await projectsApi.create(form);
    }

    setForm(EMPTY_FORM);
    setEditingId('');
    await reloadProjects();
  }

  async function handleDelete(project) {
    const confirmed = confirm(`¿Eliminar el proyecto "${project.name}"?`);
    if (!confirmed) return;

    await projectsApi.remove(project.id);
    await reloadProjects();
  }

  function handleEdit(project) {
    setEditingId(project.id);
    setForm({
      name: project.name || '',
      description: project.description || '',
    });
  }

  function resetForm() {
    setEditingId('');
    setForm(EMPTY_FORM);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
      <SectionCard
        title={editingId ? 'Editar proyecto' : 'Nuevo proyecto'}
        subtitle="Alta y mantenimiento de proyectos"
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Ej: Proyecto Mina Norte"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Descripción del proyecto"
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white">
              {editingId ? 'Guardar cambios' : 'Crear proyecto'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium"
            >
              Limpiar
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        title="Lista de proyectos"
        subtitle="Selecciona el proyecto activo para trabajar en WBS y actividades"
      >
        <ProjectsTable
          projects={projects}
          activeProjectId={activeProjectId}
          onSelect={setActiveProjectId}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </SectionCard>
    </div>
  );
}
