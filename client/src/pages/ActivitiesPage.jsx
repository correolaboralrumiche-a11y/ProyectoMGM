import { useCallback, useEffect, useMemo, useState } from 'react';
import SectionCard from '../components/common/SectionCard.jsx';
import InlineAlert from '../components/common/InlineAlert.jsx';
import DataTable from '../components/activities/DataTable.jsx';
import { activitiesApi } from '../services/activitiesApi.js';
import { catalogsApi } from '../services/catalogsApi.js';
import { controlPeriodsApi } from '../services/controlPeriodsApi.js';
import { useBaselines } from '../hooks/useBaselines.js';
import { useControlPeriods } from '../hooks/useControlPeriods.js';
import { getErrorMessage } from '../utils/error.js';
import { buildActivityRows, getTreeSignature } from '../utils/tree.js';

function BaselineBanner({ latestBaseline, baselineLoading, baselineError }) {
  if (latestBaseline) {
    return (
      <InlineAlert tone="info" className="mb-3">
        Línea Base visible: <strong>{latestBaseline.name}</strong>. El EV monetario se calcula como <strong>% avance acumulado × presupuesto LB</strong>.
      </InlineAlert>
    );
  }
  if (baselineLoading) {
    return <InlineAlert tone="info" className="mb-3">Cargando línea base...</InlineAlert>;
  }
  if (baselineError) {
    return <InlineAlert tone="warning" className="mb-3">{baselineError}</InlineAlert>;
  }
  return <InlineAlert tone="info" className="mb-3">Este proyecto no tiene línea base registrada. Sin línea base, el EV monetario será 0.</InlineAlert>;
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
    <SectionCard
      title="Periodo financiero del reporte"
      description="Selecciona el periodo financiero al que pertenece la actualización semanal y guarda aquí mismo la fotografía financiera del avance acumulado y del EV."
    >
      {definitionsError ? <InlineAlert tone="warning" className="mb-3">{definitionsError}</InlineAlert> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,340px),180px,minmax(0,1fr)]">
        <label className="space-y-2 text-sm text-slate-600">
          <span className="block font-medium text-slate-700">Periodo financiero objetivo</span>
          <select
            value={selectedId}
            onChange={(event) => onChange(event.target.value)}
            disabled={!activeProjectId || loading || !financialPeriods.length}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
          >
            {!financialPeriods.length ? <option value="">Sin periodos definidos</option> : null}
            {financialPeriods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.period_code} · {period.name}{period.has_snapshot ? ' · Con snapshot' : ' · Disponible'}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm text-slate-600">
          <span className="block font-medium text-slate-700">Fecha snapshot</span>
          <input
            type="date"
            value={snapshotDate}
            onChange={(event) => onSnapshotDateChange(event.target.value)}
            disabled={!selectedId}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
          />
        </label>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          {selected ? (
            <>
              <div className="font-medium text-slate-800">{selected.period_code} · {selected.name}</div>
              <div className="mt-2">Rango: <strong>{selected.start_date}</strong> → <strong>{selected.end_date}</strong></div>
              <div className="mt-1">Fecha de corte: <strong>{selected.cutoff_date}</strong></div>
              <div className="mt-1">Estado: <strong>{selected.has_snapshot ? `Snapshot ${selected.snapshot_status_code || 'registrado'}` : 'Sin snapshot'}</strong></div>
              <label className="mt-3 block space-y-2">
                <span className="block text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Notas del snapshot</span>
                <input
                  value={closeNotes}
                  onChange={(event) => onCloseNotesChange(event.target.value)}
                  placeholder="Observaciones del cierre financiero"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onCapture}
                  disabled={captureDisabled}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {captureBusy ? 'Guardando periodo financiero...' : 'Guardar periodo financiero'}
                </button>
              </div>
              {captureHelper ? <div className="mt-3 text-xs text-slate-500">{captureHelper}</div> : null}
            </>
          ) : (
            <div>
              Define periodos financieros en la pestaña <strong>Periodos financieros</strong> para poder etiquetar el reporte semanal y guardar su snapshot.
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

export default function ActivitiesPage({ activeProject, tree, activities, reloadActivities }) {
  const [requestedCellId, setRequestedCellId] = useState(null);
  const [baselineActivities, setBaselineActivities] = useState([]);
  const [baselineDetailLoading, setBaselineDetailLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [pageSuccess, setPageSuccess] = useState('');
  const [captureBusy, setCaptureBusy] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalogOptions, setCatalogOptions] = useState({
    statuses: [],
    activityTypes: [],
    priorities: [],
    disciplines: [],
  });
  const [selectedFinancialPeriodId, setSelectedFinancialPeriodId] = useState('');
  const [snapshotDate, setSnapshotDate] = useState('');
  const [snapshotNotes, setSnapshotNotes] = useState('');

  const treeSignature = useMemo(() => getTreeSignature(tree), [tree]);
  const { latestBaseline, loading: baselinesLoading, error: baselinesError, loadBaselineDetail } = useBaselines(activeProject?.id);
  const {
    financialPeriods,
    definitionsLoading,
    definitionsError,
    nextPendingFinancialPeriod,
    reloadFinancialPeriods,
    reloadPeriods,
  } = useControlPeriods(activeProject?.id);

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
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!activeProject?.id) return;
    reloadActivities?.().catch((error) => {
      console.error('No se pudo recargar actividades al cambiar el WBS', error);
    });
  }, [activeProject?.id, treeSignature, reloadActivities]);

  useEffect(() => {
    let cancelled = false;
    async function loadLatestBaselineDetail() {
      if (!latestBaseline?.id) {
        setBaselineActivities([]);
        setBaselineDetailLoading(false);
        return;
      }
      setBaselineDetailLoading(true);
      try {
        const detail = await loadBaselineDetail(latestBaseline.id);
        if (!cancelled) {
          setBaselineActivities(Array.isArray(detail?.activities) ? detail.activities : []);
        }
      } catch (error) {
        if (!cancelled) {
          setBaselineActivities([]);
          setPageError(getErrorMessage(error, 'No se pudo cargar el detalle de la línea base.'));
        }
      } finally {
        if (!cancelled) setBaselineDetailLoading(false);
      }
    }

    setPageError('');
    loadLatestBaselineDetail();
    return () => { cancelled = true; };
  }, [latestBaseline?.id, loadBaselineDetail]);

  useEffect(() => {
    if (!activeProject?.id) {
      setSelectedFinancialPeriodId('');
      setSnapshotDate('');
      return;
    }

    const stored = getPreferredFinancialPeriodId(activeProject.id);
    const storedIsValid = stored && financialPeriods.some((item) => item.id === stored);
    const nextCandidate = storedIsValid
      ? stored
      : nextPendingFinancialPeriod?.id || financialPeriods[0]?.id || '';

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

  const handleRequestedCellHandled = useCallback(() => setRequestedCellId(null), []);

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

  const handleFinancialPeriodChange = useCallback((periodId) => {
    setSelectedFinancialPeriodId(periodId);
    setPreferredFinancialPeriodId(activeProject?.id, periodId);
    setSnapshotDate(getInitialSnapshotDate(financialPeriods, periodId));
    setPageError('');
    setPageSuccess('');
  }, [activeProject?.id, financialPeriods]);

  const handleCaptureFinancialPeriod = useCallback(async () => {
    if (!activeProject?.id || !selectedFinancialPeriodId) return;

    setPageError('');
    setPageSuccess('');
    setCaptureBusy(true);

    try {
      await controlPeriodsApi.capture({
        project_id: activeProject.id,
        financial_period_id: selectedFinancialPeriodId,
        snapshot_date: snapshotDate || selectedFinancialPeriod?.cutoff_date || '',
        close_notes: snapshotNotes,
      });

      const [updatedDefinitions] = await Promise.all([reloadFinancialPeriods(), reloadPeriods()]);
      const nextSelection = Array.isArray(updatedDefinitions)
        ? (updatedDefinitions.find((item) => !item.has_snapshot)?.id || '')
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

  const handleAddActivity = useCallback(async (wbsNode) => {
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
      if (created?.id) setRequestedCellId(`${created.id}:name`);
      await reloadActivities();
    } catch {
      // Error manejado arriba.
    }
  }, [reloadActivities, runActivityMutation]);

  const handleUpdateActivity = useCallback(async (activity, patch) => {
    try {
      await runActivityMutation(() => activitiesApi.update(activity.id, patch));
      await reloadActivities();
    } catch {
      // Error manejado arriba.
    }
  }, [reloadActivities, runActivityMutation]);

  const handleDeleteActivity = useCallback(async (activity) => {
    if (!window.confirm(`¿Eliminar actividad "${activity.name}"?`)) return;

    try {
      await runActivityMutation(() => activitiesApi.remove(activity.id));
      await reloadActivities();
    } catch {
      // Error manejado arriba.
    }
  }, [reloadActivities, runActivityMutation]);

  if (!activeProject?.id) {
    return (
      <SectionCard title="Actividades" description="Selecciona un proyecto para trabajar sobre sus actividades.">
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          No hay un proyecto activo seleccionado.
        </div>
      </SectionCard>
    );
  }

  const captureHelper = !selectedFinancialPeriod
    ? ''
    : selectedFinancialPeriod.has_snapshot
      ? 'Este periodo ya tiene snapshot. Puedes volver a guardarlo si necesitas refrescarlo, pero normalmente conviene escoger el siguiente periodo disponible.'
      : 'Se guardará el avance acumulado y el EV monetario del proyecto activo para este periodo.';

  return (
    <div className="space-y-4">
      <BaselineBanner latestBaseline={latestBaseline} baselineLoading={baselinesLoading || baselineDetailLoading} baselineError={baselinesError} />

      {pageError ? <InlineAlert tone="warning">{pageError}</InlineAlert> : null}
      {pageSuccess ? <InlineAlert tone="success">{pageSuccess}</InlineAlert> : null}

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

      <SectionCard title="Registro de actividades" description="Actualiza el avance acumulado, las fechas y el presupuesto operativo de cada actividad.">
        {catalogError ? <InlineAlert tone="warning" className="mb-3">{catalogError}</InlineAlert> : null}

        <DataTable
          rows={rows}
          requestedCellId={requestedCellId}
          onRequestedCellHandled={handleRequestedCellHandled}
          onAddActivity={handleAddActivity}
          onUpdateActivity={handleUpdateActivity}
          onDeleteActivity={handleDeleteActivity}
          columnSettingsKey={columnSettingsKey}
          statusOptions={catalogOptions.statuses}
          activityTypeOptions={catalogOptions.activityTypes}
          priorityOptions={catalogOptions.priorities}
          disciplineOptions={catalogOptions.disciplines}
        />
      </SectionCard>
    </div>
  );
}
