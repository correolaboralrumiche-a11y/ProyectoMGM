import { useCallback, useEffect, useMemo, useState } from 'react';
import InlineAlert from '../components/common/InlineAlert.jsx';
import DataTable from '../components/activities/DataTable.jsx';
import { activitiesApi } from '../services/activitiesApi.js';
import { catalogsApi } from '../services/catalogsApi.js';
import { controlPeriodsApi } from '../services/controlPeriodsApi.js';
import { useBaselines } from '../hooks/useBaselines.js';
import { useControlPeriods } from '../hooks/useControlPeriods.js';
import { getErrorMessage } from '../utils/error.js';
import { buildActivityRows, getTreeSignature } from '../utils/tree.js';

function formatNumber(value, digits = 0) {
  const numericValue = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(numericValue);
}

function formatCurrency(value) {
  const numericValue = Number(value || 0);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericValue);
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

function getColumnSettingsStorageKey(projectId) {
  return projectId ? `erp:activities-column-settings:${projectId}` : 'erp:activities-column-settings:default';
}

function getInitialSnapshotDate(financialPeriods, periodId) {
  const selected = financialPeriods.find((item) => item.id === periodId) || null;
  return selected?.cutoff_date || '';
}

function useActivityCatalogs() {
  const [catalogOptions, setCatalogOptions] = useState({
    statuses: [],
    activityTypes: [],
    priorities: [],
    disciplines: [],
  });
  const [catalogError, setCatalogError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogs() {
      try {
        const [statuses, activityTypes, priorities, disciplines] = await Promise.all([
          catalogsApi.get('activity-statuses', { includeInactive: false }),
          catalogsApi.get('activity-types', { includeInactive: false }),
          catalogsApi.get('activity-priorities', { includeInactive: false }),
          catalogsApi.get('disciplines', { includeInactive: false }),
        ]);

        if (!cancelled) {
          setCatalogOptions({
            statuses: Array.isArray(statuses?.items) ? statuses.items : [],
            activityTypes: Array.isArray(activityTypes?.items) ? activityTypes.items : [],
            priorities: Array.isArray(priorities?.items) ? priorities.items : [],
            disciplines: Array.isArray(disciplines?.items) ? disciplines.items : [],
          });
          setCatalogError('');
        }
      } catch (error) {
        if (!cancelled) {
          setCatalogError(getErrorMessage(error, 'No se pudieron cargar los catálogos de actividades.'));
        }
      }
    }

    loadCatalogs();

    return () => {
      cancelled = true;
    };
  }, []);

  return { catalogOptions, catalogError };
}

function useLatestBaselineActivities(activeProjectId, latestBaseline, loadBaselineDetail) {
  const [baselineActivities, setBaselineActivities] = useState([]);
  const [baselineDetailLoading, setBaselineDetailLoading] = useState(false);
  const [baselineDetailError, setBaselineDetailError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadLatestBaselineDetail() {
      if (!activeProjectId || !latestBaseline?.id) {
        setBaselineActivities([]);
        setBaselineDetailLoading(false);
        setBaselineDetailError('');
        return;
      }

      setBaselineDetailLoading(true);
      try {
        const detail = await loadBaselineDetail(latestBaseline.id);
        if (!cancelled) {
          setBaselineActivities(Array.isArray(detail?.activities) ? detail.activities : []);
          setBaselineDetailError('');
        }
      } catch (error) {
        if (!cancelled) {
          setBaselineActivities([]);
          setBaselineDetailError(getErrorMessage(error, 'No se pudo cargar el detalle de la línea base.'));
        }
      } finally {
        if (!cancelled) {
          setBaselineDetailLoading(false);
        }
      }
    }

    loadLatestBaselineDetail();

    return () => {
      cancelled = true;
    };
  }, [activeProjectId, latestBaseline?.id, loadBaselineDetail]);

  return { baselineActivities, baselineDetailLoading, baselineDetailError };
}

function MetricCard({ label, value, helper, accent = 'default' }) {
  const accentClass = {
    default: 'border-slate-200 bg-white',
    brand: 'border-sky-200 bg-sky-50/80',
    success: 'border-emerald-200 bg-emerald-50/80',
    warning: 'border-amber-200 bg-amber-50/80',
  }[accent] || 'border-slate-200 bg-white';

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${accentClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{value}</div>
      {helper ? <div className="mt-1 text-xs text-slate-500">{helper}</div> : null}
    </div>
  );
}

function BaselineBanner({ latestBaseline, baselineLoading, baselineError }) {
  if (baselineLoading) {
    return <InlineAlert tone="info">Cargando línea base activa del proyecto...</InlineAlert>;
  }

  if (baselineError) {
    return <InlineAlert tone="warning">{baselineError}</InlineAlert>;
  }

  if (!latestBaseline) {
    return (
      <InlineAlert tone="warning">
        Este proyecto no tiene línea base registrada. Sin línea base, el EV monetario será 0 y las columnas LB se mostrarán vacías.
      </InlineAlert>
    );
  }

  return (
    <InlineAlert tone="success">
      Línea base visible: <strong>{latestBaseline.name}</strong>. El EV monetario se calcula como avance acumulado × presupuesto LB.
    </InlineAlert>
  );
}

function FinancialPeriodContext({
  activeProjectId,
  financialPeriods,
  loading,
  definitionsError,
  selectedId,
  onChange,
  snapshotDate,
  onSnapshotDateChange,
  closeNotes,
  onCloseNotesChange,
  onCapture,
  captureBusy,
  captureDisabled,
  captureHelper,
}) {
  const selected = useMemo(
    () => financialPeriods.find((item) => item.id === selectedId) || null,
    [financialPeriods, selectedId],
  );

  return (
    <section className="activity-surface rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Cierre financiero desde Actividades</h3>
          <p className="mt-1 text-xs text-slate-500">Etiqueta el reporte semanal y registra el snapshot operativo del proyecto activo.</p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Snapshot
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {definitionsError ? <InlineAlert tone="warning">{definitionsError}</InlineAlert> : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(220px,0.8fr)]">
          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Periodo financiero objetivo
            <select
              value={selectedId}
              onChange={(event) => onChange(event.target.value)}
              disabled={!activeProjectId || loading || !financialPeriods.length}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100"
            >
              {!financialPeriods.length ? <option value="">Sin periodos definidos</option> : null}
              {financialPeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {period.period_code} · {period.name}
                  {period.has_snapshot ? ' · Con snapshot' : ' · Disponible'}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Fecha snapshot
            <input
              type="date"
              value={snapshotDate}
              onChange={(event) => onSnapshotDateChange(event.target.value)}
              disabled={!selectedId}
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100"
            />
          </label>
        </div>

        {selected ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Periodo</div>
                <div className="mt-1 text-sm font-medium text-slate-800">
                  {selected.period_code} · {selected.name}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Rango</div>
                <div className="mt-1 text-sm text-slate-700">
                  {selected.start_date} → {selected.end_date}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Estado</div>
                <div className="mt-1 text-sm text-slate-700">
                  {selected.has_snapshot ? `Snapshot ${selected.snapshot_status_code || 'registrado'}` : 'Sin snapshot'}
                </div>
              </div>
            </div>

            <label className="mt-4 block space-y-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Notas del snapshot
              <textarea
                value={closeNotes}
                onChange={(event) => onCloseNotesChange(event.target.value)}
                rows={3}
                placeholder="Observaciones del cierre financiero"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-normal tracking-normal text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-500">{captureHelper}</div>
              <button
                type="button"
                onClick={onCapture}
                disabled={captureDisabled}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {captureBusy ? 'Guardando periodo financiero...' : 'Guardar periodo financiero'}
              </button>
            </div>
          </div>
        ) : (
          <InlineAlert tone="info">
            Define periodos financieros en la pestaña Periodos financieros para poder etiquetar el reporte semanal y guardar su snapshot.
          </InlineAlert>
        )}
      </div>
    </section>
  );
}

function ActivitiesWorkbenchSummary({ activeProject, rows, activities, latestBaseline, selectedFinancialPeriod }) {
  const wbsCount = useMemo(() => rows.filter((row) => row.type === 'wbs').length, [rows]);
  const totals = useMemo(() => {
    return activities.reduce(
      (accumulator, item) => {
        accumulator.hours += Number(item?.hours || 0);
        accumulator.cost += Number(item?.cost || 0);
        accumulator.ev += Number(item?.ev_amount || 0);
        accumulator.progress += Number(item?.progress || 0);
        return accumulator;
      },
      { hours: 0, cost: 0, ev: 0, progress: 0 },
    );
  }, [activities]);

  const averageProgress = activities.length ? totals.progress / activities.length : 0;

  return (
    <section className="activity-surface rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Centro operativo</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Actividades</h2>
            <p className="mt-1 text-sm text-slate-500">
              Hoja operativa principal del ERP para captura, edición y lectura tabular de avance, presupuesto y EV.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              Proyecto: {activeProject?.name || 'Sin nombre'}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              Estado: {activeProject?.status_name || activeProject?.status_code || 'No definido'}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              Periodo: {selectedFinancialPeriod?.period_code || 'No definido'}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="WBS" value={formatNumber(wbsCount)} helper="Nodos visibles en el árbol operativo" />
        <MetricCard label="Actividades" value={formatNumber(activities.length)} helper="Filas operativas del proyecto" accent="brand" />
        <MetricCard label="HH presupuesto" value={formatNumber(totals.hours, 2)} helper="Suma actual de horas plan" />
        <MetricCard label="Costo USD" value={formatCurrency(totals.cost)} helper="Costo operativo actualmente visible" />
        <MetricCard
          label="EV / avance"
          value={`${formatCurrency(totals.ev)} · ${formatNumber(averageProgress, 2)}%`}
          helper={latestBaseline ? `Línea base: ${latestBaseline.name}` : 'Sin línea base activa'}
          accent={latestBaseline ? 'success' : 'warning'}
        />
      </div>
    </section>
  );
}

export default function ActivitiesPage({ activeProject, tree, activities, reloadActivities }) {
  const [requestedCellId, setRequestedCellId] = useState(null);
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');
  const [captureBusy, setCaptureBusy] = useState(false);
  const [selectedFinancialPeriodId, setSelectedFinancialPeriodId] = useState('');
  const [snapshotDate, setSnapshotDate] = useState('');
  const [snapshotNotes, setSnapshotNotes] = useState('');

  const treeSignature = useMemo(() => getTreeSignature(tree), [tree]);
  const { latestBaseline, loading: baselinesLoading, error: baselinesError, loadBaselineDetail } = useBaselines(activeProject?.id);
  const { catalogOptions, catalogError } = useActivityCatalogs();
  const { baselineActivities, baselineDetailLoading, baselineDetailError } = useLatestBaselineActivities(
    activeProject?.id,
    latestBaseline,
    loadBaselineDetail,
  );
  const {
    financialPeriods,
    definitionsLoading,
    definitionsError,
    nextPendingFinancialPeriod,
    reloadFinancialPeriods,
    reloadPeriods,
  } = useControlPeriods(activeProject?.id);

  useEffect(() => {
    if (!activeProject?.id || !reloadActivities) return;
    reloadActivities().catch((error) => {
      console.error('No se pudo recargar actividades al cambiar el WBS', error);
    });
  }, [activeProject?.id, treeSignature, reloadActivities]);

  useEffect(() => {
    if (!activeProject?.id) {
      setSelectedFinancialPeriodId('');
      setSnapshotDate('');
      return;
    }

    const stored = getPreferredFinancialPeriodId(activeProject.id);
    const storedIsValid = stored && financialPeriods.some((item) => item.id === stored);
    const nextCandidate = storedIsValid ? stored : nextPendingFinancialPeriod?.id || financialPeriods[0]?.id || '';
    setSelectedFinancialPeriodId(nextCandidate);
    setSnapshotDate((current) => current || getInitialSnapshotDate(financialPeriods, nextCandidate));
  }, [activeProject?.id, financialPeriods, nextPendingFinancialPeriod]);

  const selectedFinancialPeriod = useMemo(
    () => financialPeriods.find((item) => item.id === selectedFinancialPeriodId) || null,
    [financialPeriods, selectedFinancialPeriodId],
  );

  useEffect(() => {
    if (!selectedFinancialPeriod) return;
    setSnapshotDate((current) => current || selectedFinancialPeriod.cutoff_date || '');
  }, [selectedFinancialPeriod]);

  const rows = useMemo(() => buildActivityRows(tree, activities, baselineActivities), [activities, baselineActivities, tree]);
  const columnSettingsKey = useMemo(() => getColumnSettingsStorageKey(activeProject?.id), [activeProject?.id]);

  const handleRequestedCellHandled = useCallback(() => {
    setRequestedCellId(null);
  }, []);

  const runActivityMutation = useCallback(async (action) => {
    setPageError('');
    setPageSuccess('');
    try {
      return await action();
    } catch (error) {
      const message = getErrorMessage(error, 'No se pudo completar la operación sobre actividades.');
      setPageError(message);
      throw error;
    }
  }, []);

  const handleFinancialPeriodChange = useCallback(
    (periodId) => {
      setSelectedFinancialPeriodId(periodId);
      setPreferredFinancialPeriodId(activeProject?.id, periodId);
      setSnapshotDate(getInitialSnapshotDate(financialPeriods, periodId));
      setPageError('');
      setPageSuccess('');
    },
    [activeProject?.id, financialPeriods],
  );

  const handleCaptureFinancialPeriod = useCallback(async () => {
    if (!activeProject?.id || !selectedFinancialPeriodId) return;

    setPageError('');
    setPageSuccess('');
    setCaptureBusy(true);

    try {
      const payload = {
        project_id: activeProject.id,
        financial_period_id: selectedFinancialPeriodId,
        snapshot_date: snapshotDate || selectedFinancialPeriod?.cutoff_date || '',
        close_notes: snapshotNotes,
      };

      await controlPeriodsApi.capture(payload);

      const [updatedDefinitions] = await Promise.all([reloadFinancialPeriods(), reloadPeriods()]);
      const nextSelection = Array.isArray(updatedDefinitions)
        ? updatedDefinitions.find((item) => !item.has_snapshot)?.id || ''
        : '';

      if (nextSelection) {
        setSelectedFinancialPeriodId(nextSelection);
        setPreferredFinancialPeriodId(activeProject.id, nextSelection);
        setSnapshotDate(getInitialSnapshotDate(updatedDefinitions, nextSelection));
      }

      setSnapshotNotes('');
      setPageSuccess('Periodo financiero guardado correctamente desde Actividades.');
    } catch (error) {
      setPageError(getErrorMessage(error, 'No se pudo guardar el periodo financiero.'));
    } finally {
      setCaptureBusy(false);
    }
  }, [
    activeProject?.id,
    reloadFinancialPeriods,
    reloadPeriods,
    selectedFinancialPeriod,
    selectedFinancialPeriodId,
    snapshotDate,
    snapshotNotes,
  ]);

  const handleAddActivity = useCallback(
    async (wbsNode) => {
      try {
        const created = await runActivityMutation(() =>
          activitiesApi.create({
            wbs_id: wbsNode.id,
            name: 'Nueva actividad',
            status_code: 'not_started',
            activity_type_code: 'task',
            priority_code: 'medium',
            discipline_code: 'general',
            progress: 0,
            hours: 0,
            cost: 0,
          }),
        );

        if (created?.id) {
          setRequestedCellId(`${created.id}:name`);
        }

        await reloadActivities();
      } catch {
        // Error manejado arriba.
      }
    },
    [reloadActivities, runActivityMutation],
  );

  const handleUpdateActivity = useCallback(
    async (activity, patch) => {
      try {
        await runActivityMutation(() => activitiesApi.update(activity.id, patch));
        await reloadActivities();
      } catch {
        // Error manejado arriba.
      }
    },
    [reloadActivities, runActivityMutation],
  );

  const handleDeleteActivity = useCallback(
    async (activity) => {
      if (!window.confirm(`¿Eliminar actividad "${activity.name}"?`)) return;
      try {
        await runActivityMutation(() => activitiesApi.remove(activity.id));
        await reloadActivities();
      } catch {
        // Error manejado arriba.
      }
    },
    [reloadActivities, runActivityMutation],
  );

  if (!activeProject?.id) {
    return (
      <section className="activity-empty-state rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl">📋</div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900">No hay un proyecto activo seleccionado</h2>
        <p className="mt-2 text-sm text-slate-500">Selecciona un proyecto en la pestaña Proyectos para abrir la hoja operativa de actividades.</p>
      </section>
    );
  }

  const captureHelper = !selectedFinancialPeriod
    ? ''
    : selectedFinancialPeriod.has_snapshot
      ? 'Este periodo ya tiene snapshot. Normalmente conviene escoger el siguiente periodo disponible.'
      : 'Se guardará el avance acumulado y el EV monetario del proyecto activo para este periodo.';

  const baselineBannerError = baselineDetailError || baselinesError;

  return (
    <div className="space-y-4">
      {pageError ? <InlineAlert tone="warning">{pageError}</InlineAlert> : null}
      {pageSuccess ? <InlineAlert tone="success">{pageSuccess}</InlineAlert> : null}
      {catalogError ? <InlineAlert tone="warning">{catalogError}</InlineAlert> : null}

      <ActivitiesWorkbenchSummary
        activeProject={activeProject}
        rows={rows}
        activities={activities}
        latestBaseline={latestBaseline}
        selectedFinancialPeriod={selectedFinancialPeriod}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.9fr)]">
        <section className="activity-surface rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Hoja operativa</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Edición directa tipo ERP sobre actividades, columnas LB y métricas monetarias visibles.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Alta densidad visual
              </div>
            </div>
          </div>

          <div className="px-4 py-4">
            <DataTable
              rows={rows}
              onAddActivity={handleAddActivity}
              onUpdateActivity={handleUpdateActivity}
              onDeleteActivity={handleDeleteActivity}
              requestedCellId={requestedCellId}
              onRequestedCellHandled={handleRequestedCellHandled}
              columnSettingsKey={columnSettingsKey}
              statusOptions={catalogOptions.statuses}
              activityTypeOptions={catalogOptions.activityTypes}
              priorityOptions={catalogOptions.priorities}
              disciplineOptions={catalogOptions.disciplines}
            />
          </div>
        </section>

        <div className="space-y-4">
          <FinancialPeriodContext
            activeProjectId={activeProject.id}
            financialPeriods={financialPeriods}
            loading={definitionsLoading}
            definitionsError={definitionsError}
            selectedId={selectedFinancialPeriodId}
            onChange={handleFinancialPeriodChange}
            snapshotDate={snapshotDate}
            onSnapshotDateChange={setSnapshotDate}
            closeNotes={snapshotNotes}
            onCloseNotesChange={setSnapshotNotes}
            onCapture={handleCaptureFinancialPeriod}
            captureBusy={captureBusy}
            captureDisabled={!selectedFinancialPeriodId || captureBusy}
            captureHelper={captureHelper}
          />

          <section className="activity-surface rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Contexto de línea base</h3>
            </div>
            <div className="space-y-3 px-4 py-4">
              <BaselineBanner
                latestBaseline={latestBaseline}
                baselineLoading={baselinesLoading || baselineDetailLoading}
                baselineError={baselineBannerError}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard
                  label="Actividades LB"
                  value={formatNumber(baselineActivities.length)}
                  helper="Registros capturados en la línea base activa"
                />
                <MetricCard
                  label="Periodo sugerido"
                  value={nextPendingFinancialPeriod?.period_code || '—'}
                  helper={nextPendingFinancialPeriod?.name || 'Todos los periodos tienen snapshot o no hay definición.'}
                  accent={nextPendingFinancialPeriod ? 'brand' : 'warning'}
                />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
