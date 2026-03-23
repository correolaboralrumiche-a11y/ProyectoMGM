import { useCallback, useEffect, useMemo, useState } from 'react';
import SectionCard from '../components/common/SectionCard.jsx';
import DataTable from '../components/activities/DataTable.jsx';
import { activitiesApi } from '../services/activitiesApi.js';
import { api } from '../services/api.js';

function getEarliestDate(values) {
  const filtered = values.filter(Boolean).sort();
  return filtered[0] || null;
}

function getLatestDate(values) {
  const filtered = values.filter(Boolean).sort();
  return filtered[filtered.length - 1] || null;
}

function computeDuration(startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return diff >= 0 ? diff : 0;
}

function buildBaselineMap(baselineActivities) {
  const map = new Map();

  (baselineActivities || []).forEach((item) => {
    if (item.original_activity_id) {
      map.set(`original:${item.original_activity_id}`, item);
    }

    if (item.activity_id) {
      map.set(`activity:${item.activity_id}`, item);
    }
  });

  return map;
}

function buildWbsRows(tree, activities, baselineMap) {
  const activitiesByWbs = new Map();

  activities.forEach((activity) => {
    const list = activitiesByWbs.get(activity.wbs_id) || [];
    list.push(activity);
    activitiesByWbs.set(activity.wbs_id, list);
  });

  function visit(node, level = 0) {
    const directActivities = (activitiesByWbs.get(node.id) || []).map((activity) => {
      const baseline =
        baselineMap.get(`original:${activity.id}`) ||
        baselineMap.get(`activity:${activity.activity_id}`) ||
        null;

      return {
        ...activity,
        baseline,
      };
    });

    const childResults = (node.children || []).map((child) => visit(child, level + 1));

    const descendantActivities = [
      ...directActivities,
      ...childResults.flatMap((result) => result.descendantActivities),
    ];

    const totalHours = descendantActivities.reduce(
      (sum, activity) => sum + Number(activity.hours || 0),
      0
    );

    const totalCost = descendantActivities.reduce(
      (sum, activity) => sum + Number(activity.cost || 0),
      0
    );

    const earliestStart = getEarliestDate(
      descendantActivities.map((activity) => activity.start_date)
    );

    const latestEnd = getLatestDate(
      descendantActivities.map((activity) => activity.end_date)
    );

    let weightedProgress = 0;

    if (descendantActivities.length > 0) {
      if (totalHours > 0) {
        weightedProgress =
          descendantActivities.reduce(
            (sum, activity) =>
              sum + Number(activity.progress || 0) * Number(activity.hours || 0),
            0
          ) / totalHours;
      } else if (totalCost > 0) {
        weightedProgress =
          descendantActivities.reduce(
            (sum, activity) =>
              sum + Number(activity.progress || 0) * Number(activity.cost || 0),
            0
          ) / totalCost;
      } else {
        weightedProgress =
          descendantActivities.reduce(
            (sum, activity) => sum + Number(activity.progress || 0),
            0
          ) / descendantActivities.length;
      }
    }

    const wbsRow = {
      type: 'wbs',
      level,
      ...node,
      rollup_hours: Number(totalHours.toFixed(2)),
      rollup_cost: Number(totalCost.toFixed(2)),
      rollup_progress: Number(weightedProgress.toFixed(2)),
      rollup_start_date: earliestStart,
      rollup_end_date: latestEnd,
      rollup_duration: computeDuration(earliestStart, latestEnd),
      rollup_activity_count: descendantActivities.length,
      direct_activity_count: directActivities.length,
    };

    const directActivityRows = directActivities.map((activity) => ({
      type: 'activity',
      level,
      ...activity,
    }));

    return {
      descendantActivities,
      rows: [
        wbsRow,
        ...directActivityRows,
        ...childResults.flatMap((result) => result.rows),
      ],
    };
  }

  return tree.flatMap((node) => visit(node, 0).rows);
}

export default function ActivitiesPage({
  activeProject,
  tree,
  activities,
  reloadActivities,
}) {
  const [requestedCellId, setRequestedCellId] = useState(null);
  const [baselineMeta, setBaselineMeta] = useState(null);
  const [baselineActivities, setBaselineActivities] = useState([]);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineError, setBaselineError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadLatestBaseline() {
      if (!activeProject?.id) {
        setBaselineMeta(null);
        setBaselineActivities([]);
        setBaselineError('');
        return;
      }

      setBaselineLoading(true);
      setBaselineError('');

      try {
        const list = await api.get(`/baselines?projectId=${activeProject.id}`);
        const baselines = Array.isArray(list) ? list : [];

        if (!baselines.length) {
          if (!cancelled) {
            setBaselineMeta(null);
            setBaselineActivities([]);
          }
          return;
        }

        const latest = [...baselines].sort((a, b) => {
          const aTime = new Date(a.created_at || 0).getTime();
          const bTime = new Date(b.created_at || 0).getTime();
          return bTime - aTime;
        })[0];

        const detail = await api.get(`/baselines/${latest.id}`);

        if (!cancelled) {
          setBaselineMeta(latest);
          setBaselineActivities(Array.isArray(detail?.activities) ? detail.activities : []);
        }
      } catch (error) {
        if (!cancelled) {
          setBaselineMeta(null);
          setBaselineActivities([]);
          setBaselineError(error.message || 'No se pudo cargar la línea base');
        }
      } finally {
        if (!cancelled) {
          setBaselineLoading(false);
        }
      }
    }

    loadLatestBaseline();

    return () => {
      cancelled = true;
    };
  }, [activeProject?.id]);

  const baselineMap = useMemo(
    () => buildBaselineMap(baselineActivities),
    [baselineActivities]
  );

  const rows = useMemo(
    () => buildWbsRows(tree, activities, baselineMap),
    [activities, baselineMap, tree]
  );

  const handleRequestedCellHandled = useCallback(() => {
    setRequestedCellId(null);
  }, []);

  if (!activeProject) {
    return (
      <SectionCard
        title="Actividades"
        subtitle="Selecciona un proyecto para visualizar y editar actividades"
      >
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No hay proyecto activo.
        </div>
      </SectionCard>
    );
  }

  async function handleAddActivity(wbsNode) {
    try {
      const created = await activitiesApi.create({
        wbs_id: wbsNode.id,
        name: 'Nueva actividad',
        status: 'Not Started',
        progress: 0,
        hours: 0,
        cost: 0,
      });

      setRequestedCellId(`${created.id}:name`);
      await reloadActivities();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleUpdateActivity(activity, patch) {
    try {
      await activitiesApi.update(activity.id, patch);
      await reloadActivities();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleDeleteActivity(activity) {
    const confirmed = confirm(`¿Eliminar actividad "${activity.name}"?`);
    if (!confirmed) return;

    try {
      await activitiesApi.remove(activity.id);
      await reloadActivities();
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <SectionCard
      title="Actividades"
      subtitle="Gestiona la hoja de actividades del proyecto activo"
    >
      <div className="space-y-3">
        {baselineMeta ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Línea Base visible: <span className="font-semibold">{baselineMeta.name}</span>
          </div>
        ) : baselineLoading ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Cargando línea base...
          </div>
        ) : baselineError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {baselineError}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Este proyecto no tiene línea base registrada.
          </div>
        )}

        <DataTable
          rows={rows}
          onAddActivity={handleAddActivity}
          onUpdateActivity={handleUpdateActivity}
          onDeleteActivity={handleDeleteActivity}
          requestedCellId={requestedCellId}
          onRequestedCellHandled={handleRequestedCellHandled}
          columnSettingsKey={activeProject ? `activities.columns.${activeProject.id}` : 'activities.columns'}
        />
      </div>
    </SectionCard>
  );
}
