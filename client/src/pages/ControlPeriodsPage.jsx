import { useCallback, useEffect, useMemo, useState } from 'react';
import SectionCard from '../components/common/SectionCard.jsx';
import InlineAlert from '../components/common/InlineAlert.jsx';
import { useControlPeriods } from '../hooks/useControlPeriods.js';
import { controlPeriodsApi } from '../services/controlPeriodsApi.js';
import { getErrorMessage } from '../utils/error.js';

const EMPTY_DEFINITION_FORM = {
  period_code: '',
  name: '',
  start_date: '',
  cutoff_date: '',
  end_date: '',
};

function formatNumber(value, digits = 2) {
  const numericValue = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(numericValue);
}

function derivePeriodCode(startDate, cutoffDate) {
  const normalizedStart = String(startDate || '').trim();
  const normalizedCutoff = String(cutoffDate || '').trim();
  if (!normalizedStart || !normalizedCutoff) return '';
  const startToken = normalizedStart.replaceAll('-', '').slice(2);
  const cutoffToken = normalizedCutoff.replaceAll('-', '').slice(2);
  return `PF-${startToken}-${cutoffToken}`;
}

function getSelectionStorageKey(projectId) {
  return projectId ? `erp:selected-financial-period:${projectId}` : '';
}

function getPreferredFinancialPeriodId(projectId) {
  if (!projectId || typeof window === 'undefined') return '';
  return window.localStorage.getItem(getSelectionStorageKey(projectId)) || '';
}

function setPreferredFinancialPeriodId(projectId, periodId) {
  if (!projectId || typeof window === 'undefined') return;
  const key = getSelectionStorageKey(projectId);
  if (!periodId) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, periodId);
}

function StatusBadge({ status }) {
  const normalized = String(status || '').toLowerCase();
  const tone = normalized === 'closed'
    ? 'bg-emerald-100 text-emerald-700'
    : normalized === 'reopened'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-100 text-slate-700';

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {status || '—'}
    </span>
  );
}

function DefinitionStatusBadge({ hasSnapshot, snapshotStatusCode }) {
  if (!hasSnapshot) {
    return <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Pendiente</span>;
  }

  return (
    <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      Snapshot {snapshotStatusCode || 'registrado'}
    </span>
  );
}

function MetricCard({ label, value, helper, tone = 'slate' }) {
  const toneMap = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    slate: 'border-slate-200 bg-slate-50 text-slate-900',
  };
  const toneClass = toneMap[tone] || toneMap.slate;

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-xs font-medium uppercase tracking-[0.12em] opacity-80">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      {helper ? <div className="mt-2 text-xs opacity-80">{helper}</div> : null}
    </div>
  );
}

function FinancialPeriodsTable({
  financialPeriods,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  canManage,
  canDelete,
  busyId,
}) {
  if (!financialPeriods.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        Aún no hay periodos financieros definidos para este proyecto.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Código</th>
            <th className="px-3 py-2 text-left font-medium">Nombre</th>
            <th className="px-3 py-2 text-left font-medium">Rango</th>
            <th className="px-3 py-2 text-left font-medium">Corte</th>
            <th className="px-3 py-2 text-left font-medium">Estado</th>
            <th className="px-3 py-2 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {financialPeriods.map((definition) => {
            const isSelected = selectedId === definition.id;
            return (
              <tr
                key={definition.id}
                className={isSelected ? 'bg-sky-50' : ''}
                onClick={() => onSelect(definition.id)}
              >
                <td className="px-3 py-2 font-medium text-slate-800">{definition.period_code}</td>
                <td className="px-3 py-2 text-slate-700">{definition.name}</td>
                <td className="px-3 py-2 text-slate-600">{definition.start_date} → {definition.end_date}</td>
                <td className="px-3 py-2 text-slate-600">{definition.cutoff_date}</td>
                <td className="px-3 py-2">
                  <DefinitionStatusBadge hasSnapshot={definition.has_snapshot} snapshotStatusCode={definition.snapshot_status_code} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    {canManage ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEdit(definition);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                    ) : null}

                    {canDelete ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(definition);
                        }}
                        disabled={busyId === `delete-definition:${definition.id}` || definition.has_snapshot}
                        className="rounded-lg border border-rose-300 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyId === `delete-definition:${definition.id}` ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    ) : null}
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

function SnapshotsTable({
  periods,
  selectedId,
  onSelect,
  onClose,
  onReopen,
  onDelete,
  canClose,
  canReopen,
  canDelete,
  busyId,
}) {
  if (!periods.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        Aún no hay snapshots financieros registrados.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Periodo</th>
            <th className="px-3 py-2 text-left font-medium">Snapshot</th>
            <th className="px-3 py-2 text-left font-medium">EV</th>
            <th className="px-3 py-2 text-left font-medium">Avance</th>
            <th className="px-3 py-2 text-left font-medium">Estado</th>
            <th className="px-3 py-2 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {periods.map((period) => {
            const isSelected = selectedId === period.id;
            const isClosed = String(period.status_code || '').toLowerCase() === 'closed';

            return (
              <tr
                key={period.id}
                className={isSelected ? 'bg-sky-50' : ''}
                onClick={() => onSelect(period.id)}
              >
                <td className="px-3 py-2 text-slate-700">
                  <div className="font-medium text-slate-800">{period.period_code}</div>
                  <div className="text-xs text-slate-500">{period.start_date} → {period.end_date}</div>
                </td>
                <td className="px-3 py-2 text-slate-600">{period.snapshot_date || '—'}</td>
                <td className="px-3 py-2 text-slate-700">{formatNumber(period.summary_ev_amount)}</td>
                <td className="px-3 py-2 text-slate-700">{formatNumber(period.summary_weighted_progress)}%</td>
                <td className="px-3 py-2">
                  <StatusBadge status={period.status_code} />
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    {canClose ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onClose(period);
                        }}
                        disabled={busyId === `close:${period.id}` || isClosed}
                        className="rounded-lg border border-emerald-300 bg-white px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyId === `close:${period.id}` ? 'Cerrando...' : 'Cerrar'}
                      </button>
                    ) : null}

                    {canReopen ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onReopen(period);
                        }}
                        disabled={busyId === `reopen:${period.id}` || !isClosed}
                        className="rounded-lg border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyId === `reopen:${period.id}` ? 'Reabriendo...' : 'Reabrir'}
                      </button>
                    ) : null}

                    {canDelete ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(period);
                        }}
                        disabled={busyId === `delete:${period.id}` || isClosed}
                        className="rounded-lg border border-rose-300 bg-white px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyId === `delete:${period.id}` ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    ) : null}
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

function SnapshotDetail({ period, snapshots, loading }) {
  if (loading) {
    return <InlineAlert tone="info">Cargando detalle del snapshot...</InlineAlert>;
  }

  if (!period) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        Selecciona un snapshot financiero para revisar su detalle.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Actividades" value={period.summary_activity_count || 0} helper="Actividades incluidas" tone="slate" />
        <MetricCard label="EV" value={formatNumber(period.summary_ev_amount)} helper="EV monetario acumulado" tone="emerald" />
        <MetricCard label="Avance" value={`${formatNumber(period.summary_weighted_progress)}%`} helper="Avance ponderado" tone="blue" />
        <MetricCard label="Completadas" value={period.summary_completed_activities || 0} helper="Actividades completas" tone="amber" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        <div><strong>Periodo:</strong> {period.period_code} · {period.name}</div>
        <div className="mt-1"><strong>Rango:</strong> {period.start_date} → {period.end_date}</div>
        <div className="mt-1"><strong>Snapshot:</strong> {period.snapshot_date || '—'}</div>
        <div className="mt-1"><strong>Estado:</strong> {period.status_code || '—'}</div>
        {period.close_notes ? <div className="mt-1"><strong>Notas:</strong> {period.close_notes}</div> : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">WBS</th>
              <th className="px-3 py-2 text-left font-medium">Actividad</th>
              <th className="px-3 py-2 text-left font-medium">Inicio</th>
              <th className="px-3 py-2 text-left font-medium">Fin</th>
              <th className="px-3 py-2 text-left font-medium">HH</th>
              <th className="px-3 py-2 text-left font-medium">Costo</th>
              <th className="px-3 py-2 text-left font-medium">LB HH</th>
              <th className="px-3 py-2 text-left font-medium">LB Costo</th>
              <th className="px-3 py-2 text-left font-medium">Progreso</th>
              <th className="px-3 py-2 text-left font-medium">EV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {snapshots.length ? snapshots.map((snapshot) => (
              <tr key={snapshot.id}>
                <td className="px-3 py-2 text-slate-600">{snapshot.wbs_code || '—'}</td>
                <td className="px-3 py-2 text-slate-700">
                  <div className="font-medium text-slate-800">{snapshot.activity_code || '—'}</div>
                  <div className="text-xs text-slate-500">{snapshot.activity_name || '—'}</div>
                </td>
                <td className="px-3 py-2 text-slate-600">{snapshot.start_date || '—'}</td>
                <td className="px-3 py-2 text-slate-600">{snapshot.end_date || '—'}</td>
                <td className="px-3 py-2 text-slate-700">{formatNumber(snapshot.budget_hours)}</td>
                <td className="px-3 py-2 text-slate-700">{formatNumber(snapshot.budget_cost)}</td>
                <td className="px-3 py-2 text-slate-700">{formatNumber(snapshot.baseline_budget_hours)}</td>
                <td className="px-3 py-2 text-slate-700">{formatNumber(snapshot.baseline_budget_cost)}</td>
                <td className="px-3 py-2 text-slate-700">{formatNumber(snapshot.progress_percent)}%</td>
                <td className="px-3 py-2 text-slate-700">{formatNumber(snapshot.ev_amount)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-sm text-slate-500">
                  Este snapshot no tiene actividades congeladas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function resolveFlag(primaryValue, fallbackValue = false) {
  return typeof primaryValue === 'boolean' ? primaryValue : Boolean(fallbackValue);
}

export default function ControlPeriodsPage({
  activeProject,
  canCreate = false,
  canClose = false,
  canReopen = false,
  canDelete = false,
  permissions,
}) {
  const [definitionForm, setDefinitionForm] = useState(EMPTY_DEFINITION_FORM);
  const effectiveCanCreate = resolveFlag(canCreate, permissions?.controlPeriods?.create);
  const effectiveCanClose = resolveFlag(canClose, permissions?.controlPeriods?.close);
  const effectiveCanReopen = resolveFlag(canReopen, permissions?.controlPeriods?.reopen);
  const effectiveCanDelete = resolveFlag(canDelete, permissions?.controlPeriods?.delete);
  const [editingDefinitionId, setEditingDefinitionId] = useState('');
  const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [detail, setDetail] = useState({ period: null, snapshots: [] });
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');

  const {
    periods,
    financialPeriods,
    loading,
    definitionsLoading,
    error,
    definitionsError,
    reloadPeriods,
    reloadFinancialPeriods,
    loadPeriodDetail,
    nextPendingFinancialPeriod,
  } = useControlPeriods(activeProject?.id);

  useEffect(() => {
    setDefinitionForm(EMPTY_DEFINITION_FORM);
    setEditingDefinitionId('');
    setSelectedDefinitionId('');
    setSelectedPeriodId('');
    setDetail({ period: null, snapshots: [] });
    setPageError('');
    setPageSuccess('');
  }, [activeProject?.id]);

  useEffect(() => {
    if (!financialPeriods.length) {
      setSelectedDefinitionId('');
      return;
    }

    const preferred = getPreferredFinancialPeriodId(activeProject?.id);
    const candidate = financialPeriods.some((item) => item.id === preferred)
      ? preferred
      : nextPendingFinancialPeriod?.id || financialPeriods[0].id;

    setSelectedDefinitionId((current) => (
      current && financialPeriods.some((item) => item.id === current) ? current : candidate
    ));
  }, [activeProject?.id, financialPeriods, nextPendingFinancialPeriod]);

  useEffect(() => {
    if (!periods.length) {
      setSelectedPeriodId('');
      setDetail({ period: null, snapshots: [] });
      return;
    }

    if (!selectedPeriodId || !periods.some((item) => item.id === selectedPeriodId)) {
      setSelectedPeriodId(periods[0].id);
    }
  }, [periods, selectedPeriodId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedDetail() {
      if (!selectedPeriodId) {
        setDetail({ period: null, snapshots: [] });
        return;
      }

      setDetailLoading(true);
      try {
        const response = await loadPeriodDetail(selectedPeriodId);
        if (!cancelled) {
          setDetail({
            period: response?.period || null,
            snapshots: Array.isArray(response?.snapshots) ? response.snapshots : [],
          });
        }
      } catch (requestError) {
        if (!cancelled) {
          setDetail({ period: null, snapshots: [] });
          setPageError(getErrorMessage(requestError, 'No se pudo cargar el detalle del periodo financiero.'));
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    loadSelectedDetail();
    return () => {
      cancelled = true;
    };
  }, [loadPeriodDetail, selectedPeriodId]);

  const summary = useMemo(() => ({
    totalDefinitions: financialPeriods.length,
    pendingDefinitions: financialPeriods.filter((item) => !item.has_snapshot).length,
    capturedDefinitions: financialPeriods.filter((item) => item.has_snapshot).length,
    totalSnapshots: periods.length,
  }), [financialPeriods, periods]);

  const handleDefinitionFormChange = useCallback((field, value) => {
    setDefinitionForm((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (field === 'cutoff_date' && !next.end_date) {
        next.end_date = value;
      }

      if (field === 'start_date' || field === 'cutoff_date') {
        const generatedCode = derivePeriodCode(
          field === 'start_date' ? value : next.start_date,
          field === 'cutoff_date' ? value : next.cutoff_date,
        );

        const currentDerivedCode = derivePeriodCode(current.start_date, current.cutoff_date);
        if (!current.period_code || current.period_code === currentDerivedCode) {
          next.period_code = generatedCode;
        }
      }

      return next;
    });
  }, []);

  const handleEditDefinition = useCallback((definition) => {
    setEditingDefinitionId(definition.id);
    setDefinitionForm({
      period_code: definition.period_code || '',
      name: definition.name || '',
      start_date: definition.start_date || '',
      cutoff_date: definition.cutoff_date || '',
      end_date: definition.end_date || '',
    });
    setSelectedDefinitionId(definition.id);
    setPageError('');
    setPageSuccess('');
  }, []);

  const resetDefinitionForm = useCallback(() => {
    setEditingDefinitionId('');
    setDefinitionForm(EMPTY_DEFINITION_FORM);
  }, []);

  const handleSelectDefinition = useCallback((definitionId) => {
    setSelectedDefinitionId(definitionId);
    setPreferredFinancialPeriodId(activeProject?.id, definitionId);
  }, [activeProject?.id]);

  const handleCreateOrUpdateDefinition = useCallback(async () => {
    if (!activeProject?.id) return;

    setPageError('');
    setPageSuccess('');
    setBusyId(editingDefinitionId ? 'update-definition' : 'create-definition');

    try {
      if (editingDefinitionId) {
        await controlPeriodsApi.updateDefinition(editingDefinitionId, {
          project_id: activeProject.id,
          ...definitionForm,
        });
        setPageSuccess('Periodo financiero actualizado correctamente.');
      } else {
        const created = await controlPeriodsApi.createDefinition({
          project_id: activeProject.id,
          ...definitionForm,
        });
        setPageSuccess('Periodo financiero creado correctamente.');
        if (created?.id) {
          setSelectedDefinitionId(created.id);
        }
      }

      resetDefinitionForm();
      await reloadFinancialPeriods();
    } catch (requestError) {
      setPageError(getErrorMessage(requestError, 'No se pudo guardar la definición del periodo financiero.'));
    } finally {
      setBusyId('');
    }
  }, [activeProject?.id, definitionForm, editingDefinitionId, reloadFinancialPeriods, resetDefinitionForm]);

  const handleDeleteDefinition = useCallback(async (definition) => {
    if (!window.confirm(`¿Eliminar el periodo financiero "${definition.period_code}"?`)) return;

    setPageError('');
    setPageSuccess('');
    setBusyId(`delete-definition:${definition.id}`);

    try {
      await controlPeriodsApi.deleteDefinition(definition.id);
      if (selectedDefinitionId === definition.id) {
        setSelectedDefinitionId('');
      }
      setPageSuccess('Periodo financiero eliminado correctamente.');
      await reloadFinancialPeriods();
    } catch (requestError) {
      setPageError(getErrorMessage(requestError, 'No se pudo eliminar el periodo financiero.'));
    } finally {
      setBusyId('');
    }
  }, [reloadFinancialPeriods, selectedDefinitionId]);

  const handleClosePeriod = useCallback(async (period) => {
    setPageError('');
    setPageSuccess('');
    setBusyId(`close:${period.id}`);

    try {
      const response = await controlPeriodsApi.close(period.id, {
        snapshot_date: period.snapshot_date || period.financial_period?.cutoff_date || period.end_date,
        close_notes: period.close_notes || '',
      });

      setPageSuccess('Snapshot cerrado y recalculado correctamente.');
      await Promise.all([reloadFinancialPeriods(), reloadPeriods()]);

      if (response?.period?.id) {
        setSelectedPeriodId(response.period.id);
      }
    } catch (requestError) {
      setPageError(getErrorMessage(requestError, 'No se pudo cerrar el snapshot del periodo financiero.'));
    } finally {
      setBusyId('');
    }
  }, [reloadFinancialPeriods, reloadPeriods]);

  const handleReopenPeriod = useCallback(async (period) => {
    setPageError('');
    setPageSuccess('');
    setBusyId(`reopen:${period.id}`);

    try {
      const response = await controlPeriodsApi.reopen(period.id, {
        close_notes: period.close_notes || '',
      });

      setPageSuccess('Snapshot reabierto correctamente.');
      await Promise.all([reloadFinancialPeriods(), reloadPeriods()]);

      if (response?.period?.id) {
        setSelectedPeriodId(response.period.id);
      }
    } catch (requestError) {
      setPageError(getErrorMessage(requestError, 'No se pudo reabrir el snapshot del periodo financiero.'));
    } finally {
      setBusyId('');
    }
  }, [reloadFinancialPeriods, reloadPeriods]);

  const handleDeletePeriod = useCallback(async (period) => {
    if (!window.confirm(`¿Eliminar el snapshot del periodo financiero "${period.period_code}"?`)) return;

    setPageError('');
    setPageSuccess('');
    setBusyId(`delete:${period.id}`);

    try {
      await controlPeriodsApi.remove(period.id);

      if (selectedPeriodId === period.id) {
        setSelectedPeriodId('');
      }

      setPageSuccess('Snapshot eliminado correctamente.');
      await Promise.all([reloadFinancialPeriods(), reloadPeriods()]);
    } catch (requestError) {
      setPageError(getErrorMessage(requestError, 'No se pudo eliminar el snapshot del periodo financiero.'));
    } finally {
      setBusyId('');
    }
  }, [reloadFinancialPeriods, reloadPeriods, selectedPeriodId]);

  if (!activeProject?.id) {
    return (
      <SectionCard title="Periodos financieros" description="Selecciona un proyecto para definir sus periodos financieros.">
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          No hay un proyecto activo seleccionado.
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <InlineAlert tone="warning">{error}</InlineAlert> : null}
      {definitionsError ? <InlineAlert tone="warning">{definitionsError}</InlineAlert> : null}
      {pageError ? <InlineAlert tone="warning">{pageError}</InlineAlert> : null}
      {pageSuccess ? <InlineAlert tone="success">{pageSuccess}</InlineAlert> : null}
      {definitionsLoading ? <InlineAlert tone="info">Actualizando definiciones de periodos financieros...</InlineAlert> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Definidos" value={summary.totalDefinitions} helper="Periodos financieros del proyecto" tone="blue" />
        <MetricCard label="Pendientes" value={summary.pendingDefinitions} helper="Periodos sin snapshot todavía" tone="amber" />
        <MetricCard label="Capturados" value={summary.capturedDefinitions} helper="Periodos ya congelados" tone="emerald" />
        <MetricCard label="Snapshots" value={summary.totalSnapshots} helper="Histórico registrado" tone="slate" />
      </div>

      <SectionCard
        title="Definición de periodos financieros"
        description="Configura previamente las fechas de corte del proyecto. Una vez definido el periodo, podrá seleccionarse desde Actividades y usarse para capturar el snapshot financiero."
      >
        <div className="grid gap-3 md:grid-cols-5">
          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Código</span>
            <input
              value={definitionForm.period_code}
              onChange={(event) => handleDefinitionFormChange('period_code', event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="PF-01"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Nombre</span>
            <input
              value={definitionForm.name}
              onChange={(event) => handleDefinitionFormChange('name', event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Semana 01"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Inicio</span>
            <input
              type="date"
              value={definitionForm.start_date}
              onChange={(event) => handleDefinitionFormChange('start_date', event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Fecha de corte</span>
            <input
              type="date"
              value={definitionForm.cutoff_date}
              onChange={(event) => handleDefinitionFormChange('cutoff_date', event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>

          <label className="space-y-1 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Fin</span>
            <input
              type="date"
              value={definitionForm.end_date}
              onChange={(event) => handleDefinitionFormChange('end_date', event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCreateOrUpdateDefinition}
            disabled={!effectiveCanCreate || busyId === 'create-definition' || busyId === 'update-definition'}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {busyId === 'create-definition' || busyId === 'update-definition'
              ? 'Guardando...'
              : editingDefinitionId
                ? 'Actualizar periodo financiero'
                : 'Crear periodo financiero'}
          </button>

          {editingDefinitionId ? (
            <button
              type="button"
              onClick={resetDefinitionForm}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar edición
            </button>
          ) : null}
        </div>

        <div className="mt-4">
          <FinancialPeriodsTable
            financialPeriods={financialPeriods}
            selectedId={selectedDefinitionId}
            onSelect={handleSelectDefinition}
            onEdit={handleEditDefinition}
            onDelete={handleDeleteDefinition}
            canManage={effectiveCanCreate}
            canDelete={effectiveCanDelete}
            busyId={busyId}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Captura del periodo financiero"
        description="El guardado del snapshot financiero se realiza desde la pestaña Actividades, usando el periodo financiero seleccionado para el reporte semanal."
      >
        <InlineAlert tone="info">
          Usa la pestaña <strong>Actividades</strong> para seleccionar el periodo financiero, actualizar el avance acumulado y guardar el snapshot con el EV monetario del periodo.
        </InlineAlert>
      </SectionCard>

      <SectionCard
        title="Snapshots registrados"
        description="Revisa el histórico congelado del proyecto. Los snapshots cerrados se pueden reabrir para correcciones antes de volver a cerrarse."
      >
        {loading ? <InlineAlert tone="info" className="mb-3">Cargando snapshots...</InlineAlert> : null}
        <SnapshotsTable
          periods={periods}
          selectedId={selectedPeriodId}
          onSelect={setSelectedPeriodId}
          onClose={handleClosePeriod}
          onReopen={handleReopenPeriod}
          onDelete={handleDeletePeriod}
          canClose={effectiveCanClose}
          canReopen={effectiveCanReopen}
          canDelete={effectiveCanDelete}
          busyId={busyId}
        />
      </SectionCard>

      <SectionCard
        title="Detalle del snapshot seleccionado"
        description="Visor del avance, presupuesto y EV congelados para el periodo financiero elegido."
      >
        <SnapshotDetail period={detail.period} snapshots={detail.snapshots} loading={detailLoading} />
      </SectionCard>
    </div>
  );
}
