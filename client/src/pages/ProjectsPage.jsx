import { useEffect, useMemo, useState } from 'react';
import SectionCard from '../components/common/SectionCard.jsx';
import ProjectsTable from '../components/projects/ProjectsTable.jsx';
import BaselinesTable from '../components/projects/BaselinesTable.jsx';
import { projectsApi } from '../services/projectsApi.js';
import { baselinesApi } from '../services/baselinesApi.js';
import { catalogsApi } from '../services/catalogsApi.js';
import { useBaselines } from '../hooks/useBaselines.js';

const EMPTY_FORM = { name: '', description: '', status: 'active' };
const EMPTY_BASELINE_FORM = { name: '', description: '' };

export default function ProjectsPage({ projects, activeProjectId, onProjectSelect, reloadProjects }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [baselineForm, setBaselineForm] = useState(EMPTY_BASELINE_FORM);
  const [selectedBaselineId, setSelectedBaselineId] = useState('');
  const [creatingBaseline, setCreatingBaseline] = useState(false);
  const [statusOptions, setStatusOptions] = useState([]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const { baselines, loading: baselinesLoading, error: baselinesError, reloadBaselines } = useBaselines(activeProjectId);

  useEffect(() => {
    let cancelled = false;

    async function loadStatusCatalog() {
      try {
        const response = await catalogsApi.get('project-statuses', { includeInactive: false });
        if (!cancelled) {
          setStatusOptions(Array.isArray(response?.items) ? response.items : []);
        }
      } catch {
        if (!cancelled) {
          setStatusOptions([]);
        }
      }
    }

    loadStatusCatalog();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!baselines.length) {
      setSelectedBaselineId('');
      return;
    }

    if (!selectedBaselineId || !baselines.some((item) => item.id === selectedBaselineId)) {
      setSelectedBaselineId(baselines[0].id);
    }
  }, [baselines, selectedBaselineId]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert('El nombre es obligatorio');
      return;
    }

    if (editingId) {
      await projectsApi.update(editingId, form);
      await reloadProjects(editingId);
    } else {
      const created = await projectsApi.create(form);
      await reloadProjects(created?.id || null);
      if (created?.id) {
        await onProjectSelect(created.id);
      }
    }

    setForm(EMPTY_FORM);
    setEditingId('');
  }

  async function handleDelete(project) {
    const confirmed = confirm(`¿Eliminar el proyecto "${project.name}"?`);
    if (!confirmed) return;

    const deletingActive = project.id === activeProjectId;
    await projectsApi.remove(project.id);
    await reloadProjects(deletingActive ? null : activeProjectId);
  }

  function handleEdit(project) {
    setEditingId(project.id);
    setForm({
      name: project.name || '',
      description: project.description || '',
      status: project.status_code || project.status || 'active',
    });
  }

  function resetForm() {
    setEditingId('');
    setForm(EMPTY_FORM);
  }

  async function handleSelectProject(projectId) {
    await onProjectSelect(projectId);
  }

  async function handleCreateBaseline(e) {
    e.preventDefault();
    if (!activeProjectId) {
      alert('Selecciona un proyecto activo.');
      return;
    }

    setCreatingBaseline(true);
    try {
      await baselinesApi.create({
        project_id: activeProjectId,
        name: baselineForm.name.trim() || undefined,
        description: baselineForm.description.trim() || undefined,
      });
      setBaselineForm(EMPTY_BASELINE_FORM);
      const next = await reloadBaselines();
      if (next[0]?.id) {
        setSelectedBaselineId(next[0].id);
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setCreatingBaseline(false);
    }
  }

  async function handleDeleteBaseline(baseline) {
    const confirmed = confirm(`¿Eliminar la línea base "${baseline.name}"?`);
    if (!confirmed) return;

    try {
      await baselinesApi.remove(baseline.id);
      const next = await reloadBaselines();
      if (!next.some((item) => item.id === selectedBaselineId)) {
        setSelectedBaselineId(next[0]?.id || '');
      }
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px,1fr]">
      <div className="space-y-4">
        <SectionCard title="Proyecto" subtitle="Crea o actualiza la cabecera principal del proyecto">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Ej: Proyecto Mina Norte"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {(statusOptions.length ? statusOptions : [{ code: 'active', name: 'Activo' }]).map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Descripción</label>
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
          title="Crear línea base"
          subtitle={activeProject ? `Proyecto activo: ${activeProject.name}` : 'Selecciona un proyecto para generar su línea base'}
        >
          <form className="space-y-3" onSubmit={handleCreateBaseline}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nombre</label>
              <input
                value={baselineForm.name}
                onChange={(e) => setBaselineForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Ej: BL-01"
                disabled={!activeProjectId || creatingBaseline}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Descripción</label>
              <textarea
                value={baselineForm.description}
                onChange={(e) => setBaselineForm((prev) => ({ ...prev, description: e.target.value }))}
                className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Opcional"
                disabled={!activeProjectId || creatingBaseline}
              />
            </div>
            <button
              type="submit"
              disabled={!activeProjectId || creatingBaseline}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingBaseline ? 'Creando...' : 'Crear línea base'}
            </button>
            {baselinesError ? <div className="text-sm text-rose-600">{baselinesError}</div> : null}
          </form>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard title="Lista de proyectos" subtitle="Selecciona el proyecto activo para trabajar en WBS y actividades">
          <ProjectsTable
            projects={projects}
            activeProjectId={activeProjectId}
            onSelect={handleSelectProject}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </SectionCard>

        <SectionCard title="Líneas base del proyecto" subtitle={activeProject ? 'Snapshots congelados del proyecto activo' : 'No hay proyecto activo'}>
          <BaselinesTable
            baselines={baselines}
            loading={baselinesLoading}
            selectedBaselineId={selectedBaselineId}
            onSelect={setSelectedBaselineId}
            onDelete={handleDeleteBaseline}
          />
        </SectionCard>
      </div>
    </div>
  );
}
