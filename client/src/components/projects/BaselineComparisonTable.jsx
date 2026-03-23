function formatNumber(value, decimals = 2) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) : '0.00';
}

function formatInteger(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric.toLocaleString() : '0';
}

function formatCurrency(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
    : '$0.00';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function calcTotals(activities = []) {
  return activities.reduce(
    (acc, row) => {
      acc.count += 1;
      acc.hours += Number(row.hours || 0);
      acc.cost += Number(row.cost || 0);
      acc.progress += Number(row.progress || 0);
      return acc;
    },
    { count: 0, hours: 0, cost: 0, progress: 0 }
  );
}

function compareActivities(liveActivities = [], baselineActivities = []) {
  const baselineMap = new Map(
    baselineActivities.map((row) => [String(row.activity_id || '').trim().toUpperCase(), row])
  );
  const liveMap = new Map(
    liveActivities.map((row) => [String(row.activity_id || '').trim().toUpperCase(), row])
  );

  const keys = new Set([...baselineMap.keys(), ...liveMap.keys()]);

  return Array.from(keys)
    .map((key) => {
      const live = liveMap.get(key) || null;
      const baseline = baselineMap.get(key) || null;
      const hoursDelta = Number(live?.hours || 0) - Number(baseline?.hours || 0);
      const costDelta = Number(live?.cost || 0) - Number(baseline?.cost || 0);
      const durationDelta = Number(live?.duration || 0) - Number(baseline?.duration || 0);

      let status = 'Sin cambios';
      if (live && !baseline) status = 'Nueva';
      else if (!live && baseline) status = 'Eliminada';
      else if (
        hoursDelta !== 0 ||
        costDelta !== 0 ||
        durationDelta !== 0 ||
        String(live?.start_date || '') !== String(baseline?.start_date || '') ||
        String(live?.end_date || '') !== String(baseline?.end_date || '') ||
        String(live?.name || '') !== String(baseline?.name || '') ||
        String(live?.wbs_id || '') !== String(baseline?.baseline_wbs_id || '')
      ) {
        status = 'Modificada';
      }

      return {
        key,
        activityId: live?.activity_id || baseline?.activity_id || '—',
        name: live?.name || baseline?.name || '—',
        liveWbs: live?.wbs_name || live?.wbs_code || '—',
        baselineWbs: baseline?.wbs_code ? `${baseline.wbs_code} · ${baseline.wbs_name || ''}`.trim() : '—',
        liveStart: live?.start_date || null,
        baselineStart: baseline?.start_date || null,
        liveEnd: live?.end_date || null,
        baselineEnd: baseline?.end_date || null,
        liveDuration: Number(live?.duration || 0),
        baselineDuration: Number(baseline?.duration || 0),
        durationDelta,
        liveHours: Number(live?.hours || 0),
        baselineHours: Number(baseline?.hours || 0),
        hoursDelta,
        liveCost: Number(live?.cost || 0),
        baselineCost: Number(baseline?.cost || 0),
        costDelta,
        liveProgress: Number(live?.progress || 0),
        baselineProgress: Number(baseline?.progress || 0),
        status,
      };
    })
    .sort((a, b) => String(a.activityId).localeCompare(String(b.activityId), undefined, { numeric: true }));
}

function MetricCard({ label, liveValue, baselineValue, deltaValue, formatter = formatNumber, deltaClassName = '' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-3 grid gap-2 text-sm text-slate-700">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Proyecto vivo</span>
          <span className="font-semibold text-slate-900">{formatter(liveValue)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Línea base</span>
          <span className="font-semibold text-slate-900">{formatter(baselineValue)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
          <span className="text-slate-500">Variación</span>
          <span className={['font-semibold', deltaClassName].join(' ').trim()}>
            {formatter(deltaValue)}
          </span>
        </div>
      </div>
    </div>
  );
}

function deltaClass(value) {
  const numeric = Number(value || 0);
  if (numeric > 0) return 'text-amber-700';
  if (numeric < 0) return 'text-emerald-700';
  return 'text-slate-700';
}

export default function BaselineComparisonTable({
  activeProject,
  currentWbs = [],
  currentActivities = [],
  baselineDetail,
  loading = false,
}) {
  if (!activeProject) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        Selecciona un proyecto para comparar su estado vivo contra una línea base.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
        Cargando detalle de la línea base...
      </div>
    );
  }

  if (!baselineDetail?.baseline) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        Selecciona una línea base para ver la comparación visual con el proyecto vivo.
      </div>
    );
  }

  const baselineActivities = Array.isArray(baselineDetail.activities) ? baselineDetail.activities : [];
  const baselineWbs = Array.isArray(baselineDetail.wbs) ? baselineDetail.wbs : [];
  const liveTotals = calcTotals(currentActivities);
  const baselineTotals = calcTotals(baselineActivities);
  const rows = compareActivities(currentActivities, baselineActivities);
  const changedCount = rows.filter((row) => row.status === 'Modificada').length;
  const addedCount = rows.filter((row) => row.status === 'Nueva').length;
  const removedCount = rows.filter((row) => row.status === 'Eliminada').length;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Proyecto vivo:</span> {activeProject.name}
        </div>
        <div className="mt-1 text-sm text-slate-700">
          <span className="font-semibold text-slate-900">Línea base comparada:</span> {baselineDetail.baseline.name}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Snapshot creado el {formatDate(baselineDetail.baseline.created_at)}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="WBS"
          liveValue={currentWbs.length}
          baselineValue={baselineWbs.length}
          deltaValue={currentWbs.length - baselineWbs.length}
          formatter={formatInteger}
          deltaClassName={deltaClass(currentWbs.length - baselineWbs.length)}
        />
        <MetricCard
          label="Actividades"
          liveValue={liveTotals.count}
          baselineValue={baselineTotals.count}
          deltaValue={liveTotals.count - baselineTotals.count}
          formatter={formatInteger}
          deltaClassName={deltaClass(liveTotals.count - baselineTotals.count)}
        />
        <MetricCard
          label="Horas"
          liveValue={liveTotals.hours}
          baselineValue={baselineTotals.hours}
          deltaValue={liveTotals.hours - baselineTotals.hours}
          formatter={(value) => formatNumber(value, 2)}
          deltaClassName={deltaClass(liveTotals.hours - baselineTotals.hours)}
        />
        <MetricCard
          label="Costo"
          liveValue={liveTotals.cost}
          baselineValue={baselineTotals.cost}
          deltaValue={liveTotals.cost - baselineTotals.cost}
          formatter={formatCurrency}
          deltaClassName={deltaClass(liveTotals.cost - baselineTotals.cost)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modificadas</div>
          <div className="mt-2 text-2xl font-semibold text-amber-700">{changedCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nuevas</div>
          <div className="mt-2 text-2xl font-semibold text-blue-700">{addedCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Eliminadas</div>
          <div className="mt-2 text-2xl font-semibold text-rose-700">{removedCount}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-[1400px] divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Activity ID</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">WBS vivo</th>
              <th className="px-4 py-3">WBS baseline</th>
              <th className="px-4 py-3">Inicio vivo</th>
              <th className="px-4 py-3">Inicio baseline</th>
              <th className="px-4 py-3">Fin vivo</th>
              <th className="px-4 py-3">Fin baseline</th>
              <th className="px-4 py-3">HH vivo</th>
              <th className="px-4 py-3">HH baseline</th>
              <th className="px-4 py-3">Δ HH</th>
              <th className="px-4 py-3">Costo vivo</th>
              <th className="px-4 py-3">Costo baseline</th>
              <th className="px-4 py-3">Δ costo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const badgeClass =
                row.status === 'Nueva'
                  ? 'bg-blue-100 text-blue-700'
                  : row.status === 'Eliminada'
                    ? 'bg-rose-100 text-rose-700'
                    : row.status === 'Modificada'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-700';

              return (
                <tr key={row.key} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <span className={['inline-flex rounded-full px-2.5 py-1 text-xs font-medium', badgeClass].join(' ')}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.activityId}</td>
                  <td className="px-4 py-3 text-slate-700">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.liveWbs}</td>
                  <td className="px-4 py-3 text-slate-600">{row.baselineWbs}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(row.liveStart)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(row.baselineStart)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(row.liveEnd)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(row.baselineEnd)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(row.liveHours)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatNumber(row.baselineHours)}</td>
                  <td className={[ 'px-4 py-3 font-medium', deltaClass(row.hoursDelta) ].join(' ')}>{formatNumber(row.hoursDelta)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatCurrency(row.liveCost)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatCurrency(row.baselineCost)}</td>
                  <td className={[ 'px-4 py-3 font-medium', deltaClass(row.costDelta) ].join(' ')}>{formatCurrency(row.costDelta)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
