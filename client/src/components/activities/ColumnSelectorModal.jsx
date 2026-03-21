import { useEffect, useMemo, useState } from 'react';

function moveItem(list, fromIndex, toIndex) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
    return list;
  }

  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export default function ColumnSelectorModal({
  isOpen,
  columns,
  fixedKeys = [],
  selectedKeys,
  defaultSelectedKeys,
  onClose,
  onApply,
}) {
  const fixedColumns = useMemo(
    () => columns.filter((column) => fixedKeys.includes(column.key)),
    [columns, fixedKeys]
  );

  const configurableColumns = useMemo(
    () => columns.filter((column) => column.configurable),
    [columns]
  );

  const [draftSelected, setDraftSelected] = useState(selectedKeys);
  const [availableActiveKey, setAvailableActiveKey] = useState(null);
  const [selectedActiveKey, setSelectedActiveKey] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraftSelected(selectedKeys);
    setAvailableActiveKey(null);
    setSelectedActiveKey(selectedKeys[0] || null);
  }, [isOpen, selectedKeys]);

  const availableColumns = useMemo(
    () => configurableColumns.filter((column) => !draftSelected.includes(column.key)),
    [configurableColumns, draftSelected]
  );

  function addOne() {
    if (!availableActiveKey) return;
    if (draftSelected.includes(availableActiveKey)) return;
    setDraftSelected((previous) => [...previous, availableActiveKey]);
    setSelectedActiveKey(availableActiveKey);
    setAvailableActiveKey(null);
  }

  function addAll() {
    const allKeys = configurableColumns.map((column) => column.key);
    setDraftSelected(allKeys);
    setSelectedActiveKey(allKeys[0] || null);
    setAvailableActiveKey(null);
  }

  function removeOne() {
    if (!selectedActiveKey) return;
    setDraftSelected((previous) => previous.filter((key) => key !== selectedActiveKey));
    setAvailableActiveKey(selectedActiveKey);
    setSelectedActiveKey(null);
  }

  function removeAll() {
    setDraftSelected([]);
    setSelectedActiveKey(null);
    setAvailableActiveKey(configurableColumns[0]?.key || null);
  }

  function moveSelected(direction) {
    if (!selectedActiveKey) return;

    setDraftSelected((previous) => {
      const index = previous.indexOf(selectedActiveKey);
      if (index === -1) return previous;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      return moveItem(previous, index, targetIndex);
    });
  }

  function apply(closeAfter = false) {
    onApply(draftSelected);
    if (closeAfter) onClose();
  }

  function restoreDefault() {
    setDraftSelected(defaultSelectedKeys);
    setSelectedActiveKey(defaultSelectedKeys[0] || null);
    setAvailableActiveKey(null);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-300 bg-slate-200 px-4 py-3">
          <div>
            <div className="text-lg font-semibold text-slate-800">Columns</div>
            <div className="text-xs text-slate-500">Configura qué columnas visibles usar en la hoja de actividades.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xl leading-none text-slate-600 hover:bg-slate-300"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-[1.2fr_88px_1.2fr_140px] gap-4 p-4">
          <div className="rounded-md border border-slate-300 bg-white">
            <div className="border-b border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              Available Options
            </div>
            <div className="h-80 overflow-auto p-2">
              {availableColumns.length === 0 ? (
                <div className="px-2 py-2 text-sm text-slate-400">No hay más columnas disponibles.</div>
              ) : (
                availableColumns.map((column) => {
                  const isActive = availableActiveKey === column.key;
                  return (
                    <button
                      key={column.key}
                      type="button"
                      onClick={() => {
                        setAvailableActiveKey(column.key);
                        setSelectedActiveKey(null);
                      }}
                      onDoubleClick={addOne}
                      className={`block w-full rounded-sm px-2 py-1.5 text-left text-sm ${isActive ? 'bg-emerald-100 text-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      {column.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-2">
            <button type="button" onClick={addOne} className="w-12 rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">&gt;</button>
            <button type="button" onClick={addAll} className="w-12 rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">&gt;&gt;</button>
            <button type="button" onClick={removeOne} className="w-12 rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">&lt;</button>
            <button type="button" onClick={removeAll} className="w-12 rounded border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 hover:bg-slate-50">&lt;&lt;</button>
          </div>

          <div className="rounded-md border border-slate-300 bg-white">
            <div className="border-b border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              Selected Options
            </div>
            <div className="border-b border-slate-200 bg-slate-50/60 px-2 py-2">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fixed</div>
              <div className="space-y-1">
                {fixedColumns.map((column) => (
                  <div
                    key={column.key}
                    className="flex items-center justify-between rounded-sm border border-slate-200 bg-slate-100 px-2 py-1.5 text-sm text-slate-600"
                  >
                    <span>{column.label}</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Fixed</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-[241px] overflow-auto p-2">
              {draftSelected.length === 0 ? (
                <div className="px-2 py-2 text-sm text-slate-400">No hay columnas seleccionadas.</div>
              ) : (
                draftSelected.map((key) => {
                  const column = configurableColumns.find((item) => item.key === key);
                  if (!column) return null;
                  const isActive = selectedActiveKey === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setSelectedActiveKey(key);
                        setAvailableActiveKey(null);
                      }}
                      className={`block w-full rounded-sm px-2 py-1.5 text-left text-sm ${isActive ? 'bg-sky-100 text-slate-800' : 'text-slate-700 hover:bg-slate-100'}`}
                    >
                      {column.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => apply(true)} className="rounded border border-emerald-600 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-emerald-50">
              OK
            </button>
            <button type="button" onClick={onClose} className="rounded border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-rose-50">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => apply(false)}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50"
            >
              Apply
            </button>
            <button type="button" onClick={restoreDefault} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
              Default
            </button>
            <div className="my-2 border-t border-slate-300" />
            <button
              type="button"
              onClick={() => moveSelected('up')}
              disabled={!selectedActiveKey || draftSelected.indexOf(selectedActiveKey) === 0}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ▲ Subir
            </button>
            <button
              type="button"
              onClick={() => moveSelected('down')}
              disabled={!selectedActiveKey || draftSelected.indexOf(selectedActiveKey) === draftSelected.length - 1}
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ▼ Bajar
            </button>
          </div>
        </div>

        <div className="border-t border-slate-300 bg-slate-50 px-4 py-2 text-xs text-slate-500">
          Activity ID y Nombre de la actividad permanecen fijas en la hoja, como columnas ancla del layout operativo.
        </div>
      </div>
    </div>
  );
}
