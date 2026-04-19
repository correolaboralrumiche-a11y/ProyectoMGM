import { useEffect, useMemo, useState } from 'react';
import SectionCard from '../components/common/SectionCard.jsx';
import InlineAlert from '../components/common/InlineAlert.jsx';
import { catalogsApi } from '../services/catalogsApi.js';
import { deliverablesApi } from '../services/deliverablesApi.js';
import { useDeliverables } from '../hooks/useDeliverables.js';
import { getErrorMessage } from '../utils/error.js';

const EMPTY_FILTERS = {
  search: '',
  status_code: '',
  discipline_code: '',
  deliverable_type_code: '',
};

const EMPTY_DELIVERABLE_FORM = {
  document_code: '',
  title: '',
  description: '',
  wbs_id: '',
  activity_id: '',
  deliverable_type_code: 'drawing',
  discipline_code: 'general',
  priority_code: 'medium',
  status_code: 'draft',
  originator: '',
  responsible_person: '',
  spec_section: '',
  package_no: '',
  planned_issue_date: '',
  forecast_issue_date: '',
  actual_issue_date: '',
  planned_response_date: '',
  forecast_response_date: '',
  actual_response_date: '',
  remarks: '',
};

const EMPTY_REVISION_FORM = {
  revision_code: '',
  issue_purpose_code: 'ifa',
  issue_date: '',
  issue_transmittal_no: '',
  planned_response_date: '',
  response_date: '',
  response_code: '',
  response_transmittal_no: '',
  response_by: '',
  remarks: '',
};

function normalizeDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

function SummaryCard({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function DeliverablesTable({
  deliverables,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  canUpdate,
  canDelete,
}) {
  if (!deliverables.length) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No hay entregables registrados para el filtro actual.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Título</th>
            <th className="px-3 py-2">Rev.</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Respuesta</th>
            <th className="px-3 py-2">Disciplina</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Emisión plan</th>
            <th className="px-3 py-2">Resp. plan</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {deliverables.map((item) => {
            const selected = selectedId === item.id;
            return (
              <tr
                key={item.id}
                className={selected ? 'bg-blue-50/70' : 'hover:bg-slate-50'}
                onClick={() => onSelect(item.id)}
              >
                <td className="px-3 py-2 font-medium text-slate-900">{item.document_code}</td>
                <td className="px-3 py-2 text-slate-700">{item.title}</td>
                <td className="px-3 py-2 text-slate-700">{item.current_revision_code || '—'}</td>
                <td className="px-3 py-2 text-slate-700">{item.status_name || item.status_code}</td>
                <td className="px-3 py-2 text-slate-700">{item.current_response_name || item.current_response_code || '—'}</td>
                <td className="px-3 py-2 text-slate-700">{item.discipline_name || item.discipline_code}</td>
                <td className="px-3 py-2 text-slate-700">{item.deliverable_type_name || item.deliverable_type_code}</td>
                <td className="px-3 py-2 text-slate-700">{item.planned_issue_date || '—'}</td>
                <td className="px-3 py-2 text-slate-700">{item.planned_response_date || '—'}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(item);
                      }}
                      disabled={!canUpdate}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(item);
                      }}
                      disabled={!canDelete}
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RevisionsTable({ revisions, selectedId, onEdit, canManage }) {
  if (!revisions.length) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">El entregable seleccionado aún no tiene revisiones registradas.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Rev.</th>
            <th className="px-3 py-2">Propósito</th>
            <th className="px-3 py-2">Emisión</th>
            <th className="px-3 py-2">TRN emisión</th>
            <th className="px-3 py-2">Resp. plan</th>
            <th className="px-3 py-2">Respuesta</th>
            <th className="px-3 py-2">Código respuesta</th>
            <th className="px-3 py-2">TRN respuesta</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {revisions.map((revision) => (
            <tr key={revision.id} className={selectedId === revision.id ? 'bg-blue-50/70' : 'hover:bg-slate-50'}>
              <td className="px-3 py-2 font-medium text-slate-900">{revision.revision_code}</td>
              <td className="px-3 py-2 text-slate-700">{revision.issue_purpose_name || revision.issue_purpose_code}</td>
              <td className="px-3 py-2 text-slate-700">{revision.issue_date || '—'}</td>
              <td className="px-3 py-2 text-slate-700">{revision.issue_transmittal_no || '—'}</td>
              <td className="px-3 py-2 text-slate-700">{revision.planned_response_date || '—'}</td>
              <td className="px-3 py-2 text-slate-700">{revision.response_date || '—'}</td>
              <td className="px-3 py-2 text-slate-700">{revision.response_name || revision.response_code || '—'}</td>
              <td className="px-3 py-2 text-slate-700">{revision.response_transmittal_no || '—'}</td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => onEdit(revision)}
                  disabled={!canManage}
                >
                  Editar revisión
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function resolveFlag(primaryValue, fallbackValue = false) {
  return typeof primaryValue === 'boolean' ? primaryValue : Boolean(fallbackValue);
}

export default function DeliverablesPage({
  activeProject,
  tree,
  activities,
  canCreate = false,
  canUpdate = false,
  canDelete = false,
  canManageRevisions = false,
  permissions,
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const effectiveCanCreate = resolveFlag(canCreate, permissions?.deliverables?.create);
  const effectiveCanUpdate = resolveFlag(canUpdate, permissions?.deliverables?.update);
  const effectiveCanDelete = resolveFlag(canDelete, permissions?.deliverables?.delete);
  const effectiveCanManageRevisions = resolveFlag(canManageRevisions, permissions?.deliverables?.manageRevisions);
  const { deliverables, loading, error, reloadDeliverables } = useDeliverables(activeProject?.id, filters);

  const [catalogs, setCatalogs] = useState({
    statuses: [],
    deliverableTypes: [],
    disciplines: [],
    priorities: [],
    responseCodes: [],
    revisionPurposes: [],
  });
  const [catalogError, setCatalogError] = useState('');
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');

  const [editingDeliverableId, setEditingDeliverableId] = useState('');
  const [deliverableForm, setDeliverableForm] = useState(EMPTY_DELIVERABLE_FORM);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState('');
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [editingRevisionId, setEditingRevisionId] = useState('');
  const [revisionForm, setRevisionForm] = useState(EMPTY_REVISION_FORM);
  const [savingDeliverable, setSavingDeliverable] = useState(false);
  const [savingRevision, setSavingRevision] = useState(false);

  const wbsOptions = useMemo(
    () => (Array.isArray(tree) ? tree.filter((node) => node.type === 'wbs') : []),
    [tree],
  );

  const activityOptions = useMemo(() => {
    const filteredByWbs = deliverableForm.wbs_id
      ? (Array.isArray(activities) ? activities.filter((item) => item.wbs_id === deliverableForm.wbs_id) : [])
      : Array.isArray(activities)
        ? activities
        : [];

    return filteredByWbs;
  }, [activities, deliverableForm.wbs_id]);

  const summary = useMemo(() => {
    const total = deliverables.length;
    const underReview = deliverables.filter((item) => item.status_code === 'under_review').length;
    const returned = deliverables.filter((item) => item.status_code === 'returned_for_update').length;
    const closed = deliverables.filter((item) => item.status_code === 'closed').length;

    return { total, underReview, returned, closed };
  }, [deliverables]);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogs() {
      try {
        const [statuses, deliverableTypes, disciplines, priorities, responseCodes, revisionPurposes] = await Promise.all([
          catalogsApi.get('deliverable-statuses', { includeInactive: false }),
          catalogsApi.get('deliverable-types', { includeInactive: false }),
          catalogsApi.get('disciplines', { includeInactive: false }),
          catalogsApi.get('project-priorities', { includeInactive: false }),
          catalogsApi.get('document-response-codes', { includeInactive: false }),
          catalogsApi.get('revision-purposes', { includeInactive: false }),
        ]);

        if (!cancelled) {
          setCatalogs({
            statuses: Array.isArray(statuses?.items) ? statuses.items : [],
            deliverableTypes: Array.isArray(deliverableTypes?.items) ? deliverableTypes.items : [],
            disciplines: Array.isArray(disciplines?.items) ? disciplines.items : [],
            priorities: Array.isArray(priorities?.items) ? priorities.items : [],
            responseCodes: Array.isArray(responseCodes?.items) ? responseCodes.items : [],
            revisionPurposes: Array.isArray(revisionPurposes?.items) ? revisionPurposes.items : [],
          });
          setCatalogError('');
        }
      } catch (catalogLoadError) {
        if (!cancelled) {
          setCatalogError(getErrorMessage(catalogLoadError, 'No se pudieron cargar los catálogos documentarios.'));
        }
      }
    }

    loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!deliverables.length) {
      setSelectedDeliverableId('');
      setSelectedDeliverable(null);
      setRevisions([]);
      return;
    }

    const current = deliverables.find((item) => item.id === selectedDeliverableId) || null;
    if (current) {
      setSelectedDeliverable(current);
      return;
    }

    setSelectedDeliverableId(deliverables[0].id);
    setSelectedDeliverable(deliverables[0]);
  }, [deliverables, selectedDeliverableId]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!selectedDeliverableId) {
        setRevisions([]);
        return;
      }

      setRevisionsLoading(true);
      setPageError('');

      try {
        const detail = await deliverablesApi.detail(selectedDeliverableId);
        if (!cancelled) {
          setSelectedDeliverable(detail?.deliverable || null);
          setRevisions(Array.isArray(detail?.revisions) ? detail.revisions : []);
        }
      } catch (detailError) {
        if (!cancelled) {
          setRevisions([]);
          setPageError(getErrorMessage(detailError, 'No se pudo cargar el detalle del entregable.'));
        }
      } finally {
        if (!cancelled) {
          setRevisionsLoading(false);
        }
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedDeliverableId]);

  function clearFeedback() {
    setPageError('');
    setPageSuccess('');
  }

  function handleFilterChange(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }

  function resetDeliverableForm() {
    setEditingDeliverableId('');
    setDeliverableForm(EMPTY_DELIVERABLE_FORM);
  }

  function resetRevisionForm() {
    setEditingRevisionId('');
    setRevisionForm(EMPTY_REVISION_FORM);
  }

  function handleDeliverableFormChange(field, value) {
    setDeliverableForm((prev) => {
      if (field === 'wbs_id') {
        return {
          ...prev,
          wbs_id: value,
          activity_id: prev.activity_id && prev.wbs_id !== value ? '' : prev.activity_id,
        };
      }
      return { ...prev, [field]: value };
    });
  }

  function handleRevisionFormChange(field, value) {
    setRevisionForm((prev) => ({ ...prev, [field]: value }));
  }

  function startEditDeliverable(item) {
    setEditingDeliverableId(item.id);
    setDeliverableForm({
      document_code: item.document_code || '',
      title: item.title || '',
      description: item.description || '',
      wbs_id: item.wbs_id || '',
      activity_id: item.activity_id || '',
      deliverable_type_code: item.deliverable_type_code || 'drawing',
      discipline_code: item.discipline_code || 'general',
      priority_code: item.priority_code || 'medium',
      status_code: item.status_code || 'draft',
      originator: item.originator || '',
      responsible_person: item.responsible_person || '',
      spec_section: item.spec_section || '',
      package_no: item.package_no || '',
      planned_issue_date: normalizeDateInput(item.planned_issue_date),
      forecast_issue_date: normalizeDateInput(item.forecast_issue_date),
      actual_issue_date: normalizeDateInput(item.actual_issue_date),
      planned_response_date: normalizeDateInput(item.planned_response_date),
      forecast_response_date: normalizeDateInput(item.forecast_response_date),
      actual_response_date: normalizeDateInput(item.actual_response_date),
      remarks: item.remarks || '',
    });
  }

  function startEditRevision(item) {
    setEditingRevisionId(item.id);
    setRevisionForm({
      revision_code: item.revision_code || '',
      issue_purpose_code: item.issue_purpose_code || 'ifa',
      issue_date: normalizeDateInput(item.issue_date),
      issue_transmittal_no: item.issue_transmittal_no || '',
      planned_response_date: normalizeDateInput(item.planned_response_date),
      response_date: normalizeDateInput(item.response_date),
      response_code: item.response_code || '',
      response_transmittal_no: item.response_transmittal_no || '',
      response_by: item.response_by || '',
      remarks: item.remarks || '',
    });
  }

  async function handleSubmitDeliverable(event) {
    event.preventDefault();
    clearFeedback();

    if (!(editingDeliverableId ? effectiveCanUpdate : effectiveCanCreate)) {
      setPageError(editingDeliverableId ? 'No tienes permiso para editar entregables.' : 'No tienes permiso para crear entregables.');
      return;
    }

    if (!activeProject?.id) {
      setPageError('Debes seleccionar un proyecto activo.');
      return;
    }

    if (!deliverableForm.document_code.trim() || !deliverableForm.title.trim()) {
      setPageError('El código y el título del entregable son obligatorios.');
      return;
    }

    setSavingDeliverable(true);

    try {
      const payload = {
        project_id: activeProject.id,
        ...deliverableForm,
        wbs_id: deliverableForm.wbs_id || null,
        activity_id: deliverableForm.activity_id || null,
      };

      if (editingDeliverableId) {
        await deliverablesApi.update(editingDeliverableId, payload);
        setPageSuccess('Entregable actualizado correctamente.');
      } else {
        const created = await deliverablesApi.create(payload);
        setSelectedDeliverableId(created?.id || '');
        setPageSuccess('Entregable creado correctamente.');
      }

      resetDeliverableForm();
      const refreshed = await reloadDeliverables();
      if (!editingDeliverableId && refreshed[0]?.id && !selectedDeliverableId) {
        setSelectedDeliverableId(refreshed[0].id);
      }
    } catch (submitError) {
      setPageError(getErrorMessage(submitError, 'No se pudo guardar el entregable.'));
    } finally {
      setSavingDeliverable(false);
    }
  }

  async function handleDeleteDeliverable(item) {
    clearFeedback();
    if (!effectiveCanDelete) {
      setPageError('No tienes permiso para eliminar entregables.');
      return;
    }

    if (!window.confirm(`¿Desactivar el entregable "${item.document_code}"?`)) return;

    try {
      await deliverablesApi.remove(item.id);
      setPageSuccess('Entregable desactivado correctamente.');
      if (editingDeliverableId === item.id) resetDeliverableForm();
      if (selectedDeliverableId === item.id) setSelectedDeliverableId('');
      await reloadDeliverables();
    } catch (deleteError) {
      setPageError(getErrorMessage(deleteError, 'No se pudo eliminar el entregable.'));
    }
  }

  async function handleSubmitRevision(event) {
    event.preventDefault();
    clearFeedback();

    if (!selectedDeliverableId) {
      setPageError('Selecciona un entregable para registrar revisiones.');
      return;
    }

    if (!effectiveCanManageRevisions) {
      setPageError('No tienes permiso para gestionar revisiones documentarias.');
      return;
    }

    if (!revisionForm.revision_code.trim()) {
      setPageError('El código de revisión es obligatorio.');
      return;
    }

    setSavingRevision(true);

    try {
      if (editingRevisionId) {
        await deliverablesApi.updateRevision(selectedDeliverableId, editingRevisionId, revisionForm);
        setPageSuccess('Revisión actualizada correctamente.');
      } else {
        await deliverablesApi.createRevision(selectedDeliverableId, revisionForm);
        setPageSuccess('Revisión registrada correctamente.');
      }

      resetRevisionForm();
      await reloadDeliverables();
      const detail = await deliverablesApi.detail(selectedDeliverableId);
      setSelectedDeliverable(detail?.deliverable || null);
      setRevisions(Array.isArray(detail?.revisions) ? detail.revisions : []);
    } catch (revisionError) {
      setPageError(getErrorMessage(revisionError, 'No se pudo guardar la revisión.'));
    } finally {
      setSavingRevision(false);
    }
  }

  if (!activeProject) {
    return <SectionCard title="Control documentario">No hay proyecto activo.</SectionCard>;
  }

  return (
    <SectionCard title={`Control documentario · ${activeProject.name}`}>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <SummaryCard label="Entregables" value={summary.total} tone="slate" />
        <SummaryCard label="En revisión" value={summary.underReview} tone="blue" />
        <SummaryCard label="Devueltos" value={summary.returned} tone="amber" />
        <SummaryCard label="Cerrados" value={summary.closed} tone="emerald" />
      </div>

      {error ? <InlineAlert tone="warning" className="mb-3">{error}</InlineAlert> : null}
      {catalogError ? <InlineAlert tone="warning" className="mb-3">{catalogError}</InlineAlert> : null}
      {pageError ? <InlineAlert tone="warning" className="mb-3">{pageError}</InlineAlert> : null}
      {pageSuccess ? <InlineAlert tone="success" className="mb-3">{pageSuccess}</InlineAlert> : null}

      <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 text-sm font-semibold text-slate-800">Filtros del registro documentario</div>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm text-slate-700">
            Buscar
            <input
              value={filters.search}
              onChange={(event) => handleFilterChange('search', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Código o título"
            />
          </label>
          <label className="text-sm text-slate-700">
            Estado
            <select
              value={filters.status_code}
              onChange={(event) => handleFilterChange('status_code', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Todos</option>
              {catalogs.statuses.map((option) => (
                <option key={option.code} value={option.code}>{option.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Disciplina
            <select
              value={filters.discipline_code}
              onChange={(event) => handleFilterChange('discipline_code', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Todas</option>
              {catalogs.disciplines.map((option) => (
                <option key={option.code} value={option.code}>{option.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            Tipo
            <select
              value={filters.deliverable_type_code}
              onChange={(event) => handleFilterChange('deliverable_type_code', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Todos</option>
              {catalogs.deliverableTypes.map((option) => (
                <option key={option.code} value={option.code}>{option.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">Registro maestro de entregables</div>
                <div className="text-xs text-slate-500">Incluye código único, revisión actual, estado documentario y respuesta.</div>
              </div>
              {loading ? <div className="text-xs text-slate-500">Cargando...</div> : null}
            </div>
            <DeliverablesTable
              deliverables={deliverables}
              selectedId={selectedDeliverableId}
              onSelect={setSelectedDeliverableId}
              onEdit={startEditDeliverable}
              onDelete={handleDeleteDeliverable}
              canUpdate={effectiveCanUpdate}
              canDelete={effectiveCanDelete}
            />
          </div>

          <div>
            <div className="mb-3 text-sm font-semibold text-slate-800">
              {selectedDeliverable ? `Historial de revisiones · ${selectedDeliverable.document_code}` : 'Historial de revisiones'}
            </div>
            {revisionsLoading ? <InlineAlert tone="info" className="mb-3">Cargando revisiones...</InlineAlert> : null}
            <RevisionsTable
              revisions={revisions}
              selectedId={editingRevisionId}
              onEdit={startEditRevision}
              canManage={effectiveCanManageRevisions}
            />
          </div>
        </div>

        <div className="space-y-5">
          <form onSubmit={handleSubmitDeliverable} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {editingDeliverableId ? 'Editar entregable' : 'Nuevo entregable'}
                </div>
                <div className="text-xs text-slate-500">Registro principal del módulo de control documentario.</div>
              </div>
              {editingDeliverableId ? (
                <button type="button" className="text-xs font-medium text-slate-600 hover:text-slate-900" onClick={resetDeliverableForm}>
                  Cancelar edición
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-700">
                Código documental
                <input value={deliverableForm.document_code} onChange={(event) => handleDeliverableFormChange('document_code', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Título
                <input value={deliverableForm.title} onChange={(event) => handleDeliverableFormChange('title', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700 md:col-span-2">
                Descripción
                <textarea value={deliverableForm.description} onChange={(event) => handleDeliverableFormChange('description', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows={3} />
              </label>
              <label className="text-sm text-slate-700">
                WBS
                <select value={deliverableForm.wbs_id} onChange={(event) => handleDeliverableFormChange('wbs_id', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="">Sin WBS</option>
                  {wbsOptions.map((node) => (
                    <option key={node.id} value={node.id}>{node.code ? `${node.code} · ${node.name}` : node.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Actividad
                <select value={deliverableForm.activity_id} onChange={(event) => handleDeliverableFormChange('activity_id', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="">Sin actividad</option>
                  {activityOptions.map((activity) => (
                    <option key={activity.id} value={activity.id}>{activity.activity_id} · {activity.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Tipo
                <select value={deliverableForm.deliverable_type_code} onChange={(event) => handleDeliverableFormChange('deliverable_type_code', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                  {catalogs.deliverableTypes.map((option) => (
                    <option key={option.code} value={option.code}>{option.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Disciplina
                <select value={deliverableForm.discipline_code} onChange={(event) => handleDeliverableFormChange('discipline_code', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                  {catalogs.disciplines.map((option) => (
                    <option key={option.code} value={option.code}>{option.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Prioridad
                <select value={deliverableForm.priority_code} onChange={(event) => handleDeliverableFormChange('priority_code', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                  {catalogs.priorities.map((option) => (
                    <option key={option.code} value={option.code}>{option.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Estado documentario
                <select value={deliverableForm.status_code} onChange={(event) => handleDeliverableFormChange('status_code', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                  {catalogs.statuses.map((option) => (
                    <option key={option.code} value={option.code}>{option.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Originador
                <input value={deliverableForm.originator} onChange={(event) => handleDeliverableFormChange('originator', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Responsable
                <input value={deliverableForm.responsible_person} onChange={(event) => handleDeliverableFormChange('responsible_person', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Spec section
                <input value={deliverableForm.spec_section} onChange={(event) => handleDeliverableFormChange('spec_section', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Package
                <input value={deliverableForm.package_no} onChange={(event) => handleDeliverableFormChange('package_no', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Emisión plan
                <input type="date" value={deliverableForm.planned_issue_date} onChange={(event) => handleDeliverableFormChange('planned_issue_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Emisión forecast
                <input type="date" value={deliverableForm.forecast_issue_date} onChange={(event) => handleDeliverableFormChange('forecast_issue_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Emisión real
                <input type="date" value={deliverableForm.actual_issue_date} onChange={(event) => handleDeliverableFormChange('actual_issue_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Respuesta plan
                <input type="date" value={deliverableForm.planned_response_date} onChange={(event) => handleDeliverableFormChange('planned_response_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Respuesta forecast
                <input type="date" value={deliverableForm.forecast_response_date} onChange={(event) => handleDeliverableFormChange('forecast_response_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Respuesta real
                <input type="date" value={deliverableForm.actual_response_date} onChange={(event) => handleDeliverableFormChange('actual_response_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700 md:col-span-2">
                Observaciones
                <textarea value={deliverableForm.remarks} onChange={(event) => handleDeliverableFormChange('remarks', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows={2} />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" disabled={savingDeliverable || !(editingDeliverableId ? effectiveCanUpdate : effectiveCanCreate)}>
                {savingDeliverable ? 'Guardando...' : editingDeliverableId ? 'Actualizar entregable' : 'Crear entregable'}
              </button>
            </div>
          </form>

          <form onSubmit={handleSubmitRevision} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">
                  {editingRevisionId ? 'Editar revisión' : 'Registrar revisión / respuesta'}
                </div>
                <div className="text-xs text-slate-500">Ciclo documental de emisión y respuesta por revisión.</div>
              </div>
              {editingRevisionId ? (
                <button type="button" className="text-xs font-medium text-slate-600 hover:text-slate-900" onClick={resetRevisionForm}>
                  Cancelar edición
                </button>
              ) : null}
            </div>

            {!selectedDeliverable ? <InlineAlert tone="info" className="mb-3">Selecciona un entregable para registrar revisiones.</InlineAlert> : null}

            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-700">
                Revisión
                <input value={revisionForm.revision_code} onChange={(event) => handleRevisionFormChange('revision_code', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Propósito
                <select value={revisionForm.issue_purpose_code} onChange={(event) => handleRevisionFormChange('issue_purpose_code', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                  {catalogs.revisionPurposes.map((option) => (
                    <option key={option.code} value={option.code}>{option.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                Fecha emisión
                <input type="date" value={revisionForm.issue_date} onChange={(event) => handleRevisionFormChange('issue_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                TRN emisión
                <input value={revisionForm.issue_transmittal_no} onChange={(event) => handleRevisionFormChange('issue_transmittal_no', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Fecha plan respuesta
                <input type="date" value={revisionForm.planned_response_date} onChange={(event) => handleRevisionFormChange('planned_response_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Fecha respuesta
                <input type="date" value={revisionForm.response_date} onChange={(event) => handleRevisionFormChange('response_date', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700">
                Código respuesta
                <select value={revisionForm.response_code} onChange={(event) => handleRevisionFormChange('response_code', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="">Sin respuesta</option>
                  {catalogs.responseCodes.map((option) => (
                    <option key={option.code} value={option.code}>{option.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-slate-700">
                TRN respuesta
                <input value={revisionForm.response_transmittal_no} onChange={(event) => handleRevisionFormChange('response_transmittal_no', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700 md:col-span-2">
                Respondido por
                <input value={revisionForm.response_by} onChange={(event) => handleRevisionFormChange('response_by', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm text-slate-700 md:col-span-2">
                Comentarios
                <textarea value={revisionForm.remarks} onChange={(event) => handleRevisionFormChange('remarks', event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" rows={2} />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800" disabled={savingRevision || !selectedDeliverable || !effectiveCanManageRevisions}>
                {savingRevision ? 'Guardando...' : editingRevisionId ? 'Actualizar revisión' : 'Registrar revisión'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </SectionCard>
  );
}
