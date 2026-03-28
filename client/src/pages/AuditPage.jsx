import { useEffect, useState } from 'react';
import { auditApi } from '../services/auditApi.js';

function formatDateTime(value) {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatActor(actor) {
  if (!actor) return 'Sistema';
  return actor.full_name || actor.username || actor.email || 'Usuario';
}

export default function AuditPage({ activeProject }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const data = await auditApi.list({
          projectId: activeProject?.id || '',
          limit: 150,
        });

        if (!cancelled) {
          setLogs(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'No se pudo cargar la auditoría.');
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
  }, [activeProject?.id]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-900">Auditoría y trazabilidad</h2>
        <p className="mt-1 text-sm text-slate-600">
          {activeProject
            ? `Mostrando eventos del proyecto activo: ${activeProject.name}`
            : 'Mostrando eventos recientes del sistema'}
        </p>
      </div>

      {loading ? <div className="px-5 py-6 text-sm text-slate-600">Cargando auditoría...</div> : null}
      {error ? <div className="px-5 py-6 text-sm text-red-600">{error}</div> : null}

      {!loading && !error ? (
        logs.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Entidad</th>
                  <th className="px-4 py-3 font-medium">Acción</th>
                  <th className="px-4 py-3 font-medium">Resumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top">
                    <td className="px-4 py-3 text-slate-700">{formatDateTime(log.created_at)}</td>
                    <td className="px-4 py-3 text-slate-700">{formatActor(log.actor)}</td>
                    <td className="px-4 py-3 text-slate-700">{log.entity_type}</td>
                    <td className="px-4 py-3 text-slate-700">{log.action}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div className="font-medium text-slate-900">{log.summary}</div>
                      {log.metadata ? (
                        <pre className="mt-2 max-w-xl overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-6 text-sm text-slate-600">No hay eventos de auditoría para mostrar.</div>
        )
      ) : null}
    </div>
  );
}
