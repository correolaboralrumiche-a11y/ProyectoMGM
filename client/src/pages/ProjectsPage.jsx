import { useEffect, useMemo, useState } from 'react';
import SectionCard from '../components/common/SectionCard.jsx';
import InlineAlert from '../components/common/InlineAlert.jsx';
import ProjectsTable from '../components/projects/ProjectsTable.jsx';
import BaselinesTable from '../components/projects/BaselinesTable.jsx';
import { projectsApi } from '../services/projectsApi.js';
import { baselinesApi } from '../services/baselinesApi.js';
import { catalogsApi } from '../services/catalogsApi.js';
import { useBaselines } from '../hooks/useBaselines.js';
import { getErrorMessage } from '../utils/error.js';

const EMPTY_FORM = { name: '', description: '', status: 'active' };
const EMPTY_BASELINE_FORM = { name: '', description: '' };

export default function ProjectsPage({
  projects,
  activeProjectId,
  onProjectSelect,
  reloadProjects,
  loading = false,
  error = '',
  canCreate = false,
  canUpdate = false,
  canDelete = false,
  canCreateBaseline = false,
  canDeleteBaseline = false,
  canOverrideOperationalLock = false,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [baselineForm, setBaselineForm] = useState(EMPTY_BASELINE_FORM);
  const [selectedBaselineId, setSelectedBaselineId] = useState('');
  const [creatingBaseline, setCreatingBaseline] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [statusOptions, setStatusOptions] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const operationallyLocked = useMemo(() => {
    if (!activeProject) return false;
    if (canOverrideOperationalLock) return false;
    return String(activeProject.status_code || activeProject.status || 'active').trim().toLowerCase() !== 'active';
  }, [activeProject, canOverrideOperationalLock]);

  const canManageProjectForm = editingId ? canUpdate : canCreate;
  const canCreateBaselineNow = Boolean(activeProjectId) && canCreateBaseline && !operationallyLocked;
  const canDeleteBaselineNow = canDeleteBaseline && !operationallyLocked;

  const {
    baselines,
    loading: baselinesLoading,
    error: baselinesError,
    reloadBaselines,
  } = useBaselines(activeProjectId);

  useEffect(() => {
    let cancelled = false;

    async function loadStatusCatalog() {
      try {
        const response = await catalogsApi.get('project-statuses', { includeInactive: false });
        if (!cancelled) {
          setStatusOptions(Array.isArray(response?.items) ? response.items : []);
          setCatalogError('');
        }
      } catch (err) {
        if (!cancelled) {
          setStatusOptions([]);
          setCatalogError(getErrorMessage(err, 'No se pudo cargar el catálogo de estados de proyecto.'));
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

  function resetForm() {
    setEditingId('');
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPageError('');
    setPageSuccess('');

    if (!canManageProjectForm) {
      setPageError(editingId ? 'No tienes permiso para actualizar proyectos.' : 'No tienes permiso para crear proyectos.');
      return;
    }

    if (!form.name.trim()) {
      setPageError('El nombre del proyecto es obligatorio.');
      return;
    }

    setSavingProject(true);
    try {
      if (editingId) {
        await projectsApi.update(editingId, form);
        await reloadProjects(editingId);
        setPageSuccess('Proyecto actualizado correctamente.');
      } else {
        const created = await projectsApi.create(form);
        await reloadProjects(created?.id || null);
        if (created?.id) {
          await onProjectSelect(created.id);
        }
        setPageSuccess('Proyecto creado correctamente.');
      }

      setForm(EMPTY_FORM);
      setEditingId('');
    } catch (err) {
      setPageError(getErrorMessage(err, 'No se pudo guardar el proyecto.'));
    } finally {
      setSavingProject(false);
    }
  }

  async function handleDelete(project) {
    if (!canDelete) {
      setPageError('No tienes permiso para eliminar proyectos.');
      return;
    }

    const confirmed = window.confirm(`¿Eliminar el proyecto "${project.name}"?`);
    if (!confirmed) return;

    setPageError('');
    setPageSuccess('');
    setSavingProject(true);

    try {
      const deletingActive = project.id === activeProjectId;
      await projectsApi.remove(project.id);
      await reloadProjects(deletingActive ? null : activeProjectId);
      setPageSuccess('Proyecto eliminado correctamente.');
      if (editingId === project.id) {
        resetForm();
      }
    } catch (err) {
      setPageError(getErrorMessage(err, 'No se pudo eliminar el proyecto.'));
    } finally {
      setSavingProject(false);
    }
  }

  function handleEdit(project) {
    if (!canUpdate) {
      setPageError('No tienes permiso para editar proyectos.');
      return;
    }

    setEditingId(project.id);
    setForm({
      name: project.name || '',
      description: project.description || '',
      status: project.status_code || project.status || 'active',
    });
    setPageError('');
    setPageSuccess('');
  }

  async function handleSelectProject(projectId) {
    setPageError('');
    await onProjectSelect(projectId);
  }

  async function handleCreateBaseline(event) {
    event.preventDefault();
    setPageError('');
    setPageSuccess('');

    if (!activeProjectId) {
      setPageError('Selecciona un proyecto activo para generar una línea base.');
      return;
    }

    if (!canCreateBaseline) {
      setPageError('No tienes permiso para crear líneas base.');
      return;
    }

    if (operationallyLocked) {
      setPageError('El proyecto activo está en modo solo lectura operativa. Cambia su estado a Activo para generar una línea base.');
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
      setPageSuccess('Línea base creada correctamente.');
    } catch (err) {
      setPageError(getErrorMessage(err, 'No se pudo crear la línea base.'));
    } finally {
      setCreatingBaseline(false);
    }
  }

  async function handleDeleteBaseline(baseline) {
    if (!canDeleteBaseline) {
      setPageError('No tienes permiso para eliminar líneas base.');
      return;
    }

    if (operationallyLocked) {
      setPageError('El proyecto activo está en modo solo lectura operativa.');
      return;
    }

    const confirmed = window.confirm(`¿Eliminar la línea base "${baseline.name}"?`);
    if (!confirmed) return;

    setPageError('');
    setPageSuccess('');
    setCreatingBaseline(true);

    try {
      await baselinesApi.remove(baseline.id);
      const next = await reloadBaselines();
      if (!next.some((item) => item.id === selectedBaselineId)) {
        setSelectedBaselineId(next[0]?.id || '');
      }
      setPageSuccess('Línea base eliminada correctamente.');
    } catch (err) {
      setPageError(getErrorMessage(err, 'No se pudo eliminar la línea base.'));
    } finally {
      setCreatingBaseline(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[380px,1fr]">
      <div className="space-y-4">
        <SectionCard title="Proyecto" subtitle="Crea o actualiza la cabecera principal del proyecto">
          <div className="space-y-3">
            {loading ? <InlineAlert tone="info">Cargando proyectos...</InlineAlert> : null}
            {error ? <InlineAlert tone="warning">{error}</InlineAlert> : null}
            {catalogError ? <InlineAlert tone="warning">{catalogError}</InlineAlert> : null}
            {pageError ? <InlineAlert tone="danger">{pageError}</InlineAlert> : null}
            {pageSuccess ? <InlineAlert tone="success">{pageSuccess}</InlineAlert> : null}
            {!canCreate && !canUpdate ? (
              <InlineAlert tone="info">Tu perfil tiene acceso de consulta sobre proyectos, pero no puede modificarlos.</InlineAlert>
            ) : null}
            {operationallyLocked ? (
              <InlineAlert tone="info">
                El proyecto activo está en modo solo lectura operativa. WBS, actividades y líneas base quedan bloqueados para perfiles no administradores.
              </InlineAlert>
            ) : null}
          </div>

          <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Ej: Proyecto Mina Norte"
                disabled={savingProject || !canManageProjectForm}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                disabled={savingProject || !canManageProjectForm}
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
                disabled={savingProject || !canManageProjectForm}
              />
            </div>

            {(canCreate || canUpdate) ? (
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingProject || !canManageProjectForm}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingProject ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear proyecto'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={savingProject}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Limpiar
                </button>
              </div>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard
          title="Crear línea base"
          subtitle={activeProject ? `Proyecto activo: ${activeProject.name}` : 'Selecciona un proyecto para generar una línea base'}
        >
          <form className="space-y-3" onSubmit={handleCreateBaseline}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nombre</label>
              <input
                value={baselineForm.name}
                onChange={(e) => setBaselineForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Ej: BL-01"
                disabled={!canCreateBaselineNow || creatingBaseline}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Descripción</label>
              <textarea
                value={baselineForm.description}
                onChange={(e) => setBaselineForm((prev) => ({ ...prev, description: e.target.value }))}
                className="min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Opcional"
                disabled={!canCreateBaselineNow || creatingBaseline}
              />
            </div>
            <button
              type="submit"
              disabled={!canCreateBaselineNow || creatingBaseline}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingBaseline ? 'Procesando...' : 'Crear línea base'}
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
            canEdit={canUpdate}
            canDelete={canDelete}
          />
        </SectionCard>

        <SectionCard title="Líneas base del proyecto" subtitle={activeProject ? 'Snapshots congelados del proyecto activo' : 'No hay proyecto activo'}>
          <BaselinesTable
            baselines={baselines}
            loading={baselinesLoading}
            selectedBaselineId={selectedBaselineId}
            onSelect={setSelectedBaselineId}
            onDelete={handleDeleteBaseline}
            canDelete={canDeleteBaselineNow}
          />
        </SectionCard>
      </div>
    </div>
  );
}
