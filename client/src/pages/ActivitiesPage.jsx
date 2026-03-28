import { useCallback, useEffect, useMemo, useState } from 'react';
import SectionCard from '../components/common/SectionCard.jsx';
import DataTable from '../components/activities/DataTable.jsx';
import { activitiesApi } from '../services/activitiesApi.js';
import { api } from '../services/api.js';

function normalizeDateValue(value) {
  if (value === null || value === undefined || value === '') return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : normalized;
}


function getEarliestDate(values) {
  const filtered = values.map(normalizeDateValue).filter(Boolean).sort();
  return filtered[0] || null;
}

function getLatestDate(values) {
  const filtered = values.map(normalizeDateValue).filter(Boolean).sort();
  return filtered[filtered.length - 1] || null;
}

function computeDuration(startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const normalizedStart = normalizeDateValue(startDate);
  const normalizedEnd = normalizeDateValue(endDate);

  if (!normalizedStart || !normalizedEnd) return 0;

  const start = new Date(`${normalizedStart}T00:00:00`);
  const end = new Date(`${normalizedEnd}T00:00:00`);

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

function flattenTree(nodes, output = []) {
  (nodes || []).forEach((node) => {
    output.push(node);
    flattenTree(node.children || [], output);
  });
  return output;
}

function createWbsRollupRow(node, descendantActivities, level) {
  const totalHours = descendantActivities.reduce((sum, activity) => sum + Number(activity.hours || 0), 0);
  const totalCost = descendantActivities.reduce((sum, activity) => sum + Number(activity.cost || 0), 0);
  const earliestStart = getEarliestDate(descendantActivities.map((activity) => activity.start_date));
  const latestEnd = getLatestDate(descendantActivities.map((activity) => activity.end_date));

  let weightedProgress = 0;
  if (descendantActivities.length > 0) {
    if (totalHours > 0) {
      weightedProgress =
        descendantActivities.reduce(
          (sum, activity) => sum + Number(activity.progress || 0) * Number(activity.hours || 0),
          0
        ) / totalHours;
    } else if (totalCost > 0) {
      weightedProgress =
        descendantActivities.reduce(
          (sum, activity) => sum + Number(activity.progress || 0) * Number(activity.cost || 0),
          0
        ) / totalCost;
    } else {
      weightedProgress =
        descendantActivities.reduce((sum, activity) => sum + Number(activity.progress || 0), 0) /
        descendantActivities.length;
    }
  }

  return {
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
    direct_activity_count: descendantActivities.length,
  };
}

function buildWbsRows(tree, activities, baselineMap) {
  const activitiesByWbs = new Map();

  activities.forEach((activity) => {
    const list = activitiesByWbs.get(activity.wbs_id) || [];
    list.push(activity);
    activitiesByWbs.set(activity.wbs_id, list);
  });

  const treeNodes = flattenTree(tree);
  const treeNodeIds = new Set(treeNodes.map((node) => node.id));

  function visit(node, level = 0) {
    const directActivities = (activitiesByWbs.get(node.id) || []).map((activity) => {
      const baseline =
        baselineMap.get(`original:${activity.id}`) || baselineMap.get(`activity:${activity.activity_id}`) || null;

      return {
        ...activity,
        start_date: normalizeDateValue(activity.start_date),
        end_date: normalizeDateValue(activity.end_date),
        baseline: baseline
          ? {
              ...baseline,
              start_date: normalizeDateValue(baseline.start_date),
              end_date: normalizeDateValue(baseline.end_date),
            }
          : null,
      };
    });

    const childResults = (node.children || []).map((child) => visit(child, level + 1));
    const descendantActivities = [
      ...directActivities,
      ...childResults.flatMap((result) => result.descendantActivities),
    ];

    const wbsRow = createWbsRollupRow(node, descendantActivities, level);
    const directActivityRows = directActivities.map((activity) => ({
      type: 'activity',
      level,
      ...activity,
    }));

    return {
      descendantActivities,
      rows: [wbsRow, ...directActivityRows, ...childResults.flatMap((result) => result.rows)],
    };
  }

  const rows = tree.flatMap((node) => visit(node, 0).rows);

  const orphanGroups = activities
    .filter((activity) => !treeNodeIds.has(activity.wbs_id))
    .reduce((map, activity) => {
      const key = activity.wbs_id || '__unknown__';
      const list = map.get(key) || [];
      const baseline =
        baselineMap.get(`original:${activity.id}`) || baselineMap.get(`activity:${activity.activity_id}`) || null;

      list.push({
        ...activity,
        start_date: normalizeDateValue(activity.start_date),
        end_date: normalizeDateValue(activity.end_date),
        baseline: baseline
          ? {
              ...baseline,
              start_date: normalizeDateValue(baseline.start_date),
              end_date: normalizeDateValue(baseline.end_date),
            }
          : null,
      });
      map.set(key, list);
      return map;
    }, new Map());

  let orphanIndex = 0;
  for (const [wbsId, orphanActivities] of orphanGroups.entries()) {
    orphanIndex += 1;
    const pseudoNode = {
      id: `__orphan__${wbsId}`,
      project_id: orphanActivities[0]?.project_id || null,
      parent_id: null,
      name: orphanActivities[0]?.wbs_name || 'WBS sin sincronizar',
      code: orphanActivities[0]?.wbs_code || `ORPHAN-${orphanIndex}`,
      sort_order: 999000 + orphanIndex,
      children: [],
    };

    const wbsRow = createWbsRollupRow(pseudoNode, orphanActivities, 0);
    rows.push(wbsRow);
    rows.push(
      ...orphanActivities.map((activity) => ({
        type: 'activity',
        level: 0,
        ...activity,
      }))
    );
  }

  return rows;
}

export default function ActivitiesPage({ activeProject, tree, activities, reloadActivities }) {
  const [requestedCellId, setRequestedCellId] = useState(null);
  const [baselineMeta, setBaselineMeta] = useState(null);
  const [baselineActivities, setBaselineActivities] = useState([]);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineError, setBaselineError] = useState('');

  const treeSignature = useMemo(() => flattenTree(tree).map((node) => node.id).join('|'), [tree]);

  useEffect(() => {
    if (!activeProject?.id) return;

    reloadActivities?.().catch((error) => {
      console.error('No se pudo recargar actividades al cambiar el WBS', error);
    });
  }, [activeProject?.id, treeSignature, reloadActivities]);

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

  const baselineMap = useMemo(() => buildBaselineMap(baselineActivities), [baselineActivities]);
  const rows = useMemo(() => buildWbsRows(tree, activities, baselineMap), [activities, baselineMap, tree]);

  const handleRequestedCellHandled = useCallback(() => {
    setRequestedCellId(null);
  }, []);

  if (!activeProject) {
    return <SectionCard title="Actividades">No hay proyecto activo.</SectionCard>;
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
    <SectionCard title={`Actividades · ${activeProject.name}`}>
      {baselineMeta ? (
        <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Línea Base visible: <strong>{baselineMeta.name}</strong>
        </div>
      ) : baselineLoading ? (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Cargando línea base...
        </div>
      ) : baselineError ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {baselineError}
        </div>
      ) : (
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
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
        columnSettingsKey={activeProject?.id ? `activities-columns:${activeProject.id}` : 'activities-columns'}
      />
    </SectionCard>
  );
}
