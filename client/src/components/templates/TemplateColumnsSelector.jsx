function ColumnOption({ column, checked, onToggle, disabled }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-blue-300">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        checked={checked}
        onChange={() => onToggle(column.key)}
        disabled={disabled}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-900">{column.label}</span>
        <span className="block text-xs text-slate-500">{column.key}</span>
      </span>
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
    return <p className="text-sm text-slate-500">No hay columnas disponibles para esta plantilla.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-900">Columnas generales</p>
          <p className="text-xs text-slate-500">
            Estas columnas se muestran en el panel izquierdo del visor.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {selectedColumns.length} seleccionadas
        </span>
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
