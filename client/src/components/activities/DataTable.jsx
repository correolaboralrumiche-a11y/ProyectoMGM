import { useEffect, useMemo, useRef, useState } from 'react';
import EditableCell from './EditableCell';
import ColumnSelectorModal from './ColumnSelectorModal';

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
const FIXED_COLUMN_KEYS = ['activity_id', 'name'];
const DEFAULT_SORT = { key: 'activity_id', direction: 'asc' };

const COLUMNS = [
  { key: 'activity_id', label: 'Activity ID', width: '150px', mandatory: true, fixed: true, sortable: true },
  { key: 'name', label: 'Actividad', width: 'minmax(340px, 2.8fr)', mandatory: true, fixed: true, sortable: true },
  { key: 'start_date', label: 'Inicio', width: '132px', configurable: true, sortable: true },
  { key: 'end_date', label: 'Fin', width: '132px', configurable: true, sortable: true },
  { key: 'duration', label: 'Duración', width: '104px', configurable: true, readOnly: true, sortable: true },
  { key: 'progress', label: 'Progreso %', width: '116px', configurable: true, sortable: true },
  { key: 'hours', label: 'HH', width: '96px', configurable: true, sortable: true },
  { key: 'cost', label: 'Costo USD', width: '128px', configurable: true, sortable: true },
  { key: 'status', label: 'Estado', width: '150px', configurable: true, sortable: true },
];

const COLUMN_MAP = new Map(COLUMNS.map((column) => [column.key, column]));
const CONFIGURABLE_COLUMN_KEYS = COLUMNS.filter((column) => column.configurable).map((column) => column.key);
const DEFAULT_VISIBLE_KEYS = [...FIXED_COLUMN_KEYS, ...CONFIGURABLE_COLUMN_KEYS];
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
  const numericComparison = Number.isFinite(leftNumber)
    && Number.isFinite(rightNumber)
    && String(left).trim() !== ''
    && String(right).trim() !== '';

  if (numericComparison) {
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

function readColumnSettings(storageKey) {
  if (!storageKey || typeof window === 'undefined') {
    return DEFAULT_COLUMN_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return DEFAULT_COLUMN_SETTINGS;

    const parsed = JSON.parse(raw);
    const order = Array.isArray(parsed?.order)
      ? CONFIGURABLE_COLUMN_KEYS.filter((key) => parsed.order.includes(key))
      : DEFAULT_COLUMN_SETTINGS.order;

    const visibleKeys = Array.isArray(parsed?.visibleKeys)
      ? DEFAULT_VISIBLE_KEYS.filter((key) => FIXED_COLUMN_KEYS.includes(key) || parsed.visibleKeys.includes(key))
      : DEFAULT_COLUMN_SETTINGS.visibleKeys;

    return {
      order: order.length ? [...order, ...CONFIGURABLE_COLUMN_KEYS.filter((key) => !order.includes(key))] : DEFAULT_COLUMN_SETTINGS.order,
      visibleKeys: visibleKeys.length ? visibleKeys : DEFAULT_COLUMN_SETTINGS.visibleKeys,
    };
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

  return [COLUMN_MAP.get('activity_id'), COLUMN_MAP.get('name'), ...middleColumns];
}

function formatDate(value) {
  return value || '—';
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
  return `${formatNumber(value, 2)}%`;
}

function ActionRailButton({ icon, label, onClick, disabled = false, tone = 'default' }) {
  const toneClass = tone === 'danger'
    ? 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm shadow-sm transition ${toneClass} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <span>{icon}</span>
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
        currentGroup = {
          wbs: row,
          activities: [],
        };
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
          const matchesSearch = !query || [
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
        .sort((left, right) => compareValues(left[sortConfig.key], right[sortConfig.key], sortConfig.direction));

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
    () => visibleColumns.filter((column) => !column.readOnly).map((column) => column.key),
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
      return {
        order: [...next.order],
        visibleKeys: [...next.visibleKeys],
      };
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

    focusCellById(requestedCellId, true);
    const requestedRowId = requestedCellId.split(':')[0];
    setSelectedRowId(requestedRowId);
    onRequestedCellHandled?.();
  }, [editableCells, onRequestedCellHandled, requestedCellId]);

  useEffect(() => {
    if (!activeCell) {
      if (editableCells.length > 0) {
        setActiveCell(editableCells[0]);
      }
      return;
    }

    if (!editableCells.includes(activeCell)) {
      setActiveCell(editableCells[0] || null);
    }
  }, [activeCell, editableCells]);

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
    setSortConfig((previous) => {
      if (previous.key === columnKey) {
        return {
          key: columnKey,
          direction: previous.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        key: columnKey,
        direction: 'asc',
      };
    });
  }

  function handleRowSelection(row, preferredColumnKey = null, shouldStartEditing = false) {
    setSelectedRowId(row.id);

    if (row.type !== 'activity') {
      setActiveCell(null);
      setEditingCell(null);
      return;
    }

    const columnKey = preferredColumnKey || (activeCell?.startsWith(`${row.id}:`) ? activeCell.split(':')[1] : 'name');
    const nextCellId = buildActivityCellId(row.id, columnKey);
    focusCellById(nextCellId, shouldStartEditing);
  }

  async function handleAddFromSelection() {
    const targetRow = selectedRow || processedRows.find((row) => row.type === 'wbs') || processedRows.find((row) => row.type === 'activity');
    if (!targetRow) return;

    const wbsTarget = targetRow.type === 'activity'
      ? { id: targetRow.wbs_id }
      : targetRow;

    await onAddActivity(wbsTarget);
  }

  async function handleDeleteSelected() {
    if (!selectedActivity) return;
    await onDeleteActivity(selectedActivity);
  }

  function renderWbsCell(row, column, isSelectedRow = false) {
    const baseClass = `border-b border-slate-200 ${isSelectedRow ? 'bg-sky-100' : 'bg-slate-50'} px-2 py-1 text-xs`;

    if (column.key === 'activity_id') {
      return <div className={`${baseClass} font-semibold text-slate-600`}>{row.code}</div>;
    }

    if (column.key === 'name') {
      return (
        <div className={`${baseClass} font-semibold text-slate-800`}>
          <div style={{ paddingLeft: `${row.level * 18}px` }} className="flex items-center gap-2">
            <span className="inline-flex min-w-[38px] items-center justify-center rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
              WBS
            </span>
            <span>{row.name}</span>
            {row.rollup_activity_count > 0 ? (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {row.rollup_activity_count} act.
              </span>
            ) : null}
          </div>
        </div>
      );
    }

    if (column.key === 'start_date') {
      return <div className={`${baseClass} text-slate-700`}>{formatDate(row.rollup_start_date)}</div>;
    }

    if (column.key === 'end_date') {
      return <div className={`${baseClass} text-slate-700`}>{formatDate(row.rollup_end_date)}</div>;
    }

    if (column.key === 'duration') {
      return <div className={`${baseClass} text-slate-700`}>{row.rollup_duration || '—'}</div>;
    }

    if (column.key === 'progress') {
      return <div className={`${baseClass} font-medium text-slate-700`}>{formatProgress(row.rollup_progress)}</div>;
    }

    if (column.key === 'hours') {
      return <div className={`${baseClass} font-medium text-slate-700`}>{formatNumber(row.rollup_hours)}</div>;
    }

    if (column.key === 'cost') {
      return <div className={`${baseClass} font-medium text-slate-700`}>{formatCurrency(row.rollup_cost)}</div>;
    }

    if (column.key === 'status') {
      return (
        <div className={`${baseClass} text-slate-500`}>
          {row.visible_direct_activity_count}/{row.total_direct_activity_count} directas visibles
        </div>
      );
    }

    return <div className={baseClass} />;
  }

  function renderActivityCell(row, column) {
    const isSelectedRow = selectedRowId === row.id;
    const baseCellClass = `border-b border-slate-100 px-2 py-1 text-xs ${isSelectedRow ? 'bg-sky-100' : 'bg-white'}`;
    const cellId = buildActivityCellId(row.id, column.key);
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

    if (column.key === 'activity_id') {
      return (
        <div className={baseCellClass}>
          <EditableCell
            {...commonProps}
            value={row.activity_id || ''}
            onCommit={(value) => onUpdateActivity(row, { activity_id: value })}
          />
        </div>
      );
    }

    if (column.key === 'name') {
      return (
        <div className={baseCellClass}>
          <div style={{ paddingLeft: `${(row.level + 1) * 18}px` }}>
            <EditableCell
              {...commonProps}
              value={row.name}
              onCommit={(value) => onUpdateActivity(row, { name: value })}
            />
          </div>
        </div>
      );
    }

    if (column.key === 'start_date' || column.key === 'end_date') {
      return (
        <div className={baseCellClass}>
          <EditableCell
            {...commonProps}
            value={row[column.key] || ''}
            type="date"
            onCommit={(value) => onUpdateActivity(row, { [column.key]: value })}
          />
        </div>
      );
    }

    if (column.key === 'duration') {
      return <div className={`${baseCellClass} text-xs text-slate-700`}>{row.duration}</div>;
    }

    if (column.key === 'progress' || column.key === 'hours' || column.key === 'cost') {
      return (
        <div className={baseCellClass}>
          <EditableCell
            {...commonProps}
            value={row[column.key]}
            type="number"
            onCommit={(value) => onUpdateActivity(row, { [column.key]: Number(value || 0) })}
          />
        </div>
      );
    }

    if (column.key === 'status') {
      return (
        <div className={baseCellClass}>
          <EditableCell
            {...commonProps}
            value={row.status}
            type="select"
            options={STATUS_OPTIONS}
            onCommit={(value) => onUpdateActivity(row, { status: value })}
          />
        </div>
      );
    }

    return <div className={baseCellClass} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por WBS, Activity ID, actividad o estado"
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

        <div className="text-xs text-slate-500">
          {activityRows.length} actividades visibles
        </div>
      </div>

      <ColumnSelectorModal
        isOpen={showColumnPanel}
        columns={COLUMNS}
        fixedKeys={FIXED_COLUMN_KEYS}
        selectedKeys={columnSettings.visibleKeys.filter((key) => CONFIGURABLE_COLUMN_KEYS.includes(key))}
        defaultSelectedKeys={DEFAULT_COLUMN_SETTINGS.visibleKeys.filter((key) => CONFIGURABLE_COLUMN_KEYS.includes(key))}
        onClose={() => setShowColumnPanel(false)}
        onApply={(selectedKeys) => updateColumnSettings((previous) => ({
          ...previous,
          visibleKeys: [...FIXED_COLUMN_KEYS, ...selectedKeys],
          order: [
            ...selectedKeys,
            ...CONFIGURABLE_COLUMN_KEYS.filter((key) => !selectedKeys.includes(key)),
          ],
        }))}
      />

      <div className="flex gap-3">
        <div className="min-w-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
          <div
            className="min-w-[1040px]"
            style={{
              display: 'grid',
              gridTemplateColumns: visibleColumns.map((column) => column.width).join(' '),
            }}
          >
            {visibleColumns.map((column) => (
              <button
                key={column.key}
                type="button"
                onClick={() => column.sortable !== false && toggleSort(column.key)}
                className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"
              >
                {column.label}
                {sortConfig.key === column.key ? ` ${sortConfig.direction === 'asc' ? '↑' : '↓'}` : ''}
              </button>
            ))}

            {processedRows.length === 0 ? (
              <div
                className="px-2 py-6 text-center text-sm text-slate-500"
                style={{ gridColumn: `span ${visibleColumns.length}` }}
              >
                No hay filas para mostrar con los filtros actuales.
              </div>
            ) : null}

            {processedRows.map((row) => {
              const isSelectedRow = selectedRowId === row.id;

              if (row.type === 'wbs') {
                return (
                  <div
                    key={`wbs-row-${row.id}`}
                    className="contents"
                    onClick={() => handleRowSelection(row)}
                  >
                    {visibleColumns.map((column) => (
                      <div
                        key={`wbs-row-${row.id}-${column.key}`}
                      >
                        {renderWbsCell(row, column, isSelectedRow)}
                      </div>
                    ))}
                  </div>
                );
              }

              return (
                <div
                  key={`activity-row-${row.id}`}
                  className="contents"
                  onClick={() => handleRowSelection(row)}
                >
                  {visibleColumns.map((column) => (
                    <div
                      key={`activity-row-${row.id}-${column.key}`}
                      onDoubleClick={() => handleRowSelection(row, column.key, column.key !== 'duration')}
                    >
                      {renderActivityCell(row, column)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex w-[56px] flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-2">
          <ActionRailButton
            icon="＋"
            label="Agregar actividad"
            onClick={handleAddFromSelection}
            disabled={!selectedRow}
          />
          <ActionRailButton
            icon="🗑"
            label="Eliminar actividad seleccionada"
            onClick={handleDeleteSelected}
            disabled={!selectedActivity}
            tone="danger"
          />
        </div>
      </div>
    </div>
  );
}
