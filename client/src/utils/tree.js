export function flattenWbsTree(tree, level = 0) {
  const rows = [];

  (tree || []).forEach((node) => {
    rows.push({
      type: 'wbs',
      level,
      ...node,
    });

    if (node.children?.length) {
      rows.push(...flattenWbsTree(node.children, level + 1));
    }
  });

  return rows;
}

export function flattenTreeNodes(nodes, output = []) {
  (nodes || []).forEach((node) => {
    output.push(node);
    flattenTreeNodes(node.children || [], output);
  });

  return output;
}

export function getTreeSignature(tree) {
  return flattenTreeNodes(tree)
    .map((node) => node.id)
    .join('|');
}

export function normalizeDateValue(value) {
  if (value === null || value === undefined || value === '') return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : normalized;
}

export function getEarliestDate(values) {
  const filtered = (values || []).map(normalizeDateValue).filter(Boolean).sort();
  return filtered[0] || null;
}

export function getLatestDate(values) {
  const filtered = (values || []).map(normalizeDateValue).filter(Boolean).sort();
  return filtered[filtered.length - 1] || null;
}

export function computeDuration(startDate, endDate) {
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

export function buildBaselineMap(baselineActivities = []) {
  const map = new Map();

  (baselineActivities || []).forEach((item) => {
    if (item?.original_activity_id) {
      map.set(`original:${item.original_activity_id}`, item);
    }

    if (item?.activity_id) {
      map.set(`activity:${item.activity_id}`, item);
    }
  });

  return map;
}

function buildBaselineObject(activity, baselineMap) {
  const explicitBaseline =
    baselineMap.get(`original:${activity.id}`) ||
    baselineMap.get(`activity:${activity.activity_id}`) ||
    activity.baseline ||
    null;

  if (!explicitBaseline) return null;

  return {
    ...explicitBaseline,
    start_date: normalizeDateValue(explicitBaseline.start_date),
    end_date: normalizeDateValue(explicitBaseline.end_date),
    duration: Number(explicitBaseline.duration ?? explicitBaseline.duration_days ?? 0),
    progress: Number(explicitBaseline.progress ?? explicitBaseline.progress_percent ?? 0),
    hours: Number(explicitBaseline.hours ?? explicitBaseline.budget_hours ?? 0),
    cost: Number(explicitBaseline.cost ?? explicitBaseline.budget_cost ?? 0),
    status: explicitBaseline.status ?? explicitBaseline.status_name ?? explicitBaseline.status_code ?? null,
  };
}

function enrichActivityWithBaseline(activity, baselineMap) {
  const baseline = buildBaselineObject(activity, baselineMap);
  const progress = Number(activity.progress || 0);
  const baselineCost = Number(baseline?.cost || 0);
  const evAmount = baselineCost > 0 ? Number(((progress * baselineCost) / 100).toFixed(2)) : Number(activity.ev_amount || 0);

  return {
    ...activity,
    start_date: normalizeDateValue(activity.start_date),
    end_date: normalizeDateValue(activity.end_date),
    baseline,
    baseline_budget_hours: Number(baseline?.hours || 0),
    baseline_budget_cost: baselineCost,
    ev_amount: evAmount,
  };
}

function createWbsRollupRow(node, descendantActivities, level) {
  const totalHours = descendantActivities.reduce((sum, activity) => sum + Number(activity.hours || 0), 0);
  const totalCost = descendantActivities.reduce((sum, activity) => sum + Number(activity.cost || 0), 0);
  const totalBaselineHours = descendantActivities.reduce((sum, activity) => sum + Number(activity.baseline?.hours || 0), 0);
  const totalBaselineCost = descendantActivities.reduce((sum, activity) => sum + Number(activity.baseline?.cost || 0), 0);
  const totalEvAmount = descendantActivities.reduce((sum, activity) => sum + Number(activity.ev_amount || 0), 0);

  const earliestStart = getEarliestDate(descendantActivities.map((activity) => activity.start_date));
  const latestEnd = getLatestDate(descendantActivities.map((activity) => activity.end_date));
  const earliestBaselineStart = getEarliestDate(descendantActivities.map((activity) => activity.baseline?.start_date));
  const latestBaselineEnd = getLatestDate(descendantActivities.map((activity) => activity.baseline?.end_date));

  let weightedProgress = 0;

  if (descendantActivities.length > 0) {
    if (totalBaselineCost > 0) {
      weightedProgress =
        descendantActivities.reduce(
          (sum, activity) => sum + Number(activity.progress || 0) * Number(activity.baseline?.cost || 0),
          0,
        ) / totalBaselineCost;
    } else if (totalCost > 0) {
      weightedProgress =
        descendantActivities.reduce(
          (sum, activity) => sum + Number(activity.progress || 0) * Number(activity.cost || 0),
          0,
        ) / totalCost;
    } else if (totalHours > 0) {
      weightedProgress =
        descendantActivities.reduce(
          (sum, activity) => sum + Number(activity.progress || 0) * Number(activity.hours || 0),
          0,
        ) / totalHours;
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
    rollup_ev_amount: Number(totalEvAmount.toFixed(2)),
    rollup_start_date: earliestStart,
    rollup_end_date: latestEnd,
    rollup_duration: computeDuration(earliestStart, latestEnd),
    rollup_activity_count: descendantActivities.length,
    direct_activity_count: descendantActivities.length,
    baseline: {
      start_date: earliestBaselineStart,
      end_date: latestBaselineEnd,
      duration: computeDuration(earliestBaselineStart, latestBaselineEnd),
      hours: Number(totalBaselineHours.toFixed(2)),
      cost: Number(totalBaselineCost.toFixed(2)),
      progress: null,
      status: null,
    },
  };
}

export function buildActivityRows(tree = [], activities = [], baselineActivities = []) {
  const baselineMap = buildBaselineMap(baselineActivities);
  const activitiesByWbs = new Map();

  (activities || []).forEach((activity) => {
    const list = activitiesByWbs.get(activity.wbs_id) || [];
    list.push(activity);
    activitiesByWbs.set(activity.wbs_id, list);
  });

  const treeNodes = flattenTreeNodes(tree);
  const treeNodeIds = new Set(treeNodes.map((node) => node.id));

  function visit(node, level = 0) {
    const directActivities = (activitiesByWbs.get(node.id) || []).map((activity) =>
      enrichActivityWithBaseline(activity, baselineMap),
    );

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

  const rows = (tree || []).flatMap((node) => visit(node, 0).rows);

  const orphanGroups = (activities || [])
    .filter((activity) => !treeNodeIds.has(activity.wbs_id))
    .reduce((map, activity) => {
      const key = activity.wbs_id || '__unknown__';
      const list = map.get(key) || [];

      list.push(enrichActivityWithBaseline(activity, baselineMap));
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

    rows.push(createWbsRollupRow(pseudoNode, orphanActivities, 0));
    rows.push(
      ...orphanActivities.map((activity) => ({
        type: 'activity',
        level: 0,
        ...activity,
      })),
    );
  }

  return rows;
}
