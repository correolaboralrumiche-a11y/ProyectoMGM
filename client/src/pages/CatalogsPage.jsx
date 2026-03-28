import { useEffect, useMemo, useState } from 'react';
import { catalogsApi } from '../services/catalogsApi.js';

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  sort_order: 0,
  is_active: true,
};

function normalizeCatalogsResponse(data) {
  return Array.isArray(data) ? data : [];
}

function formatBoolean(value) {
  return value ? 'Activo' : 'Inactivo';
}

export default function CatalogsPage({ canWrite = false }) {
  const [catalogs, setCatalogs] = useState([]);
  const [activeKey, setActiveKey] = useState('project-statuses');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingCode, setEditingCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const data = await catalogsApi.listAll();
        if (!cancelled) {
          const normalized = normalizeCatalogsResponse(data);
          setCatalogs(normalized);
          if (normalized.length && !normalized.some((item) => item.key === activeKey)) {
            setActiveKey(normalized[0].key);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'No se pudieron cargar los catálogos.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [activeKey]);

  const activeCatalog = useMemo(() => {
    return catalogs.find((item) => item.key === activeKey) || null;
  }, [catalogs, activeKey]);

  function resetForm() {
    setEditingCode('');
    setForm(EMPTY_FORM);
  }

  async function reloadCatalogs(preferredKey = activeKey) {
    const data = await catalogsApi.listAll();
    const normalized = normalizeCatalogsResponse(data);
    setCatalogs(normalized);
    setActiveKey(preferredKey);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canWrite || !activeCatalog) return;

    setSaving(true);
    setError('');

    try {
      const payload = {
        code: form.code,
        name: form.name,
        description: form.description,
        sort_order: Number(form.sort_order || 0),
        is_active: Boolean(form.is_active),
      };

      if (editingCode) {
        await catalogsApi.update(activeCatalog.key, editingCode, payload);
      } else {
        await catalogsApi.create(activeCatalog.key, payload);
      }

      await reloadCatalogs(activeCatalog.key);
      resetForm();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el catálogo.');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item) {
    setEditingCode(item.code);
    setForm({
      code: item.code,
      name: item.name || '',
      description: item.description || '',
      sort_order: Number(item.sort_order || 0),
      is_active: Boolean(item.is_active),
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[280px,1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Catálogos maestros</h2>
          <p className="mt-1 text-sm text-slate-600">Normalización y gobierno del dato base del ERP.</p>
        </div>

        {loading ? <div className="px-5 py-4 text-sm text-slate-600">Cargando catálogos...</div> : null}
        {error && !catalogs.length ? <div className="px-5 py-4 text-sm text-rose-600">{error}</div> : null}

        <div className="p-3">
          {catalogs.map((catalog) => {
            const active = catalog.key === activeKey;
            return (
              <button
                key={catalog.key}
                type="button"
                onClick={() => {
                  setActiveKey(catalog.key);
                  resetForm();
                }}
                className={[
                  'mb-2 w-full rounded-xl border px-4 py-3 text-left text-sm',
                  active
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                ].join(' ')}
              >
                <div className="font-medium">{catalog.label}</div>
                <div className="mt-1 text-xs text-slate-500">{catalog.items?.length || 0} registros</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-lg font-semibold text-slate-900">{activeCatalog?.label || 'Catálogo'}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {canWrite
                ? 'Puedes crear, editar y desactivar registros maestros.'
                : 'Acceso en modo lectura. No tienes permiso para modificar catálogos.'}
            </p>
          </div>

          {error ? <div className="px-5 pt-4 text-sm text-rose-600">{error}</div> : null}

          {canWrite ? (
            <form className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-2" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Código</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                  disabled={Boolean(editingCode)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                  placeholder="Ej: active"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Ej: Activo"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Descripción funcional del valor maestro"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Orden</label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="flex items-end gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_active)}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  Activo
                </label>
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editingCode ? 'Guardar cambios' : 'Crear registro'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Limpiar
                </button>
              </div>
            </form>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Orden</th>
                  <th className="px-4 py-3 font-medium">Uso</th>
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  {canWrite ? <th className="px-4 py-3 font-medium">Acciones</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(activeCatalog?.items || []).map((item) => (
                  <tr key={item.code}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{item.code}</td>
                    <td className="px-4 py-3 text-slate-900">{item.name}</td>
                    <td className="px-4 py-3 text-slate-700">{formatBoolean(item.is_active)}</td>
                    <td className="px-4 py-3 text-slate-700">{item.sort_order}</td>
                    <td className="px-4 py-3 text-slate-700">{item.usage_count || 0}</td>
                    <td className="px-4 py-3 text-slate-700">{item.description || '—'}</td>
                    {canWrite ? (
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Editar
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
