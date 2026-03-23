import { useEffect, useMemo, useState } from 'react';

function Chevron({ expanded }) {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center text-slate-500">
      {expanded ? '−' : '+'}
    </span>
  );
}

function buildPackages(columns, fixedKeys) {
  const fixedSet = new Set(fixedKeys || []);

  const configurable = (columns || []).filter(
    (column) => !fixedSet.has(column.key) && column.configurable !== false
  );

  const packagesMap = new Map();

  configurable.forEach((column) => {
    const packageName = column.group || 'Operativas';

    if (!packagesMap.has(packageName)) {
      packagesMap.set(packageName, []);
    }

    packagesMap.get(packageName).push(column);
  });

  return Array.from(packagesMap.entries()).map(([name, items]) => ({
    name,
    items,
  }));
}

export default function ColumnSelectorModal({
  isOpen,
  columns = [],
  fixedKeys = [],
  selectedKeys = [],
  defaultSelectedKeys = [],
  onClose,
  onApply,
}) {
  const fixedColumns = useMemo(() => {
    const fixedSet = new Set(fixedKeys || []);
    return columns.filter((column) => fixedSet.has(column.key));
  }, [columns, fixedKeys]);

  const packages = useMemo(() => buildPackages(columns, fixedKeys), [columns, fixedKeys]);

  const [expandedPackages, setExpandedPackages] = useState({});
  const [activeAvailablePackage, setActiveAvailablePackage] = useState('');
  const [selectedAvailableKey, setSelectedAvailableKey] = useState('');
  const [draftSelectedKeys, setDraftSelectedKeys] = useState(selectedKeys || []);
  const [selectedChosenKey, setSelectedChosenKey] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const nextExpanded = {};
    packages.forEach((pkg) => {
      nextExpanded[pkg.name] = true;
    });

    setExpandedPackages(nextExpanded);
    setActiveAvailablePackage(packages[0]?.name || '');
    setSelectedAvailableKey('');
    setDraftSelectedKeys(selectedKeys || []);
    setSelectedChosenKey(selectedKeys?.[0] || '');
  }, [isOpen, packages, selectedKeys]);

  const selectedSet = useMemo(() => new Set(draftSelectedKeys), [draftSelectedKeys]);

  const availablePackages = useMemo(() => {
    return packages.map((pkg) => ({
      ...pkg,
      items: pkg.items.filter((column) => !selectedSet.has(column.key)),
    }));
  }, [packages, selectedSet]);

  const activePackage = useMemo(() => {
    return availablePackages.find((pkg) => pkg.name === activeAvailablePackage) || availablePackages[0] || null;
  }, [availablePackages, activeAvailablePackage]);

  const selectedColumns = useMemo(() => {
    const map = new Map(columns.map((column) => [column.key, column]));
    return draftSelectedKeys
      .map((key) => map.get(key))
      .filter(Boolean);
  }, [columns, draftSelectedKeys]);

  function togglePackage(packageName) {
    setExpandedPackages((prev) => ({
      ...prev,
      [packageName]: !prev[packageName],
    }));
  }

  function handlePackageClick(packageName) {
    setActiveAvailablePackage(packageName);
    setExpandedPackages((prev) => ({
      ...prev,
      [packageName]: prev[packageName] ?? true,
    }));
  }

  function addOne() {
    if (!selectedAvailableKey) return;
    if (draftSelectedKeys.includes(selectedAvailableKey)) return;

    const next = [...draftSelectedKeys, selectedAvailableKey];
    setDraftSelectedKeys(next);
    setSelectedChosenKey(selectedAvailableKey);
    setSelectedAvailableKey('');
  }

  function addAllFromPackage() {
    if (!activePackage) return;

    const keysToAdd = activePackage.items.map((item) => item.key);
    if (!keysToAdd.length) return;

    const next = [...draftSelectedKeys];
    keysToAdd.forEach((key) => {
      if (!next.includes(key)) next.push(key);
    });

    setDraftSelectedKeys(next);
    setSelectedChosenKey(keysToAdd[keysToAdd.length - 1] || '');
    setSelectedAvailableKey('');
  }

  function removeOne() {
    if (!selectedChosenKey) return;

    const next = draftSelectedKeys.filter((key) => key !== selectedChosenKey);
    setDraftSelectedKeys(next);
    setSelectedChosenKey(next[0] || '');
  }

  function removeAll() {
    setDraftSelectedKeys([]);
    setSelectedChosenKey('');
  }

  function moveSelected(direction) {
    if (!selectedChosenKey) return;

    const currentIndex = draftSelectedKeys.indexOf(selectedChosenKey);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= draftSelectedKeys.length) return;

    const next = [...draftSelectedKeys];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, moved);

    setDraftSelectedKeys(next);
    setSelectedChosenKey(moved);
  }

  function restoreDefault() {
    setDraftSelectedKeys(defaultSelectedKeys || []);
    setSelectedChosenKey(defaultSelectedKeys?.[0] || '');
    setSelectedAvailableKey('');
  }

  function handleApply() {
    onApply?.(draftSelectedKeys, draftSelectedKeys);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex h-[80vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-2xl font-semibold text-slate-800">Columnas</h2>
            <p className="mt-1 text-sm text-slate-500">
              Configura qué columnas visibles usar en la hoja de actividades.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="flex min-h-0 flex-1 gap-6 px-6 py-5">
          <section className="grid min-h-0 flex-1 grid-cols-[1.15fr,84px,1fr] gap-5">
            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-700">Opciones disponibles</h3>
              </div>

              <div className="min-h-0 overflow-auto p-3">
                <div className="space-y-1">
                  {availablePackages.map((pkg) => {
                    const expanded = expandedPackages[pkg.name] ?? true;
                    const isActivePackage = activePackage?.name === pkg.name;

                    return (
                      <div key={pkg.name} className="rounded-lg border border-transparent">
                        <button
                          type="button"
                          onClick={() => {
                            handlePackageClick(pkg.name);
                            togglePackage(pkg.name);
                          }}
                          className={[
                            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition',
                            isActivePackage ? 'bg-sky-100 text-sky-900' : 'hover:bg-slate-100 text-slate-700',
                          ].join(' ')}
                        >
                          <Chevron expanded={expanded} />
                          <span className="font-medium">{pkg.name}</span>
                        </button>

                        {expanded ? (
                          <div className="ml-6 mt-1 space-y-1">
                            {pkg.items.length === 0 ? (
                              <div className="px-3 py-1 text-xs text-slate-400">Sin opciones disponibles</div>
                            ) : (
                              pkg.items.map((column) => (
                                <button
                                  key={column.key}
                                  type="button"
                                  onClick={() => {
                                    setActiveAvailablePackage(pkg.name);
                                    setSelectedAvailableKey(column.key);
                                  }}
                                  onDoubleClick={addOne}
                                  className={[
                                    'block w-full rounded-md px-3 py-1.5 text-left text-sm transition',
                                    selectedAvailableKey === column.key
                                      ? 'bg-slate-200 text-slate-900'
                                      : 'text-slate-700 hover:bg-slate-100',
                                  ].join(' ')}
                                >
                                  {column.label}
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-3">
              <button
                type="button"
                onClick={addOne}
                disabled={!selectedAvailableKey}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Agregar"
              >
                &gt;
              </button>

              <button
                type="button"
                onClick={addAllFromPackage}
                disabled={!activePackage || activePackage.items.length === 0}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Agregar todas"
              >
                &gt;&gt;
              </button>

              <button
                type="button"
                onClick={removeOne}
                disabled={!selectedChosenKey}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Quitar"
              >
                &lt;
              </button>

              <button
                type="button"
                onClick={removeAll}
                disabled={draftSelectedKeys.length === 0}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Quitar todas"
              >
                &lt;&lt;
              </button>
            </div>

            <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-700">Opciones seleccionadas</h3>
              </div>

              <div className="min-h-0 overflow-auto p-3">
                <div className="mb-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Fijas</div>
                  <div className="space-y-1">
                    {fixedColumns.map((column) => (
                      <div
                        key={column.key}
                        className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        <span>{column.label}</span>
                        <span className="text-[10px] font-semibold uppercase text-slate-400">Fixed</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  {selectedColumns.map((column) => (
                    <button
                      key={column.key}
                      type="button"
                      onClick={() => setSelectedChosenKey(column.key)}
                      onDoubleClick={removeOne}
                      className={[
                        'block w-full rounded-md px-3 py-2 text-left text-sm transition',
                        selectedChosenKey === column.key
                          ? 'bg-sky-100 text-sky-900'
                          : 'text-slate-700 hover:bg-slate-100',
                      ].join(' ')}
                    >
                      {column.label}
                    </button>
                  ))}

                  {selectedColumns.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-400">No hay columnas seleccionadas</div>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-slate-200 p-3">
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveSelected('up')}
                    disabled={!selectedChosenKey}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Subir"
                  >
                    ↑
                  </button>

                  <button
                    type="button"
                    onClick={() => moveSelected('down')}
                    disabled={!selectedChosenKey}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Bajar"
                  >
                    ↓
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={restoreDefault}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
          >
            Restaurar por defecto
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
