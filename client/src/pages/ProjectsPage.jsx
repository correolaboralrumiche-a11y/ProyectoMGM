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

const EMPTY_FORM = {
  name: '',
  description: '',
  status: 'active',
  priority_code: 'medium',
  currency_code: 'USD',
};

const EMPTY_BASELINE_FORM = {
  name: '',
  description: '',
};

function resolveOperationalLock(project, canOverrideOperationalLock) {
  if (!project) return false;
  if (canOverrideOperationalLock) return false;
  return String(project.status_code || project.status || 'active').trim().toLowerCase() !== 'active';
}

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
  const [catalogs, setCatalogs] = useState({
    statuses: [],
    priorities: [],
    currencies: [],
  });
  const [catalogError, setCatalogError] = useState('');
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) || null,
    [projects, activeProjectId],
  );

  const operationallyLocked = useMemo(
    () => resolveOperationalLock(activeProject, canOverrideOperationalLock),
    [activeProject, canOverrideOperationalLock],
  );

  const canManageProjectForm = editingId ? canUpdate : canCreate;
  const canCreateBaselineNow = Boolean(activeProjectId) && canCreateBaseline && !operationallyLocked;

  const {
    baselines,
    loading: baselinesLoading,
    error: baselinesError,
    reloadBaselines,
  } = useBaselines(activeProjectId);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogs() {
      try {
        const [statuses, priorities, currencies] = await Promise.all([
          catalogsApi.get('project-statuses', { includeInactive: false }),
          catalogsApi.get('project-priorities', { includeInactive: false }),
          catalogsApi.get('currencies', { includeInactive: false }),
        ]);

        if (!cancelled) {
          setCatalogs({
            statuses: Array.isArray(statuses?.items) ? statuses.items : [],
            priorities: Array.isArray(priorities?.items) ? priorities.items : [],
            currencies: Array.isArray(currencies?.items) ? currencies.items : [],
          });
          setCatalogError('');
        }
      } catch (err) {
        if (!cancelled) {
          setCatalogError(getErrorMessage(err, 'No se pudieron cargar los catálogos de proyecto.'));
        }
      }
    }

    loadCatalogs();
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

  function clearFeedback() {
    setPageError('');
    setPageSuccess('');
  }

  function resetForm() {
    setEditingId('');
    setForm(EMPTY_FORM);
  }

  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleBaselineFormChange(field, value) {
    setBaselineForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    clearFeedback();

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
      const payload = {
        name: form.name,
        description: form.description,
        status_code: form.status,
        priority_code: form.priority_code,
        currency_code: form.currency_code,
      };

      if (editingId) {
        await projectsApi.update(editingId, payload);
        await reloadProjects(editingId);
        setPageSuccess('Proyecto actualizado correctamente.');
      } else {
        const created = await projectsApi.create(payload);
        await reloadProjects(created?.id || null);
        if (created?.id) await onProjectSelect(created.id);
        setPageSuccess('Proyecto creado correctamente.');
      }

      resetForm();
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

    if (!window.confirm(`¿Eliminar el proyecto "${project.name}"?`)) return;

    clearFeedback();
    setSavingProject(true);

    try {
      const deletingActive = project.id === activeProjectId;
      await projectsApi.remove(project.id);
      await reloadProjects(deletingActive ? null : activeProjectId);
      setPageSuccess('Proyecto eliminado correctamente.');
      if (editingId === project.id) resetForm();
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
      priority_code: project.priority_code || 'medium',
      currency_code: project.currency_code || 'USD',
    });
    clearFeedback();
  }

  async function handleSelectProject(projectId) {
    setPageError('');
    await onProjectSelect(projectId);
  }

  async function handleCreateBaseline(event) {
    event.preventDefault();
    clearFeedback();

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
      if (next[0]?.id) setSelectedBaselineId(next[0].id);
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

    if (!window.confirm(`¿Eliminar la línea base "${baseline.name}"?`)) return;

    clearFeedback();
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

  const statusOptions = catalogs.statuses.length ? catalogs.statuses : [{ code: 'active', name: 'Activo' }];
  const priorityOptions = catalogs.priorities.length ? catalogs.priorities : [{ code: 'medium', name: 'Media' }];
  const currencyOptions = catalogs.currencies.length ? catalogs.currencies : [{ code: 'USD', name: 'US Dollar' }];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <SectionCard
          title={editingId ? 'Editar proyecto' : 'Nuevo proyecto'}
          subtitle={activeProject ? `Proyecto activo: ${activeProject.name}` : 'Crea o selecciona un proyecto para comenzar'}
        >
          <div className="mb-3 space-y-3">
            {loading ? <InlineAlert tone="info">Actualizando proyectos...</InlineAlert> : null}
            {error ? <InlineAlert tone="warning">{error}</InlineAlert> : null}
            {catalogError ? <InlineAlert tone="warning">{catalogError}</InlineAlert> : null}
            {pageError ? <InlineAlert tone="danger">{pageError}</InlineAlert> : null}
            {pageSuccess ? <InlineAlert tone="success">{pageSuccess}</InlineAlert> : null}
            {operationallyLocked ? (
              <InlineAlert tone="warning">
                El proyecto activo está en modo solo lectura operativa. WBS, actividades y líneas base quedan bloqueados para perfiles no administradores.
              </InlineAlert>
            ) : null}
          </div>

          <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nombre</label>
              <input
                value={form.name}
                onChange={(event) => handleFormChange('name', event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Nombre del proyecto"
                disabled={savingProject || !canManageProjectForm}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Estado</label>
                <select
                  value={form.status}
                  onChange={(event) => handleFormChange('status', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  disabled={savingProject || !canManageProjectForm}
                >
                  {statusOptions.map((option) => (
                    <option key={option.code} value={option.code}>{option.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Prioridad</label>
                <select
                  value={form.priority_code}
                  onChange={(event) => handleFormChange('priority_code', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  disabled={savingProject || !canManageProjectForm}
                >
                  {priorityOptions.map((option) => (
                    <option key={option.code} value={option.code}>{option.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Moneda</label>
                <select
                  value={form.currency_code}
                  onChange={(event) => handleFormChange('currency_code', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  disabled={savingProject || !canManageProjectForm}
                >
                  {currencyOptions.map((option) => (
                    <option key={option.code} value={option.code}>{option.code} · {option.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Descripción</label>
              <textarea
                value={form.description}
                onChange={(event) => handleFormChange('description', event.target.value)}
                className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Descripción del proyecto"
                disabled={savingProject || !canManageProjectForm}
              />
            </div>

            {(canCreate || canUpdate) ? (
              <div className="flex gap-2">
                <button type="submit" disabled={savingProject || !canManageProjectForm} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {savingProject ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear proyecto'}
                </button>
                <button type="button" onClick={resetForm} disabled={savingProject} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">
                  Limpiar
                </button>
              </div>
            ) : null}
          </form>
        </SectionCard>

        <SectionCard title="Crear línea base" subtitle={activeProject ? `Proyecto activo: ${activeProject.name}` : 'Selecciona un proyecto para generar una línea base'}>
          <form className="space-y-3" onSubmit={handleCreateBaseline}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Nombre</label>
              <input
                value={baselineForm.name}
                onChange={(event) => handleBaselineFormChange('name', event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Ej: BL-01"
                disabled={!canCreateBaselineNow || creatingBaseline}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Descripción</label>
              <textarea
                value={baselineForm.description}
                onChange={(event) => handleBaselineFormChange('description', event.target.value)}
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Alcance de la línea base"
                disabled={!canCreateBaselineNow || creatingBaseline}
              />
            </div>

            <button type="submit" disabled={!canCreateBaselineNow || creatingBaseline} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">
              {creatingBaseline ? 'Generando...' : 'Generar línea base'}
            </button>
          </form>
        </SectionCard>
      </div>

      <div className="space-y-4">
        <SectionCard title="Proyectos registrados" subtitle="Selecciona el proyecto activo que alimentará WBS, actividades y líneas base">
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

        <SectionCard title="Líneas base del proyecto" subtitle={activeProject ? `Proyecto activo: ${activeProject.name}` : 'Selecciona un proyecto activo'}>
          {baselinesError ? <InlineAlert tone="warning">{baselinesError}</InlineAlert> : null}
          <BaselinesTable
            baselines={baselines}
            loading={baselinesLoading}
            selectedBaselineId={selectedBaselineId}
            onSelect={setSelectedBaselineId}
            onDelete={handleDeleteBaseline}
            canDelete={canDeleteBaseline && !operationallyLocked}
          />
        </SectionCard>
      </div>
    </div>
  );
}
