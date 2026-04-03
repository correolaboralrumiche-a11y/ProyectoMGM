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

const EMPTY_CAPTURE_FORM = {
  financial_period_id: '',
  snapshot_date: '',
  close_notes: '',
};

function formatNumber(value) {
  const numeric = Number(value || 0);
  return numeric.toLocaleString('es-PE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function derivePeriodCode(startDate, cutoffDate) {
  if (!startDate || !cutoffDate) return '';
  return `${String(startDate).replaceAll('-', '')}_${String(cutoffDate).replaceAll('-', '')}`;
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
  const normalized = String(status || '').trim().toLowerCase();
  const tones = {
    open: 'border-blue-200 bg-blue-50 text-blue-700',
    reopened: 'border-amber-200 bg-amber-50 text-amber-700',
    closed: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  const labels = {
    open: 'Abierto',
    reopened: 'Reabierto',
    closed: 'Cerrado',
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tones[normalized] || 'border-slate-200 bg-slate-50 text-slate-700'}`}>
      {labels[normalized] || status || 'N/D'}
    </span>
  );
}

function DefinitionStatusBadge({ hasSnapshot }) {
  return hasSnapshot ? (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      Con snapshot
    </span>
  ) : (
    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
      Pendiente
    </span>
  );
}

function MetricCard({ label, value, helper, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-800',
    blue: 'border-blue-200 bg-blue-50 text-blue-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {helper ? <div className="mt-1 text-xs opacity-80">{helper}</div> : null}
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
    return <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Aún no hay periodos financieros definidos para este proyecto.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Nombre</th>
            <th className="px-3 py-2">Inicio</th>
            <th className="px-3 py-2">Corte</th>
            <th className="px-3 py-2">Fin</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {financialPeriods.map((period) => {
            const selected = selectedId === period.id;
            const deleting = busyId === `delete-definition:${period.id}`;
            return (
              <tr
                key={period.id}
                className={selected ? 'bg-blue-50/70' : 'hover:bg-slate-50'}
                onClick={() => onSelect(period.id)}
              >
                <td className="px-3 py-2 font-medium text-slate-900">{period.period_code}</td>
                <td className="px-3 py-2 text-slate-700">{period.name}</td>
                <td className="px-3 py-2 text-slate-700">{period.start_date}</td>
                <td className="px-3 py-2 text-slate-700">{period.cutoff_date}</td>
                <td className="px-3 py-2 text-slate-700">{period.end_date}</td>
                <td className="px-3 py-2"><DefinitionStatusBadge hasSnapshot={period.has_snapshot} /></td>
                <td className="px-3 py-2 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(period);
                      }}
                      disabled={!canManage || period.has_snapshot || busyId}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(period);
                      }}
                      disabled={!canDelete || period.has_snapshot || deleting || busyId}
                    >
                      {deleting ? 'Eliminando...' : 'Eliminar'}
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
    return <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Aún no hay snapshots de periodos financieros registrados para este proyecto.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">Código</th>
            <th className="px-3 py-2">Nombre</th>
            <th className="px-3 py-2">Fecha snapshot</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2">Actividades</th>
            <th className="px-3 py-2 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {periods.map((period) => {
            const selected = selectedId === period.id;
            const closing = busyId === `close:${period.id}`;
            const reopening = busyId === `reopen:${period.id}`;
            const deleting = busyId === `delete:${period.id}`;
            const isEditable = ['open', 'reopened'].includes(period.status_code);

            return (
              <tr
                key={period.id}
                className={selected ? 'bg-blue-50/70' : 'hover:bg-slate-50'}
                onClick={() => onSelect(period.id)}
              >
                <td className="px-3 py-2 font-medium text-slate-900">{period.period_code}</td>
                <td className="px-3 py-2 text-slate-700">{period.name}</td>
                <td className="px-3 py-2 text-slate-700">{period.snapshot_date || '—'}</td>
                <td className="px-3 py-2"><StatusBadge status={period.status_code} /></td>
                <td className="px-3 py-2 text-slate-700">{formatNumber(period.summary_activity_count)}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {isEditable ? (
                      <button
                        type="button"
                        className="rounded-lg border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                        onClick={(event) => {
                          event.stopPropagation();
                          onClose(period);
                        }}
                        disabled={!canClose || closing || busyId}
                      >
                        {closing ? 'Cerrando...' : 'Cerrar'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="rounded-lg border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                        onClick={(event) => {
                          event.stopPropagation();
                          onReopen(period);
                        }}
                        disabled={!canReopen || reopening || busyId}
                      >
                        {reopening ? 'Reabriendo...' : 'Reabrir'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="rounded-lg border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(period);
                      }}
                      disabled={!canDelete || period.status_code === 'closed' || deleting || busyId}
                    >
                      {deleting ? 'Eliminando...' : 'Eliminar'}
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

function SnapshotsTableDetail({ snapshots }) {
  if (!snapshots.length) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">La fotografía de actividades aparecerá cuando captures el periodo financiero.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2">WBS</th>
            <th className="px-3 py-2">Actividad</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2 text-right">Avance</th>
            <th className="px-3 py-2 text-right">HH Ppto</th>
            <th className="px-3 py-2 text-right">Costo Ppto</th>
            <th className="px-3 py-2 text-right">LB Costo</th>
            <th className="px-3 py-2 text-right">EV</th>
            <th className="px-3 py-2">Rango</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {snapshots.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-3 py-2 text-slate-700">{item.wbs_code || '—'} {item.wbs_name ? `· ${item.wbs_name}` : ''}</td>
              <td className="px-3 py-2 text-slate-700">{item.activity_code || '—'} {item.activity_name ? `· ${item.activity_name}` : ''}</td>
              <td className="px-3 py-2 text-slate-700">{item.status_code || '—'}</td>
              <td className="px-3 py-2 text-right text-slate-700">{formatNumber(item.progress_percent)}%</td>
              <td className="px-3 py-2 text-right text-slate-700">{formatNumber(item.budget_hours)}</td>
              <td className="px-3 py-2 text-right text-slate-700">{formatNumber(item.budget_cost)}</td>
              <td className="px-3 py-2 text-right text-slate-700">{formatNumber(item.baseline_budget_cost)}</td>
              <td className="px-3 py-2 text-right text-slate-700">{formatNumber(item.ev_amount)}</td>
              <td className="px-3 py-2 text-slate-700">{item.start_date || '—'} → {item.end_date || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ControlPeriodsPage({
  activeProject,
  canCreate = false,
  canClose = false,
  canReopen = false,
  canDelete = false,
}) {
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

  const [definitionForm, setDefinitionForm] = useState(EMPTY_DEFINITION_FORM);
  const [captureForm, setCaptureForm] = useState(EMPTY_CAPTURE_FORM);
  const [editingDefinitionId, setEditingDefinitionId] = useState('');
  const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [detail, setDetail] = useState({ period: null, snapshots: [] });
  const [detailLoading, setDetailLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');
  const [busyId, setBusyId] = useState('');

  useEffect(() => {
    setDefinitionForm(EMPTY_DEFINITION_FORM);
    setCaptureForm(EMPTY_CAPTURE_FORM);
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
      setCaptureForm((current) => ({ ...current, financial_period_id: '', snapshot_date: '' }));
      return;
    }

    const preferred = getPreferredFinancialPeriodId(activeProject?.id);
    const candidate = financialPeriods.some((item) => item.id === preferred)
      ? preferred
      : nextPendingFinancialPeriod?.id || financialPeriods[0].id;

    setSelectedDefinitionId((current) => (current && financialPeriods.some((item) => item.id === current) ? current : candidate));
  }, [activeProject?.id, financialPeriods, nextPendingFinancialPeriod]);

  useEffect(() => {
    const selected = financialPeriods.find((item) => item.id === selectedDefinitionId) || null;
    setPreferredFinancialPeriodId(activeProject?.id, selected?.id || '');
    setCaptureForm((current) => {
      const sameSelection = current.financial_period_id === (selected?.id || '');
      return {
        ...current,
        financial_period_id: selected?.id || '',
        snapshot_date: sameSelection && current.snapshot_date ? current.snapshot_date : selected?.cutoff_date || '',
      };
    });
  }, [activeProject?.id, financialPeriods, selectedDefinitionId]);

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

  const summary = useMemo(() => {
    const totalDefinitions = financialPeriods.length;
    const pendingDefinitions = financialPeriods.filter((item) => !item.has_snapshot).length;
    const capturedDefinitions = financialPeriods.filter((item) => item.has_snapshot).length;
    const totalSnapshots = periods.length;

    return {
      totalDefinitions,
      pendingDefinitions,
      capturedDefinitions,
      totalSnapshots,
    };
  }, [financialPeriods, periods]);

  const selectedDefinition = financialPeriods.find((item) => item.id === selectedDefinitionId) || null;
  const selectedPeriod = detail.period || periods.find((item) => item.id === selectedPeriodId) || null;

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

        if (!current.period_code || current.period_code === derivePeriodCode(current.start_date, current.cutoff_date)) {
          next.period_code = generatedCode;
        }
      }

      return next;
    });
  }, []);

  const handleCaptureFormChange = useCallback((field, value) => {
    setCaptureForm((current) => ({ ...current, [field]: value }));
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

  const handleCaptureSnapshot = useCallback(async () => {
    if (!activeProject?.id || !captureForm.financial_period_id) return;

    setPageError('');
    setPageSuccess('');
    setBusyId('capture');

    try {
      const response = await controlPeriodsApi.capture({
        project_id: activeProject.id,
        financial_period_id: captureForm.financial_period_id,
        snapshot_date: captureForm.snapshot_date,
        close_notes: captureForm.close_notes,
      });

      setPageSuccess('Snapshot del periodo financiero guardado correctamente.');
      setCaptureForm((current) => ({ ...current, close_notes: '' }));
      await Promise.all([reloadFinancialPeriods(), reloadPeriods()]);
      if (response?.period?.id) {
        setSelectedPeriodId(response.period.id);
      }
    } catch (requestError) {
      setPageError(getErrorMessage(requestError, 'No se pudo capturar el periodo financiero.'));
    } finally {
      setBusyId('');
    }
  }, [activeProject?.id, captureForm, reloadFinancialPeriods, reloadPeriods]);

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
            disabled={!canCreate || busyId === 'create-definition' || busyId === 'update-definition'}
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
            canManage={canCreate}
            canDelete={canDelete}
            busyId={busyId}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Captura del periodo financiero"
        description="El guardado del snapshot financiero ahora se realiza desde la pestaña Actividades, usando el periodo financiero seleccionado para el reporte semanal."
      >
        <InlineAlert tone="info">
          Usa la pestaña <strong>Actividades</strong> para seleccionar el periodo financiero, actualizar el avance acumulado y guardar el snapshot con el EV monetario del periodo.
        </InlineAlert>
      </SectionCard>

      <SectionCard title="Snapshots registrados" description="Revisa el histórico congelado del proyecto. Los snapshots cerrados se pueden reabrir para correcciones antes de volver a cerrarse.">
        {loading ? <InlineAlert tone="info" className="mb-3">Cargando snapshots...</InlineAlert> : null}
        <SnapshotsTable
          periods={periods}
          selectedId={selectedPeriodId}
          onSelect={setSelectedPeriodId}
          onClose={handleClosePeriod}
          onReopen={handleReopenPeriod}
          onDelete={handleDeletePeriod}
          canClose={canClose}
          canReopen={canReopen}
          canDelete={canDelete}
          busyId={busyId}
        />
      </SectionCard>

      <SectionCard
        title="Detalle del snapshot seleccionado"
        description="Visor del avance, presupuesto y EV congelados para el periodo financiero elegido."
      >
        {detailLoading ? <InlineAlert tone="info" className="mb-3">Cargando detalle del snapshot...</InlineAlert> : null}

        {selectedPeriod ? (
          <div className="mb-4 grid gap-4 md:grid-cols-4">
            <MetricCard label="Código" value={selectedPeriod.period_code} helper={selectedPeriod.name} tone="blue" />
            <MetricCard label="Fecha snapshot" value={selectedPeriod.snapshot_date || '—'} helper={selectedPeriod.financial_period?.cutoff_date ? `Corte: ${selectedPeriod.financial_period.cutoff_date}` : 'Sin fecha de corte'} tone="slate" />
            <MetricCard label="Avance ponderado" value={`${formatNumber(selectedPeriod.summary_weighted_progress)}%`} helper="Avance acumulado congelado" tone="amber" />
            <MetricCard label="EV acumulado" value={formatNumber(selectedPeriod.summary_ev_amount)} helper="Valor ganado monetario congelado" tone="emerald" />
          </div>
        ) : null}

        <SnapshotsTableDetail snapshots={detail.snapshots} />
      </SectionCard>
    </div>
  );
}
