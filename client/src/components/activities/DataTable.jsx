
import { useEffect, useMemo, useRef, useState } from 'react';
import EditableCell from './EditableCell';
import ColumnSelectorModal from './ColumnSelectorModal';

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
const FIXED_COLUMN_KEYS = ['code', 'name'];
const DEFAULT_SORT = { key: 'code', direction: 'asc' };

const FIXED_COLUMNS = [
  {
    key: 'code',
    label: 'Código',
    width: '140px',
    sortable: true,
    fixed: true,
    mandatory: true,
    configurable: false,
  },
  {
    key: 'name',
    label: 'Actividad',
    width: 'minmax(340px, 2.8fr)',
    sortable: true,
    fixed: true,
    mandatory: true,
    configurable: false,
  },
];

const OPERATIVE_COLUMNS = [
  { key: 'start_date', label: 'Inicio', width: '132px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'end_date', label: 'Fin', width: '132px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'duration', label: 'Duración', width: '104px', sortable: true, readOnly: true, configurable: true, group: 'Operativas' },
  { key: 'progress', label: 'Progreso %', width: '116px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'hours', label: 'HH', width: '96px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'cost', label: 'Costo USD', width: '128px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'status', label: 'Estado', width: '150px', sortable: true, configurable: true, group: 'Operativas' },
];

const BASELINE_COLUMNS = [
  { key: 'lb_start_date', label: 'LB Inicio', width: '132px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
  { key: 'lb_end_date', label: 'LB Fin', width: '132px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
  { key: 'lb_duration', label: 'LB Duración', width: '110px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
  { key: 'lb_progress', label: 'LB Progreso %', width: '124px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
  { key: 'lb_hours', label: 'LB HH', width: '96px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
  { key: 'lb_cost', label: 'LB Costo USD', width: '132px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
  { key: 'lb_status', label: 'LB Estado', width: '150px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
];

const ALL_COLUMNS = [...FIXED_COLUMNS, ...OPERATIVE_COLUMNS, ...BASELINE_COLUMNS];
const COLUMN_MAP = new Map(ALL_COLUMNS.map((column) => [column.key, column]));

const OPERATIVE_COLUMN_KEYS = OPERATIVE_COLUMNS.map((column) => column.key);
const BASELINE_COLUMN_KEYS = BASELINE_COLUMNS.map((column) => column.key);
const CONFIGURABLE_COLUMN_KEYS = [...OPERATIVE_COLUMN_KEYS, ...BASELINE_COLUMN_KEYS];
const DEFAULT_VISIBLE_KEYS = [...FIXED_COLUMN_KEYS, ...OPERATIVE_COLUMN_KEYS];

const DEFAULT_COLUMN_SETTINGS = {
  visibleKeys: DEFAULT_VISIBLE_KEYS,
  order: CONFIGURABLE_COLUMN_KEYS,
};

function compareValues(a, b, direction = 'asc') {
  const left = a ?? '';
  const right = b ?? '';
  const factor = direction === 'asc' ? 1 : -1;

  const leftNumber = Number(left);
  const rightNumber = Number(right);

  const isNumeric =
    Number.isFinite(leftNumber) &&
    Number.isFinite(rightNumber) &&
    String(left).trim() !== '' &&
    String(right).trim() !== '';

  if (isNumeric) {
    return (leftNumber - rightNumber) * factor;
  }

  return (
    String(left).localeCompare(String(right), 'es', {
      numeric: true,
      sensitivity: 'base',
    }) * factor
  );
}

function buildActivityCellId(rowId, columnKey) {
  return `${rowId}:${columnKey}`;
}

function sanitizeColumnSettings(parsed) {
  const parsedOrder = Array.isArray(parsed?.order) ? parsed.order : [];
  const parsedVisibleKeys = Array.isArray(parsed?.visibleKeys) ? parsed.visibleKeys : [];

  const cleanedOrder = parsedOrder.filter((key) => CONFIGURABLE_COLUMN_KEYS.includes(key));
  const order = cleanedOrder.length
    ? [...cleanedOrder, ...CONFIGURABLE_COLUMN_KEYS.filter((key) => !cleanedOrder.includes(key))]
    : DEFAULT_COLUMN_SETTINGS.order;

  const cleanedVisibleConfigurable = parsedVisibleKeys.filter((key) =>
    CONFIGURABLE_COLUMN_KEYS.includes(key)
  );

  const visibleKeys = [...FIXED_COLUMN_KEYS, ...cleanedVisibleConfigurable];

  return {
    order,
    visibleKeys: visibleKeys.length ? visibleKeys : DEFAULT_COLUMN_SETTINGS.visibleKeys,
  };
}

function readColumnSettings(storageKey) {
  if (!storageKey || typeof window === 'undefined') return DEFAULT_COLUMN_SETTINGS;

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_COLUMN_SETTINGS;
    return sanitizeColumnSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_COLUMN_SETTINGS;
  }
}

function persistColumnSettings(storageKey, settings) {
  if (!storageKey || typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
}

function getVisibleColumns(columnSettings) {
  const middleColumns = columnSettings.order
    .map((key) => COLUMN_MAP.get(key))
    .filter(Boolean)
    .filter((column) => columnSettings.visibleKeys.includes(column.key));

  return [COLUMN_MAP.get('code'), COLUMN_MAP.get('name'), ...middleColumns];
}

function normalizeDateValue(value) {
  if (value === null || value === undefined || value === '') return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : normalized;
}

function formatDate(value) {
  const normalized = normalizeDateValue(value);
  if (!normalized) return '—';

  const [year, month, day] = normalized.split('-');
  if (!year || !month || !day) return normalized;

  return `${day}/${month}/${year}`;
}

function formatNumber(value, digits = 2) {
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

function formatProgress(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `${formatNumber(value, 2)}%`;
}

function getRowCode(row) {
  if (!row) return '';
  return row.type === 'wbs' ? row.code || '' : row.activity_id || '';
}

function getBaselineValue(row, key) {
  const baseline = row?.baseline || {};
  switch (key) {
    case 'lb_start_date':
      return baseline.start_date ?? null;
    case 'lb_end_date':
      return baseline.end_date ?? null;
    case 'lb_duration':
      return baseline.duration ?? null;
    case 'lb_progress':
      return baseline.progress ?? null;
    case 'lb_hours':
      return baseline.hours ?? null;
    case 'lb_cost':
      return baseline.cost ?? null;
    case 'lb_status':
      return baseline.status ?? null;
    default:
      return null;
  }
}

function PlusIcon({ className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TrashIcon({ className = 'h-4 w-4' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4h8v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14H6L5 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6M14 11v6" />
    </svg>
  );
}

function ActionRailButton({ icon, label, onClick, disabled = false, tone = 'default' }) {
  const toneClass =
    tone === 'danger'
      ? 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={[
        'flex h-10 w-10 items-center justify-center rounded-lg border shadow-sm transition',
        toneClass,
        disabled ? 'cursor-not-allowed opacity-50 hover:bg-white' : '',
      ].join(' ')}
    >
      {icon}
    </button>
  );
}

export default function DataTable({
  rows,
  onAddActivity,
  onUpdateActivity,
  onDeleteActivity,
  requestedCellId,
  onRequestedCellHandled,
  columnSettingsKey,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortConfig, setSortConfig] = useState(DEFAULT_SORT);
  const [activeCell, setActiveCell] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [columnSettings, setColumnSettings] = useState(() => readColumnSettings(columnSettingsKey));
  const [selectedRowId, setSelectedRowId] = useState(null);

  const cellRefs = useRef(new Map());

  useEffect(() => {
    setColumnSettings(readColumnSettings(columnSettingsKey));
  }, [columnSettingsKey]);

  useEffect(() => {
    persistColumnSettings(columnSettingsKey, columnSettings);
  }, [columnSettings, columnSettingsKey]);

  const visibleColumns = useMemo(() => getVisibleColumns(columnSettings), [columnSettings]);

  const groupedRows = useMemo(() => {
    const groups = [];
    let currentGroup = null;

    rows.forEach((row) => {
      if (row.type === 'wbs') {
        currentGroup = { wbs: row, activities: [] };
        groups.push(currentGroup);
        return;
      }

      if (row.type === 'activity' && currentGroup) {
        currentGroup.activities.push(row);
      }
    });

    return groups;
  }, [rows]);

  const processedRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const output = [];

    groupedRows.forEach(({ wbs, activities }) => {
      const filteredActivities = activities
        .filter((activity) => {
          const matchesSearch =
            !query ||
            [
              activity.activity_id,
              activity.name,
              activity.status,
              activity.start_date,
              activity.end_date,
              activity.hours,
              activity.cost,
            ].some((value) => String(value || '').toLowerCase().includes(query));

          const matchesStatus = statusFilter === 'ALL' || activity.status === statusFilter;
          return matchesSearch && matchesStatus;
        })
        .sort((left, right) => {
          const leftValue = sortConfig.key === 'code' ? getRowCode(left) : left[sortConfig.key];
          const rightValue = sortConfig.key === 'code' ? getRowCode(right) : right[sortConfig.key];
          return compareValues(leftValue, rightValue, sortConfig.direction);
        });

      const matchesWbs = !query || `${wbs.code} ${wbs.name}`.toLowerCase().includes(query);

      if (matchesWbs || filteredActivities.length > 0) {
        output.push({
          ...wbs,
          visible_direct_activity_count: filteredActivities.length,
          total_direct_activity_count: activities.length,
        });
        output.push(...filteredActivities);
      }
    });

    return output;
  }, [groupedRows, search, sortConfig, statusFilter]);

  const activityRows = useMemo(
    () => processedRows.filter((row) => row.type === 'activity'),
    [processedRows]
  );

  const selectedRow = useMemo(
    () => processedRows.find((row) => row.id === selectedRowId) || null,
    [processedRows, selectedRowId]
  );

  const selectedActivity = selectedRow?.type === 'activity' ? selectedRow : null;

  const editableColumnKeys = useMemo(
    () =>
      visibleColumns
        .filter((column) => !column.readOnly)
        .map((column) => column.key)
        .filter((key) => !BASELINE_COLUMN_KEYS.includes(key)),
    [visibleColumns]
  );

  const editableCells = useMemo(() => {
    const next = [];
    activityRows.forEach((row) => {
      editableColumnKeys.forEach((columnKey) => {
        next.push(buildActivityCellId(row.id, columnKey));
      });
    });
    return next;
  }, [activityRows, editableColumnKeys]);

  function updateColumnSettings(updater) {
    setColumnSettings((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater;
      return sanitizeColumnSettings(next);
    });
  }

  function registerCellRef(cellId) {
    if (!cellRefs.current.has(cellId)) {
      cellRefs.current.set(cellId, { current: null });
    }
    return cellRefs.current.get(cellId);
  }

  function focusCellById(cellId, shouldStartEditing = false) {
    setActiveCell(cellId);
    if (shouldStartEditing) setEditingCell(cellId);

    requestAnimationFrame(() => {
      const targetRef = cellRefs.current.get(cellId);
      if (targetRef?.current) targetRef.current.focus();
    });
  }

  useEffect(() => {
    if (!requestedCellId) return;
    if (!editableCells.includes(requestedCellId)) return;

    setSelectedRowId(requestedCellId.split(':')[0]);
    focusCellById(requestedCellId, true);
    onRequestedCellHandled?.();
  }, [editableCells, onRequestedCellHandled, requestedCellId]);

  useEffect(() => {
    if (!selectedRowId && processedRows.length > 0) {
      const firstActivity = processedRows.find((row) => row.type === 'activity');
      if (firstActivity) setSelectedRowId(firstActivity.id);
    }
  }, [processedRows, selectedRowId]);

  function navigateFrom(cellId, direction) {
    const currentIndex = editableCells.indexOf(cellId);
    if (currentIndex === -1) return;

    if (direction === 'right') {
      const nextCellId = editableCells[currentIndex + 1];
      if (nextCellId) {
        setSelectedRowId(nextCellId.split(':')[0]);
        focusCellById(nextCellId);
      }
      return;
    }

    if (direction === 'left') {
      const previousCellId = editableCells[currentIndex - 1];
      if (previousCellId) {
        setSelectedRowId(previousCellId.split(':')[0]);
        focusCellById(previousCellId);
      }
      return;
    }

    const [rowId, columnKey] = cellId.split(':');
    const rowIndex = activityRows.findIndex((row) => row.id === rowId);
    if (rowIndex === -1) return;

    const siblingRow = direction === 'down' ? activityRows[rowIndex + 1] : activityRows[rowIndex - 1];
    if (!siblingRow) return;

    const nextCellId = buildActivityCellId(siblingRow.id, columnKey);
    setSelectedRowId(siblingRow.id);
    focusCellById(nextCellId);
  }

  function toggleSort(columnKey) {
    const column = COLUMN_MAP.get(columnKey);
    if (!column?.sortable) return;

    setSortConfig((previous) => {
      if (previous.key === columnKey) {
        return {
          key: columnKey,
          direction: previous.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return { key: columnKey, direction: 'asc' };
    });
  }

  function selectRowOnly(row) {
    setSelectedRowId(row.id);
    setActiveCell(null);
    setEditingCell(null);
  }

  function handleCellOpen(row, columnKey, startEditing = false) {
    if (row.type !== 'activity') return;
    if (!editableColumnKeys.includes(columnKey)) return;

    setSelectedRowId(row.id);
    const nextCellId = buildActivityCellId(row.id, columnKey);
    focusCellById(nextCellId, startEditing);
  }

  async function handleAddFromSelection() {
    const targetRow =
      selectedRow ||
      processedRows.find((row) => row.type === 'wbs') ||
      processedRows.find((row) => row.type === 'activity');

    if (!targetRow) return;

    const wbsTarget = targetRow.type === 'activity' ? { id: targetRow.wbs_id } : targetRow;
    await onAddActivity(wbsTarget);
  }

  async function handleDeleteSelected() {
    if (!selectedActivity) return;
    await onDeleteActivity(selectedActivity);
  }

  function renderReadonlyValue(key, value) {
    if (['start_date', 'end_date', 'lb_start_date', 'lb_end_date'].includes(key)) {
      return formatDate(value);
    }
    if (key === 'duration' || key === 'lb_duration') {
      return value ?? '—';
    }
    if (key === 'progress' || key === 'lb_progress') {
      return formatProgress(value);
    }
    if (key === 'hours' || key === 'lb_hours') {
      return value === null || value === undefined || value === '' ? '—' : formatNumber(value);
    }
    if (key === 'cost' || key === 'lb_cost') {
      return value === null || value === undefined || value === '' ? '—' : formatCurrency(value);
    }
    if (key === 'status' || key === 'lb_status') {
      return value || '—';
    }
    return value || '—';
  }

  function renderWbsCell(row, column, isSelectedRow = false) {
    const baseClass = `border-b border-slate-200 px-2 py-1 text-xs ${isSelectedRow ? 'bg-sky-100' : 'bg-slate-50'}`;

    if (column.key === 'code') {
      return <div className={`${baseClass} font-semibold text-slate-700`}>{row.code}</div>;
    }

    if (column.key === 'name') {
      return (
        <div className={`${baseClass} font-semibold text-slate-800`}>
          <div className="flex items-center gap-2">
            <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-700">
              WBS
            </span>
            <span>{row.name}</span>
            {row.rollup_activity_count > 0 ? (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
                {row.rollup_activity_count} act.
              </span>
            ) : null}
          </div>
        </div>
      );
    }

    if (BASELINE_COLUMN_KEYS.includes(column.key)) {
      return <div className={`${baseClass} text-slate-400`}>—</div>;
    }

    if (column.key === 'start_date') {
      return <div className={baseClass}>{formatDate(row.rollup_start_date)}</div>;
    }
    if (column.key === 'end_date') {
      return <div className={baseClass}>{formatDate(row.rollup_end_date)}</div>;
    }
    if (column.key === 'duration') {
      return <div className={baseClass}>{row.rollup_duration || '—'}</div>;
    }
    if (column.key === 'progress') {
      return <div className={baseClass}>{formatProgress(row.rollup_progress)}</div>;
    }
    if (column.key === 'hours') {
      return <div className={baseClass}>{formatNumber(row.rollup_hours)}</div>;
    }
    if (column.key === 'cost') {
      return <div className={baseClass}>{formatCurrency(row.rollup_cost)}</div>;
    }
    if (column.key === 'status') {
      return (
        <div className={baseClass}>
          {row.visible_direct_activity_count}/{row.total_direct_activity_count} directas visibles
        </div>
      );
    }

    return <div className={baseClass}>—</div>;
  }

  function renderActivityCell(row, column) {
    const isSelectedRow = selectedRowId === row.id;
    const baseCellClass = `border-b border-slate-100 px-2 py-1 text-xs ${isSelectedRow ? 'bg-sky-100' : 'bg-white'}`;
    const cellId = buildActivityCellId(row.id, column.key);

    if (BASELINE_COLUMN_KEYS.includes(column.key)) {
      return <div className={baseCellClass}>{renderReadonlyValue(column.key, getBaselineValue(row, column.key))}</div>;
    }

    const commonProps = {
      inputRef: registerCellRef(cellId),
      isActive: activeCell === cellId,
      startEditing: editingCell === cellId,
      onEditingHandled: () => {
        setEditingCell((previous) => (previous === cellId ? null : previous));
      },
      onActivate: () => {
        setSelectedRowId(row.id);
        setActiveCell(cellId);
      },
      onNavigate: (direction) => navigateFrom(cellId, direction),
    };

    if (column.key === 'code') {
      return (
        <EditableCell
          value={row.activity_id || ''}
          className={baseCellClass}
          {...commonProps}
          onCommit={(value) => onUpdateActivity(row, { activity_id: value })}
        />
      );
    }

    if (column.key === 'name') {
      return (
        <EditableCell
          value={row.name || ''}
          className={baseCellClass}
          {...commonProps}
          onCommit={(value) => onUpdateActivity(row, { name: value })}
        />
      );
    }

    if (column.key === 'start_date' || column.key === 'end_date') {
      return (
        <EditableCell
          value={normalizeDateValue(row[column.key]) || ''}
          className={baseCellClass}
          type="date"
          {...commonProps}
          onCommit={(value) => onUpdateActivity(row, { [column.key]: value })}
        />
      );
    }

    if (column.key === 'duration') {
      return <div className={baseCellClass}>{row.duration ?? '—'}</div>;
    }

    if (column.key === 'progress' || column.key === 'hours' || column.key === 'cost') {
      return (
        <EditableCell
          value={row[column.key] ?? 0}
          className={baseCellClass}
          type="number"
          {...commonProps}
          onCommit={(value) => onUpdateActivity(row, { [column.key]: Number(value || 0) })}
        />
      );
    }

    if (column.key === 'status') {
      return (
        <EditableCell
          value={row.status || ''}
          className={baseCellClass}
          type="select"
          options={STATUS_OPTIONS}
          {...commonProps}
          onCommit={(value) => onUpdateActivity(row, { status: value })}
        />
      );
    }

    return <div className={baseCellClass}>{renderReadonlyValue(column.key, row[column.key])}</div>;
  }

  const modalColumns = useMemo(() => ALL_COLUMNS.map((column) => ({ ...column })), []);
  const visibleConfigurableKeys = columnSettings.visibleKeys.filter((key) =>
    CONFIGURABLE_COLUMN_KEYS.includes(key)
  );
  const gridTemplateColumns = visibleColumns.map((column) => column.width).join(' ');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por WBS, código, actividad o estado"
            className="w-72 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
          >
            <option value="ALL">Todos los estados</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowColumnPanel(true)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
          >
            Columnas...
          </button>
        </div>

        <div className="text-xs text-slate-500">{activityRows.length} actividades visibles</div>
      </div>

      <div className="flex gap-3">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="max-h-[68vh] overflow-auto">
            <div
              className="sticky top-0 z-10 grid border-b border-slate-200 bg-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-600"
              style={{ gridTemplateColumns }}
            >
              {visibleColumns.map((column) => {
                const isSorted = sortConfig.key === column.key;
                return (
                  <button
                    key={column.key}
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className={`flex items-center gap-1 px-2 py-2 text-left ${
                      column.sortable ? 'hover:bg-slate-200' : 'cursor-default'
                    }`}
                  >
                    <span>{column.label}</span>
                    {column.sortable ? (
                      <span className="text-[10px] text-slate-400">
                        {isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {processedRows.length === 0 ? (
              <div className="px-3 py-6 text-sm text-slate-500">No hay datos para mostrar.</div>
            ) : (
              processedRows.map((row) => {
                const isSelectedRow = selectedRowId === row.id;
                return (
                  <div
                    key={row.id}
                    className={`grid ${isSelectedRow ? 'ring-1 ring-inset ring-sky-300' : ''}`}
                    style={{ gridTemplateColumns }}
                    onClick={() => selectRowOnly(row)}
                  >
                    {visibleColumns.map((column) => (
                      <div
                        key={`${row.id}:${column.key}`}
                        onDoubleClick={() => handleCellOpen(row, column.key, row.type === 'activity')}
                      >
                        {row.type === 'wbs'
                          ? renderWbsCell(row, column, isSelectedRow)
                          : renderActivityCell(row, column)}
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
            Acciones
          </div>

          <div className="flex flex-col items-center gap-2">
            <ActionRailButton
              icon={<PlusIcon />}
              label="Agregar actividad"
              onClick={handleAddFromSelection}
              disabled={!selectedRow}
            />

            <ActionRailButton
              icon={<TrashIcon />}
              label="Eliminar actividad"
              tone="danger"
              onClick={handleDeleteSelected}
              disabled={!selectedActivity}
            />
          </div>
        </aside>
      </div>

      <ColumnSelectorModal
        isOpen={showColumnPanel}
        columns={modalColumns}
        fixedKeys={FIXED_COLUMN_KEYS}
        selectedKeys={visibleConfigurableKeys}
        defaultSelectedKeys={OPERATIVE_COLUMN_KEYS}
        onClose={() => setShowColumnPanel(false)}
        onApply={(selectedKeys) => {
          const cleanedSelected = Array.isArray(selectedKeys)
            ? selectedKeys.filter((key) => CONFIGURABLE_COLUMN_KEYS.includes(key))
            : [];

          updateColumnSettings({
            visibleKeys: [...FIXED_COLUMN_KEYS, ...cleanedSelected],
            order: [
              ...cleanedSelected,
              ...CONFIGURABLE_COLUMN_KEYS.filter((key) => !cleanedSelected.includes(key)),
            ],
          });

          setShowColumnPanel(false);
        }}
      />
    </div>
  );
}
