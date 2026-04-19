import { useEffect, useMemo, useState } from 'react';
import InlineAlert from '../common/InlineAlert.jsx';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value, metricKey, options = {}) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '—';

  const numeric = Number(value);
  const isProgress = metricKey === 'progress' || options.asPercent;
  const formatOptions = isProgress
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { minimumFractionDigits: 0, maximumFractionDigits: 2 };

  const formatted = new Intl.NumberFormat('es-PE', formatOptions).format(numeric);
  return isProgress ? `${formatted}%` : formatted;
}

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed);
}

function formatCellValue(value, columnKey, metricKey) {
  if (value === null || value === undefined || value === '') return '—';

  if (String(columnKey).includes('date')) {
    return formatDate(value);
  }

  if (['budget_hours', 'budget_cost', 'baseline_hours', 'baseline_cost', 'ev_amount', 'progress'].includes(columnKey)) {
    return formatNumber(value, metricKey, { asPercent: columnKey === 'progress' });
  }

  return String(value);
}

function getRowTone(rowType) {
  if (rowType === 'project') return 'bg-slate-50 font-semibold text-slate-900';
  if (rowType === 'wbs') return 'bg-blue-50/40 font-medium text-slate-800';
  return 'bg-white text-slate-700';
}

function buildLabel(row) {
  const code = row?.columns?.code ? `${row.columns.code} · ` : '';
  const name = row?.columns?.name || row?.label || row?.name || row?.id || 'Fila';
  return `${code}${name}`;
}

function buildExpandedDefaults(rows) {
  const defaults = {};
  rows.forEach((row) => {
    if (row?.has_children) defaults[row.id] = true;
  });
  return defaults;
}

function buildVisibleRows(rows, expandedMap) {
  const visible = [];
  const rowMap = new Map(rows.map((row) => [row.id, row]));

  function isAncestorExpanded(row) {
    let currentParentId = row.parent_id;
    while (currentParentId) {
      const parent = rowMap.get(currentParentId);
      if (!parent) return true;
      if (expandedMap[parent.id] === false) return false;
      currentParentId = parent.parent_id;
    }
    return true;
  }

  rows.forEach((row) => {
    if (row.parent_id === null || isAncestorExpanded(row)) {
      visible.push(row);
    }
  });

  return visible;
}

function renderGroupedHeader(columnCount, groups = []) {
  return (
    <tr className="bg-slate-100">
      <th
        colSpan={Math.max(columnCount, 1)}
        className="sticky left-0 z-[1] border-b border-slate-200 bg-slate-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
      >
        Panel general
      </th>
      {groups.map((group, index) => (
        <th
          key={group.key || group.month_key || `${group.label || 'grupo'}:${index}`}
          colSpan={group.span || Math.max(Number(group.end_index) - Number(group.start_index) + 1, 1) || 1}
          className="border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          {group.label}
        </th>
      ))}
      <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
        Total
      </th>
    </tr>
  );
}

function renderBucketsHeader(columns = [], buckets = []) {
  return (
    <tr className="bg-slate-50">
      <th className="sticky left-0 z-[1] min-w-[280px] border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
        Estructura
      </th>
      {columns.map((column) => (
        <th
          key={column.key}
          className="min-w-[120px] border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          {column.label}
        </th>
      ))}
      {buckets.map((bucket, index) => (
        <th
          key={bucket.key || `${bucket.label || 'bucket'}:${index}`}
          className="min-w-[120px] border-b border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-600"
        >
          <div>{bucket.label}</div>
          {bucket.month_label ? <div className="text-[11px] text-slate-400">{bucket.month_label}</div> : null}
        </th>
      ))}
      <th className="min-w-[130px] border-b border-slate-200 px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
        Total temporal
      </th>
    </tr>
  );
}

function issueBadge(issue) {
  const palette =
    issue?.key === 'rollup_mismatch'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
      : issue?.key === 'time_total_mismatch'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-600 border-slate-200';

  const label =
    issue?.key === 'rollup_mismatch'
      ? 'Roll-up'
      : issue?.key === 'time_total_mismatch'
        ? 'Total'
        : issue?.key === 'missing_baseline_dates' || issue?.key === 'missing_baseline_budget'
          ? 'LB'
          : issue?.key === 'invalid_baseline_duration' || issue?.key === 'invalid_activity_duration'
            ? 'Dur.'
            : issue?.key === 'cumulative_decrease'
              ? 'Acum.'
              : issue?.key === 'negative_period_value'
                ? 'Período'
                : issue?.key === 'progress_out_of_range'
                  ? 'Avance'
                  : 'Warn';

  return (
    <span
      key={`${issue.key}:${issue.message}`}
      title={issue.message}
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${palette}`}
    >
      {label}
    </span>
  );
}

function RowLabel({ row, expanded, onToggle, issues = [] }) {
  const paddingLeft = `${Math.max(0, Number(row.depth || 0)) * 18 + 12}px`;
  const hasChildren = Boolean(row.has_children);
  const tone = getRowTone(row.row_type);

  return (
    <div className={['flex min-w-[240px] items-start gap-2', tone].join(' ')} style={{ paddingLeft }}>
      {hasChildren ? (
        <button
          type="button"
          onClick={() => onToggle(row.id)}
          className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 hover:bg-slate-100"
          aria-label={expanded ? 'Contraer fila' : 'Expandir fila'}
          title={expanded ? 'Contraer' : 'Expandir'}
        >
          {expanded ? '−' : '+'}
        </button>
      ) : (
        <span className="inline-block h-6 w-6" />
      )}
      <div className="min-w-0 space-y-1">
        <div className="truncate">{buildLabel(row)}</div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{row.row_type}</div>
        {issues.length ? <div className="flex flex-wrap gap-1">{issues.slice(0, 4).map((issue) => issueBadge(issue))}</div> : null}
      </div>
    </div>
  );
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function getStorageKey(templateId, suffix) {
  return `proyectomgm.templates.viewer.${templateId || 'default'}.${suffix}`;
}

function readJsonStorage(key, fallback) {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local storage failures.
  }
}

function readBooleanStorage(key, fallback = false) {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

function writeBooleanStorage(key, value) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // Ignore local storage failures.
  }
}

function buildIssueFocusedRows(rows, visibleRows, rowIssuesById) {
  const issueIds = new Set(Object.keys(rowIssuesById || {}));
  if (!issueIds.size) return visibleRows;

  const rowMap = new Map(rows.map((row) => [row.id, row]));
  const idsToKeep = new Set();

  issueIds.forEach((rowId) => {
    let currentId = rowId;
    while (currentId) {
      idsToKeep.add(currentId);
      const currentRow = rowMap.get(currentId);
      currentId = currentRow?.parent_id || null;
    }
  });

  return visibleRows.filter((row) => idsToKeep.has(row.id));
}

export default function TimeGrid({ viewerData, metricKey, metricLabel = 'Métrica' }) {
  const templateId = viewerData?.template?.id || 'default';
  const columns = useMemo(() => (Array.isArray(viewerData?.columns) ? viewerData.columns : EMPTY_ARRAY), [viewerData?.columns]);
  const groups = useMemo(() => (Array.isArray(viewerData?.bucket_groups) ? viewerData.bucket_groups : EMPTY_ARRAY), [viewerData?.bucket_groups]);
  const buckets = useMemo(() => (Array.isArray(viewerData?.buckets) ? viewerData.buckets : EMPTY_ARRAY), [viewerData?.buckets]);
  const rows = useMemo(() => (Array.isArray(viewerData?.rows) ? viewerData.rows : EMPTY_ARRAY), [viewerData?.rows]);
  const analysis = viewerData?.analysis || EMPTY_OBJECT;
  const rowIssuesById = analysis?.rowIssuesById || EMPTY_OBJECT;

  const expandedStorageKey = getStorageKey(templateId, 'expanded');
  const issueFilterStorageKey = getStorageKey(templateId, 'only-issues');

  const [expandedMap, setExpandedMap] = useState(() => {
    const defaults = buildExpandedDefaults(rows);
    const stored = readJsonStorage(expandedStorageKey, defaults);
    return { ...defaults, ...(stored || {}) };
  });
  const [showOnlyIssueRows, setShowOnlyIssueRows] = useState(() => readBooleanStorage(issueFilterStorageKey, false));

  useEffect(() => {
    const defaults = buildExpandedDefaults(rows);
    const stored = readJsonStorage(expandedStorageKey, defaults);
    setExpandedMap({ ...defaults, ...(stored || {}) });
    setShowOnlyIssueRows(readBooleanStorage(issueFilterStorageKey, false));
  }, [expandedStorageKey, issueFilterStorageKey, rows]);

  useEffect(() => {
    writeJsonStorage(expandedStorageKey, expandedMap);
  }, [expandedMap, expandedStorageKey]);

  useEffect(() => {
    writeBooleanStorage(issueFilterStorageKey, showOnlyIssueRows);
  }, [issueFilterStorageKey, showOnlyIssueRows]);

  const baseVisibleRows = useMemo(() => buildVisibleRows(rows, expandedMap), [rows, expandedMap]);
  const visibleRows = useMemo(
    () => (showOnlyIssueRows ? buildIssueFocusedRows(rows, baseVisibleRows, rowIssuesById) : baseVisibleRows),
    [baseVisibleRows, rowIssuesById, rows, showOnlyIssueRows],
  );
  const issueRowCount = toNumber(analysis?.summary?.issueRowCount, 0);

  if (!viewerData) {
    return (
      <InlineAlert tone="info">
        Selecciona una plantilla para visualizar la estructura general y su distribución temporal.
      </InlineAlert>
    );
  }

  if (!rows.length) {
    return <InlineAlert tone="info">La plantilla no devolvió filas visibles para el proyecto activo.</InlineAlert>;
  }

  function handleToggle(rowId) {
    setExpandedMap((current) => ({
      ...current,
      [rowId]: current[rowId] === false,
    }));
  }

  function handleExpandAll() {
    setExpandedMap(buildExpandedDefaults(rows));
  }

  function handleCollapseAll() {
    const collapsed = {};
    rows.forEach((row) => {
      if (row?.has_children) collapsed[row.id] = false;
    });
    setExpandedMap(collapsed);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">Jerarquía expandible</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">Columnas generales: {columns.length}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">Buckets: {buckets.length}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">Métrica: {metricLabel}</span>
          <span className={`rounded-full px-2.5 py-1 font-medium ${issueRowCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            Filas con alertas: {issueRowCount}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExpandAll}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Expandir todo
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Colapsar todo
          </button>
          <button
            type="button"
            onClick={() => setShowOnlyIssueRows((current) => !current)}
            className={`rounded-lg border px-3 py-2 text-xs font-medium ${
              showOnlyIssueRows
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {showOnlyIssueRows ? 'Mostrando solo alertas' : 'Filtrar solo alertas'}
          </button>
        </div>
      </div>

      {showOnlyIssueRows && visibleRows.length === 0 ? (
        <InlineAlert tone="info">No hay filas con alertas visibles para la selección actual.</InlineAlert>
      ) : null}

      <div className="relative isolate overflow-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            {renderGroupedHeader(columns.length + 1, groups)}
            {renderBucketsHeader(columns, buckets)}
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const values = Array.isArray(row.time_values) ? row.time_values : EMPTY_ARRAY;
              const tone = getRowTone(row.row_type);
              const expanded = expandedMap[row.id] !== false;
              const rowIssues = Array.isArray(rowIssuesById[row.id]) ? rowIssuesById[row.id] : EMPTY_ARRAY;

              return (
                <tr
                  key={row.id}
                  className={`${tone} hover:bg-blue-50/40 ${rowIssues.length ? 'ring-1 ring-inset ring-amber-200' : ''}`}
                >
                  <td className="sticky left-0 z-[1] border-b border-slate-100 bg-white px-3 py-2 align-top">
                    <RowLabel row={row} expanded={expanded} onToggle={handleToggle} issues={rowIssues} />
                  </td>

                  {columns.map((column) => (
                    <td key={`${row.id}:${column.key}`} className="border-b border-slate-100 px-3 py-2 align-top text-slate-700">
                      {formatCellValue(row?.columns?.[column.key], column.key, metricKey)}
                    </td>
                  ))}

                  {buckets.map((bucket, index) => (
                    <td
                      key={`${row.id}:${bucket.key || index}:${index}`}
                      className="border-b border-slate-100 px-3 py-2 text-right text-slate-700"
                    >
                      {formatNumber(values[index], metricKey)}
                    </td>
                  ))}

                  <td className="border-b border-slate-100 px-3 py-2 text-right font-semibold text-slate-900">
                    {formatNumber(row.time_total_value, metricKey)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
