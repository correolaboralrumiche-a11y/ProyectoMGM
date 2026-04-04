function ColumnOption({ column, checked, onToggle, disabled }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(column.key)}
        disabled={disabled}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-800">{column.label}</div>
        <div className="text-xs text-slate-500">{column.key}</div>
      </div>
    </label>
  );
}

export default function TemplateColumnsSelector({
  columns = [],
  selectedColumns = [],
  onChange,
  disabled = false,
}) {
  const selectedSet = new Set(selectedColumns);

  function toggle(columnKey) {
    const next = selectedSet.has(columnKey)
      ? selectedColumns.filter((item) => item !== columnKey)
      : [...selectedColumns, columnKey];
    onChange(next);
  }

  if (!columns.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        No hay columnas disponibles para esta plantilla.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">Columnas generales</div>
          <div className="text-xs text-slate-500">
            Estas columnas se muestran en el panel izquierdo del visor.
          </div>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
          {selectedColumns.length} seleccionadas
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {columns.map((column) => (
          <ColumnOption
            key={column.key}
            column={column}
            checked={selectedSet.has(column.key)}
            onToggle={toggle}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
