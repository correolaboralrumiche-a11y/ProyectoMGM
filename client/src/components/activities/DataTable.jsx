import { useEffect, useMemo, useRef, useState } from 'react';
import EditableCell from './EditableCell';
import ColumnSelectorModal from './ColumnSelectorModal';

const FIXED_COLUMN_KEYS = ['code', 'name'];
const DEFAULT_SORT = { key: 'code', direction: 'asc' };

const FIXED_COLUMNS = [
  { key: 'code', label: 'Código', width: '140px', sortable: true, fixed: true, mandatory: true, configurable: false },
  { key: 'name', label: 'Actividad', width: 'minmax(320px, 2.8fr)', sortable: true, fixed: true, mandatory: true, configurable: false },
];

const OPERATIVE_COLUMNS = [
  { key: 'discipline_code', label: 'Disciplina', width: '150px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'activity_type_code', label: 'Tipo', width: '140px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'priority_code', label: 'Prioridad', width: '132px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'start_date', label: 'Inicio', width: '132px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'end_date', label: 'Fin', width: '132px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'duration', label: 'Duración', width: '104px', sortable: true, readOnly: true, configurable: true, group: 'Operativas' },
  { key: 'progress', label: 'Progreso %', width: '116px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'hours', label: 'HH', width: '96px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'cost', label: 'Costo', width: '128px', sortable: true, configurable: true, group: 'Operativas' },
  { key: 'ev_amount', label: 'EV', width: '128px', sortable: true, readOnly: true, configurable: true, group: 'Operativas' },
  { key: 'status_code', label: 'Estado', width: '150px', sortable: true, configurable: true, group: 'Operativas' },
];

const BASELINE_COLUMNS = [
  { key: 'lb_start_date', label: 'LB Inicio', width: '132px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
  { key: 'lb_end_date', label: 'LB Fin', width: '132px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
  { key: 'lb_duration', label: 'LB Duración', width: '110px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
  { key: 'lb_progress', label: 'LB Progreso %', width: '124px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
  { key: 'lb_hours', label: 'LB HH', width: '96px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
  { key: 'lb_cost', label: 'LB Costo', width: '132px', sortable: false, readOnly: true, configurable: true, group: 'Línea Base' },
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

function buildOptionMap(options = []) {
  const map = new Map();
  (options || []).forEach((item) => {
    const value = typeof item === 'string' ? item : item?.value ?? item?.code;
    const label = typeof item === 'string' ? item : item?.label ?? item?.name ?? item?.code;
    if (value) {
      map.set(String(value), label || value);
    }
  });
  return map;
}

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

  return String(left).localeCompare(String(right), 'es', {
    numeric: true,
    sensitivity: 'base',
  }) * factor;
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

  const cleanedVisibleConfigurable = parsedVisibleKeys.filter((key) => CONFIGURABLE_COLUMN_KEYS.includes(key));
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
      return baseline.status ?? baseline.status_name ?? null;
    default:
      return null;
  }
}

function PlusIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M6.5 6.5v8m3-8v8m3-8v8M4.5 5.5h11M7.5 3.75h5l.5 1.75h-6z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ColumnIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4 4.5h12v11H4zM8 4.5v11M12 4.5v11" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function ActionButton({ icon, label, onClick, disabled = false, tone = 'default' }) {
  const toneClass = tone === 'danger'
    ? 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${toneClass}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Toolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  visibleActivityCount,
  totalRowCount,
  onOpenColumnPanel,
  onAdd,
  onDelete,
  selectedRow,
  selectedActivity,
}) {
  return (
    <div className="activity-workbench-toolbar sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[260px] flex-1 xl:w-[360px] xl:flex-none">
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar por WBS, código, actividad o clasificación"
              className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value)}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          >
            <option value="ALL">Todos los estados</option>
            {(statusOptions || []).map((status) => {
              const value = status?.code ?? status?.value ?? status;
              const label = status?.name ?? status?.label ?? status?.code ?? status;
              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {visibleActivityCount} actividades visibles · {totalRowCount} filas
          </div>
          <ActionButton icon={<ColumnIcon />} label="Columnas" onClick={onOpenColumnPanel} />
          <ActionButton icon={<PlusIcon />} label="Agregar actividad" onClick={onAdd} disabled={!selectedRow} />
          <ActionButton
            icon={<TrashIcon />}
            label="Eliminar actividad"
            tone="danger"
            onClick={onDelete}
            disabled={!selectedActivity}
          />
        </div>
      </div>
    </div>
  );
}

function HeaderRow({ visibleColumns, sortConfig, onToggleSort, gridTemplateColumns }) {
  return (
    <div
      className="activity-grid-header sticky top-[70px] z-10 grid min-w-max border-b border-slate-200 bg-slate-100/95 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 backdrop-blur"
      style={{ gridTemplateColumns }}
    >
      {visibleColumns.map((column, index) => {
        const isSorted = sortConfig.key === column.key;
        const stickyClass = index < 2 ? `activity-sticky-col activity-sticky-col-${index}` : '';

        return (
          <button
            key={column.key}
            type="button"
            onClick={() => onToggleSort(column.key)}
            className={`flex min-h-[42px] items-center gap-1 border-r border-slate-200 px-3 text-left ${column.sortable ? 'hover:bg-slate-200/70' : 'cursor-default'} ${stickyClass}`}
          >
            <span>{column.label}</span>
            {column.sortable ? (
              <span className="text-[10px] text-slate-400">{isSorted ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function WbsNameCell({ row }) {
  return (
    <div className="flex min-h-[42px] items-center gap-3">
      <span className="inline-flex h-6 items-center rounded-full border border-sky-200 bg-sky-50 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700">
        WBS
      </span>
      <div className="min-w-0">
        <div className="truncate font-semibold text-slate-900">{row.name}</div>
        <div className="mt-0.5 text-[11px] text-slate-500">
          {row.rollup_activity_count > 0 ? `${row.rollup_activity_count} act.` : 'Sin actividades directas'}
        </div>
      </div>
    </div>
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
  statusOptions = [],
  activityTypeOptions = [],
  priorityOptions = [],
  disciplineOptions = [],
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

  const statusMap = useMemo(() => buildOptionMap(statusOptions), [statusOptions]);
  const typeMap = useMemo(() => buildOptionMap(activityTypeOptions), [activityTypeOptions]);
  const priorityMap = useMemo(() => buildOptionMap(priorityOptions), [priorityOptions]);
  const disciplineMap = useMemo(() => buildOptionMap(disciplineOptions), [disciplineOptions]);

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

    groupedRows.forEach(({ wbs, activities: groupActivities }) => {
      const filteredActivities = groupActivities
        .filter((activity) => {
          const searchBlob = [
            activity.activity_id,
            activity.name,
            activity.status_name || statusMap.get(String(activity.status_code || '')) || activity.status_code,
            activity.activity_type_name || typeMap.get(String(activity.activity_type_code || '')) || activity.activity_type_code,
            activity.priority_name || priorityMap.get(String(activity.priority_code || '')) || activity.priority_code,
            activity.discipline_name || disciplineMap.get(String(activity.discipline_code || '')) || activity.discipline_code,
            activity.start_date,
            activity.end_date,
            activity.hours,
            activity.cost,
          ]
            .join(' ')
            .toLowerCase();

          const matchesSearch = !query || searchBlob.includes(query);
          const activityStatus = String(activity.status_code || activity.status || '');
          const matchesStatus = statusFilter === 'ALL' || activityStatus === statusFilter;
          return matchesSearch && matchesStatus;
        })
        .sort((left, right) => {
          const leftValue = sortConfig.key === 'code' ? getRowCode(left) : left[sortConfig.key] ?? '';
          const rightValue = sortConfig.key === 'code' ? getRowCode(right) : right[sortConfig.key] ?? '';
          return compareValues(leftValue, rightValue, sortConfig.direction);
        });

      const matchesWbs = !query || `${wbs.code} ${wbs.name}`.toLowerCase().includes(query);

      if (matchesWbs || filteredActivities.length > 0) {
        output.push({
          ...wbs,
          visible_direct_activity_count: filteredActivities.length,
          total_direct_activity_count: groupActivities.length,
        });
        output.push(...filteredActivities);
      }
    });

    return output;
  }, [groupedRows, search, sortConfig, statusFilter, statusMap, typeMap, priorityMap, disciplineMap]);

  const activityRows = useMemo(() => processedRows.filter((row) => row.type === 'activity'), [processedRows]);
  const selectedRow = useMemo(() => processedRows.find((row) => row.id === selectedRowId) || null, [processedRows, selectedRowId]);
  const selectedActivity = selectedRow?.type === 'activity' ? selectedRow : null;

  const editableColumnKeys = useMemo(
    () =>
      visibleColumns
        .filter((column) => !column.readOnly)
        .map((column) => column.key)
        .filter((key) => !BASELINE_COLUMN_KEYS.includes(key)),
    [visibleColumns],
  );

  const editableCells = useMemo(() => {
    const next = [];
    activityRows.forEach((row) => {
      editableColumnKeys.forEach((columnKey) => next.push(buildActivityCellId(row.id, columnKey)));
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
    if (shouldStartEditing) {
      setEditingCell(cellId);
    }
    requestAnimationFrame(() => {
      const targetRef = cellRefs.current.get(cellId);
      if (targetRef?.current) {
        targetRef.current.focus();
      }
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
      if (firstActivity) {
        setSelectedRowId(firstActivity.id);
      }
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

    setSortConfig((previous) =>
      previous.key === columnKey
        ? { key: columnKey, direction: previous.direction === 'asc' ? 'desc' : 'asc' }
        : { key: columnKey, direction: 'asc' },
    );
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
      selectedRow || processedRows.find((row) => row.type === 'wbs') || processedRows.find((row) => row.type === 'activity');
    if (!targetRow) return;
    const wbsTarget = targetRow.type === 'activity' ? { id: targetRow.wbs_id } : targetRow;
    await onAddActivity(wbsTarget);
  }

  async function handleDeleteSelected() {
    if (!selectedActivity) return;
    await onDeleteActivity(selectedActivity);
  }

  function resolveDisplayLabel(columnKey, row) {
    if (columnKey === 'status_code') {
      return row.status_name || statusMap.get(String(row.status_code || '')) || row.status_code || '—';
    }
    if (columnKey === 'activity_type_code') {
      return row.activity_type_name || typeMap.get(String(row.activity_type_code || '')) || row.activity_type_code || '—';
    }
    if (columnKey === 'priority_code') {
      return row.priority_name || priorityMap.get(String(row.priority_code || '')) || row.priority_code || '—';
    }
    if (columnKey === 'discipline_code') {
      return row.discipline_name || disciplineMap.get(String(row.discipline_code || '')) || row.discipline_code || '—';
    }
    return row[columnKey];
  }

  function renderReadonlyValue(key, value) {
    if (['start_date', 'end_date', 'lb_start_date', 'lb_end_date'].includes(key)) return formatDate(value);
    if (key === 'duration' || key === 'lb_duration') return value ?? '—';
    if (key === 'progress' || key === 'lb_progress') return formatProgress(value);
    if (key === 'hours' || key === 'lb_hours') {
      return value === null || value === undefined || value === '' ? '—' : formatNumber(value);
    }
    if (key === 'cost' || key === 'lb_cost' || key === 'ev_amount') {
      return value === null || value === undefined || value === '' ? '—' : formatCurrency(value);
    }
    if (['status_code', 'lb_status', 'activity_type_code', 'priority_code', 'discipline_code'].includes(key)) {
      return value || '—';
    }
    return value || '—';
  }

  function renderWbsCell(row, column, isSelectedRow = false, columnIndex = 0) {
    const stickyClass = columnIndex < 2 ? `activity-sticky-col activity-sticky-col-${columnIndex}` : '';
    const baseClass = `border-r border-slate-200 px-3 py-2 text-xs ${isSelectedRow ? 'bg-sky-50' : 'bg-slate-50'} ${stickyClass}`;

    if (column.key === 'code') {
      return (
        <div className={baseClass}>
          <div className="font-semibold text-slate-700">{row.code}</div>
        </div>
      );
    }

    if (column.key === 'name') {
      return (
        <div className={baseClass}>
          <WbsNameCell row={row} />
        </div>
      );
    }

    if (BASELINE_COLUMN_KEYS.includes(column.key)) {
      return <div className={baseClass}>{renderReadonlyValue(column.key, getBaselineValue(row, column.key))}</div>;
    }

    if (column.key === 'start_date') return <div className={baseClass}>{formatDate(row.rollup_start_date)}</div>;
    if (column.key === 'end_date') return <div className={baseClass}>{formatDate(row.rollup_end_date)}</div>;
    if (column.key === 'duration') return <div className={baseClass}>{row.rollup_duration || '—'}</div>;
    if (column.key === 'progress') return <div className={baseClass}>{formatProgress(row.rollup_progress)}</div>;
    if (column.key === 'hours') return <div className={baseClass}>{formatNumber(row.rollup_hours)}</div>;
    if (column.key === 'cost') return <div className={baseClass}>{formatCurrency(row.rollup_cost)}</div>;
    if (column.key === 'ev_amount') return <div className={baseClass}>{formatCurrency(row.rollup_ev_amount)}</div>;

    if (column.key === 'status_code') {
      return (
        <div className={baseClass}>
          {row.visible_direct_activity_count}/{row.total_direct_activity_count} directas visibles
        </div>
      );
    }

    return <div className={baseClass}>—</div>;
  }

  function renderActivityCell(row, column, columnIndex = 0) {
    const isSelectedRow = selectedRowId === row.id;
    const stickyClass = columnIndex < 2 ? `activity-sticky-col activity-sticky-col-${columnIndex}` : '';
    const baseCellClass = `border-r border-slate-200 px-0 py-0 text-xs ${isSelectedRow ? 'bg-sky-50' : 'bg-white'} ${stickyClass}`;
    const cellId = buildActivityCellId(row.id, column.key);

    if (BASELINE_COLUMN_KEYS.includes(column.key)) {
      return <div className={baseCellClass}>{renderReadonlyValue(column.key, getBaselineValue(row, column.key))}</div>;
    }

    const commonProps = {
      inputRef: registerCellRef(cellId),
      isActive: activeCell === cellId,
      startEditing: editingCell === cellId,
      onEditingHandled: () => setEditingCell((previous) => (previous === cellId ? null : previous)),
      onActivate: () => {
        setSelectedRowId(row.id);
        setActiveCell(cellId);
      },
      onNavigate: (direction) => navigateFrom(cellId, direction),
    };

    if (column.key === 'code') {
      return (
        <div className={baseCellClass}>
          <EditableCell value={row.activity_id} onCommit={(value) => onUpdateActivity(row, { activity_id: value })} {...commonProps} />
        </div>
      );
    }

    if (column.key === 'name') {
      return (
        <div className={baseCellClass}>
          <EditableCell value={row.name} onCommit={(value) => onUpdateActivity(row, { name: value })} {...commonProps} />
        </div>
      );
    }

    if (column.key === 'start_date' || column.key === 'end_date') {
      return (
        <div className={baseCellClass}>
          <EditableCell type="date" value={row[column.key]} onCommit={(value) => onUpdateActivity(row, { [column.key]: value })} {...commonProps} />
        </div>
      );
    }

    if (column.key === 'duration') {
      return <div className={`${baseCellClass} flex min-h-[38px] items-center px-3 text-slate-600`}>{row.duration ?? '—'}</div>;
    }

    if (column.key === 'ev_amount') {
      return <div className={`${baseCellClass} flex min-h-[38px] items-center px-3 text-slate-700`}>{renderReadonlyValue(column.key, row.ev_amount)}</div>;
    }

    if (column.key === 'progress' || column.key === 'hours' || column.key === 'cost') {
      return (
        <div className={baseCellClass}>
          <EditableCell type="number" value={row[column.key]} onCommit={(value) => onUpdateActivity(row, { [column.key]: Number(value || 0) })} {...commonProps} />
        </div>
      );
    }

    if (column.key === 'status_code') {
      return (
        <div className={baseCellClass}>
          <EditableCell type="select" value={row.status_code} options={statusOptions} onCommit={(value) => onUpdateActivity(row, { status_code: value })} {...commonProps} />
        </div>
      );
    }

    if (column.key === 'activity_type_code') {
      return (
        <div className={baseCellClass}>
          <EditableCell type="select" value={row.activity_type_code} options={activityTypeOptions} onCommit={(value) => onUpdateActivity(row, { activity_type_code: value })} {...commonProps} />
        </div>
      );
    }

    if (column.key === 'priority_code') {
      return (
        <div className={baseCellClass}>
          <EditableCell type="select" value={row.priority_code} options={priorityOptions} onCommit={(value) => onUpdateActivity(row, { priority_code: value })} {...commonProps} />
        </div>
      );
    }

    if (column.key === 'discipline_code') {
      return (
        <div className={baseCellClass}>
          <EditableCell type="select" value={row.discipline_code} options={disciplineOptions} onCommit={(value) => onUpdateActivity(row, { discipline_code: value })} {...commonProps} />
        </div>
      );
    }

    return <div className={`${baseCellClass} flex min-h-[38px] items-center px-3 text-slate-700`}>{renderReadonlyValue(column.key, resolveDisplayLabel(column.key, row))}</div>;
  }

  const modalColumns = useMemo(() => ALL_COLUMNS.map((column) => ({ ...column })), []);
  const visibleConfigurableKeys = columnSettings.visibleKeys.filter((key) => CONFIGURABLE_COLUMN_KEYS.includes(key));
  const gridTemplateColumns = visibleColumns.map((column) => column.width).join(' ');

  return (
    <div className="space-y-3">
      <Toolbar
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        statusOptions={statusOptions}
        visibleActivityCount={activityRows.length}
        totalRowCount={processedRows.length}
        onOpenColumnPanel={() => setShowColumnPanel(true)}
        onAdd={handleAddFromSelection}
        onDelete={handleDeleteSelected}
        selectedRow={selectedRow}
        selectedActivity={selectedActivity}
      />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Hoja tabular</div>
            <div className="mt-1 text-sm text-slate-700">
              Selección actual: {selectedRow ? (selectedRow.type === 'wbs' ? `WBS ${selectedRow.code}` : `${selectedRow.activity_id || 'Sin código'} · ${selectedRow.name}`) : 'Sin fila seleccionada'}
            </div>
          </div>
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {visibleColumns.length} columnas visibles
          </div>
        </div>

        <div className="activity-grid-scroll max-h-[68vh] overflow-auto rounded-b-2xl">
          <HeaderRow visibleColumns={visibleColumns} sortConfig={sortConfig} onToggleSort={toggleSort} gridTemplateColumns={gridTemplateColumns} />

          {processedRows.length === 0 ? (
            <div className="flex min-h-[220px] items-center justify-center px-6 text-sm text-slate-500">
              No hay datos para mostrar.
            </div>
          ) : (
            processedRows.map((row) => {
              const isSelectedRow = selectedRowId === row.id;
              const rowClass = row.type === 'wbs'
                ? 'activity-grid-row activity-grid-row-wbs'
                : `activity-grid-row ${isSelectedRow ? 'activity-grid-row-selected' : ''}`;

              return (
                <div
                  key={row.id}
                  className={rowClass}
                  style={{ gridTemplateColumns }}
                  onClick={() => selectRowOnly(row)}
                >
                  {visibleColumns.map((column, columnIndex) => (
                    <div
                      key={`${row.id}:${column.key}`}
                      className="min-h-[42px]"
                      onDoubleClick={() => handleCellOpen(row, column.key, row.type === 'activity')}
                    >
                      {row.type === 'wbs'
                        ? renderWbsCell(row, column, isSelectedRow, columnIndex)
                        : renderActivityCell(row, column, columnIndex)}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      <ColumnSelectorModal
        isOpen={showColumnPanel}
        columns={modalColumns}
        fixedKeys={FIXED_COLUMN_KEYS}
        selectedKeys={visibleConfigurableKeys}
        defaultSelectedKeys={DEFAULT_VISIBLE_KEYS.filter((key) => CONFIGURABLE_COLUMN_KEYS.includes(key))}
        onClose={() => setShowColumnPanel(false)}
        onApply={(selectedKeys) => {
          const cleanedSelected = Array.isArray(selectedKeys)
            ? selectedKeys.filter((key) => CONFIGURABLE_COLUMN_KEYS.includes(key))
            : [];

          updateColumnSettings({
            visibleKeys: [...FIXED_COLUMN_KEYS, ...cleanedSelected],
            order: [...cleanedSelected, ...CONFIGURABLE_COLUMN_KEYS.filter((key) => !cleanedSelected.includes(key))],
          });
          setShowColumnPanel(false);
        }}
      />
    </div>
  );
}
