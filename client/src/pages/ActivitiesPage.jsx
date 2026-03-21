import { useCallback, useMemo, useState } from 'react';
import SectionCard from '../components/common/SectionCard.jsx';
import DataTable from '../components/activities/DataTable.jsx';
import { activitiesApi } from '../services/activitiesApi.js';

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

function buildWbsRows(tree, activities) {
  const activitiesByWbs = new Map();

  activities.forEach((activity) => {
    const list = activitiesByWbs.get(activity.wbs_id) || [];
    list.push(activity);
    activitiesByWbs.set(activity.wbs_id, list);
  });

  function visit(node, level = 0) {
    const directActivities = activitiesByWbs.get(node.id) || [];
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
    const earliestStart = getEarliestDate(descendantActivities.map((activity) => activity.start_date));
    const latestEnd = getLatestDate(descendantActivities.map((activity) => activity.end_date));

    let weightedProgress = 0;
    if (descendantActivities.length > 0) {
      if (totalHours > 0) {
        weightedProgress = descendantActivities.reduce(
          (sum, activity) => sum + Number(activity.progress || 0) * Number(activity.hours || 0),
          0
        ) / totalHours;
      } else if (totalCost > 0) {
        weightedProgress = descendantActivities.reduce(
          (sum, activity) => sum + Number(activity.progress || 0) * Number(activity.cost || 0),
          0
        ) / totalCost;
      } else {
        weightedProgress = descendantActivities.reduce(
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

  const rows = useMemo(() => buildWbsRows(tree, activities), [activities, tree]);

  const handleRequestedCellHandled = useCallback(() => {
    setRequestedCellId(null);
  }, []);

  if (!activeProject) {
    return (
      <SectionCard title="Actividades" subtitle="Selecciona primero un proyecto">
        <div className="text-sm text-slate-500">No hay proyecto activo.</div>
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
      title={`Actividades - ${activeProject.name}`}
      subtitle="Activity ID y Nombre fijos, selección por un click y edición por doble click"
    >
      <DataTable
        rows={rows}
        onAddActivity={handleAddActivity}
        onUpdateActivity={handleUpdateActivity}
        onDeleteActivity={handleDeleteActivity}
        requestedCellId={requestedCellId}
        onRequestedCellHandled={handleRequestedCellHandled}
        columnSettingsKey={`mgm.activities.columns.${activeProject.id}`}
      />
    </SectionCard>
  );
}
