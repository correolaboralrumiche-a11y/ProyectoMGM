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
    [columns, fixedKeys],
  );
  const configurableColumns = useMemo(
    () => columns.filter((column) => column.configurable),
    [columns],
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
    [configurableColumns, draftSelected],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Columns</h2>
            <p className="mt-1 text-sm text-slate-500">Configura qué columnas visibles usar en la hoja de actividades.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
          >
            ×
          </button>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-[minmax(0,1fr)_120px_minmax(0,1fr)_140px]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Available Options</div>
            <div className="max-h-[320px] overflow-auto rounded-xl border border-slate-200 bg-white p-2">
              {availableColumns.length === 0 ? (
                <div className="px-2 py-3 text-sm text-slate-500">No hay más columnas disponibles.</div>
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
                      className={`mb-1 block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                        isActive ? 'bg-emerald-100 text-slate-800' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {column.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col justify-center gap-2">
            <button type="button" onClick={addOne} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">&gt;</button>
            <button type="button" onClick={addAll} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">&gt;&gt;</button>
            <button type="button" onClick={removeOne} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">&lt;</button>
            <button type="button" onClick={removeAll} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">&lt;&lt;</button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Selected Options</div>

            <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Fixed</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {fixedColumns.map((column) => (
                  <span key={column.key} className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                    {column.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="max-h-[240px] overflow-auto rounded-xl border border-slate-200 bg-white p-2">
              {draftSelected.length === 0 ? (
                <div className="px-2 py-3 text-sm text-slate-500">No hay columnas seleccionadas.</div>
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
                      className={`mb-1 block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                        isActive ? 'bg-sky-100 text-slate-800' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {column.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => moveSelected('up')}
                disabled={!selectedActiveKey || draftSelected.indexOf(selectedActiveKey) === 0}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ▲ Subir
              </button>
              <button
                type="button"
                onClick={() => moveSelected('down')}
                disabled={!selectedActiveKey || draftSelected.indexOf(selectedActiveKey) === draftSelected.length - 1}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ▼ Bajar
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              Activity ID y Nombre de la actividad permanecen fijas en la hoja, como columnas ancla del layout operativo.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => apply(true)} className="rounded-xl border border-emerald-600 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-emerald-50">
              OK
            </button>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 transition hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={() => apply(false)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 transition hover:bg-slate-50">
              Apply
            </button>
          </div>
          <button type="button" onClick={restoreDefault} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-800 transition hover:bg-slate-50">
            Default
          </button>
        </div>
      </div>
    </div>
  );
}
