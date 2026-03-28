import { useEffect, useMemo, useState } from 'react';
import InlineAlert from '../common/InlineAlert.jsx';

const STATUS_OPTIONS = [
  { code: 'not_started', label: 'Not Started' },
  { code: 'in_progress', label: 'In Progress' },
  { code: 'completed', label: 'Completed' },
  { code: 'on_hold', label: 'On Hold' },
];

function todayDate() {
  return new Date().toISOString().slice(0, 10);
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
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
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

function StatCard({ label, value, accent = 'text-slate-900' }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function TableBlock({ title, columns, rows, emptyText }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800">{title}</div>
      {rows.length ? (
        <div className="overflow-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="px-3 py-2 text-left font-semibold uppercase tracking-wide">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 text-slate-700">
                  {columns.map((column) => (
                    <td key={`${row.id}:${column.key}`} className="px-3 py-2 align-top">
                      {column.render ? column.render(row[column.key], row) : row[column.key] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-4 text-sm text-slate-500">{emptyText}</div>
      )}
    </div>
  );
}

export default function ActivityControlPanel({
  activity,
  controlData,
  loading,
  error,
  canWrite,
  onCreateProgressUpdate,
  onCreateActualEntry,
}) {
  const [progressForm, setProgressForm] = useState(() => ({
    update_date: todayDate(),
    progress_percent: '0',
    status_code: 'not_started',
    notes: '',
  }));
  const [actualForm, setActualForm] = useState(() => ({
    actual_date: todayDate(),
    actual_hours: '',
    actual_cost: '',
    notes: '',
  }));
  const [submittingProgress, setSubmittingProgress] = useState(false);
  const [submittingActual, setSubmittingActual] = useState(false);
  const [localError, setLocalError] = useState('');
  const [localSuccess, setLocalSuccess] = useState('');

  useEffect(() => {
    setLocalError('');
    setLocalSuccess('');
    setProgressForm({
      update_date: todayDate(),
      progress_percent: String(activity?.progress ?? 0),
      status_code: activity?.status_code || 'not_started',
      notes: '',
    });
    setActualForm({
      actual_date: todayDate(),
      actual_hours: '',
      actual_cost: '',
      notes: '',
    });
  }, [activity?.id]);

  const summary = useMemo(() => {
    return controlData?.summary || {
      budget_hours: Number(activity?.budget_hours ?? activity?.hours ?? 0),
      budget_cost: Number(activity?.budget_cost ?? activity?.cost ?? 0),
      actual_hours: Number(activity?.actual_hours ?? 0),
      actual_cost: Number(activity?.actual_cost ?? 0),
      remaining_hours: Number(activity?.remaining_hours ?? 0),
      remaining_cost: Number(activity?.remaining_cost ?? 0),
      current_progress: Number(activity?.progress ?? 0),
      latest_progress_date: activity?.latest_progress_date || null,
      latest_actual_date: activity?.latest_actual_date || null,
      progress_update_count: Number(activity?.progress_update_count ?? 0),
      actual_entry_count: Number(activity?.actual_entry_count ?? 0),
    };
  }, [activity, controlData]);

  if (!activity) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Selecciona una actividad para registrar presupuesto, avance y actuals.
      </div>
    );
  }

  const progressUpdates = Array.isArray(controlData?.progress_updates) ? controlData.progress_updates : [];
  const actualEntries = Array.isArray(controlData?.actual_entries) ? controlData.actual_entries : [];

  async function handleSubmitProgress(event) {
    event.preventDefault();
    if (!canWrite) return;

    setSubmittingProgress(true);
    setLocalError('');
    setLocalSuccess('');

    try {
      await onCreateProgressUpdate(activity, {
        update_date: progressForm.update_date,
        progress_percent: Number(progressForm.progress_percent || 0),
        status_code: progressForm.status_code,
        notes: progressForm.notes,
      });

      setProgressForm((previous) => ({
        ...previous,
        notes: '',
      }));
      setLocalSuccess('Avance registrado correctamente.');
    } catch (err) {
      setLocalError(err?.message || 'No se pudo registrar el avance.');
    } finally {
      setSubmittingProgress(false);
    }
  }

  async function handleSubmitActual(event) {
    event.preventDefault();
    if (!canWrite) return;

    setSubmittingActual(true);
    setLocalError('');
    setLocalSuccess('');

    try {
      await onCreateActualEntry(activity, {
        actual_date: actualForm.actual_date,
        actual_hours: Number(actualForm.actual_hours || 0),
        actual_cost: Number(actualForm.actual_cost || 0),
        notes: actualForm.notes,
      });

      setActualForm((previous) => ({
        ...previous,
        actual_hours: '',
        actual_cost: '',
        notes: '',
      }));
      setLocalSuccess('Actual registrado correctamente.');
    } catch (err) {
      setLocalError(err?.message || 'No se pudo registrar el actual.');
    } finally {
      setSubmittingActual(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Control de actividad</div>
            <div className="text-lg font-semibold text-slate-900">
              {activity.activity_id} · {activity.name}
            </div>
            <div className="text-sm text-slate-600">
              {activity.wbs_code ? `${activity.wbs_code} · ` : ''}
              {activity.wbs_name || 'Sin WBS'}
            </div>
          </div>
          <div className="text-sm text-slate-500">
            Estado actual: <span className="font-medium text-slate-800">{activity.status || '—'}</span>
          </div>
        </div>
      </div>

      {loading ? <InlineAlert tone="info">Cargando historial operativo de la actividad...</InlineAlert> : null}
      {error ? <InlineAlert tone="warning">{error}</InlineAlert> : null}
      {localError ? <InlineAlert tone="danger">{localError}</InlineAlert> : null}
      {localSuccess ? <InlineAlert tone="success">{localSuccess}</InlineAlert> : null}
      {!canWrite ? (
        <InlineAlert tone="info">
          Tu perfil tiene acceso de consulta. Puedes revisar resumen, avance y actuals, pero no registrar nuevos movimientos.
        </InlineAlert>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Presupuesto HH" value={formatNumber(summary.budget_hours)} />
        <StatCard label="Actual HH" value={formatNumber(summary.actual_hours)} accent="text-sky-700" />
        <StatCard label="Presupuesto USD" value={formatCurrency(summary.budget_cost)} />
        <StatCard label="Actual USD" value={formatCurrency(summary.actual_cost)} accent="text-sky-700" />
        <StatCard label="Saldo HH" value={formatNumber(summary.remaining_hours)} accent={summary.remaining_hours < 0 ? 'text-rose-700' : 'text-emerald-700'} />
        <StatCard label="Saldo USD" value={formatCurrency(summary.remaining_cost)} accent={summary.remaining_cost < 0 ? 'text-rose-700' : 'text-emerald-700'} />
        <StatCard label="Avance actual" value={`${formatNumber(summary.current_progress)}%`} accent="text-indigo-700" />
        <StatCard label="Últ. avance" value={formatDate(summary.latest_progress_date)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={handleSubmitProgress} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-slate-800">Registrar avance</div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-600">
              Fecha de avance
              <input
                type="date"
                value={progressForm.update_date}
                onChange={(event) => setProgressForm((previous) => ({ ...previous, update_date: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                disabled={!canWrite || submittingProgress}
              />
            </label>
            <label className="text-xs text-slate-600">
              Progreso %
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={progressForm.progress_percent}
                onChange={(event) =>
                  setProgressForm((previous) => ({ ...previous, progress_percent: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                disabled={!canWrite || submittingProgress}
              />
            </label>
          </div>

          <label className="mt-3 block text-xs text-slate-600">
            Estado
            <select
              value={progressForm.status_code}
              onChange={(event) => setProgressForm((previous) => ({ ...previous, status_code: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              disabled={!canWrite || submittingProgress}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block text-xs text-slate-600">
            Comentario
            <textarea
              value={progressForm.notes}
              onChange={(event) => setProgressForm((previous) => ({ ...previous, notes: event.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              disabled={!canWrite || submittingProgress}
            />
          </label>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={!canWrite || submittingProgress}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submittingProgress ? 'Registrando...' : 'Registrar avance'}
            </button>
          </div>
        </form>

        <form onSubmit={handleSubmitActual} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-semibold text-slate-800">Registrar actual</div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-slate-600">
              Fecha de actual
              <input
                type="date"
                value={actualForm.actual_date}
                onChange={(event) => setActualForm((previous) => ({ ...previous, actual_date: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                disabled={!canWrite || submittingActual}
              />
            </label>
            <label className="text-xs text-slate-600">
              HH reales
              <input
                type="number"
                min="0"
                step="0.01"
                value={actualForm.actual_hours}
                onChange={(event) => setActualForm((previous) => ({ ...previous, actual_hours: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                disabled={!canWrite || submittingActual}
              />
            </label>
          </div>

          <label className="mt-3 block text-xs text-slate-600">
            Costo real USD
            <input
              type="number"
              min="0"
              step="0.01"
              value={actualForm.actual_cost}
              onChange={(event) => setActualForm((previous) => ({ ...previous, actual_cost: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              disabled={!canWrite || submittingActual}
            />
          </label>

          <label className="mt-3 block text-xs text-slate-600">
            Comentario
            <textarea
              value={actualForm.notes}
              onChange={(event) => setActualForm((previous) => ({ ...previous, notes: event.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              disabled={!canWrite || submittingActual}
            />
          </label>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={!canWrite || submittingActual}
              className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submittingActual ? 'Registrando...' : 'Registrar actual'}
            </button>
          </div>
        </form>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <TableBlock
          title={`Historial de avance (${summary.progress_update_count})`}
          emptyText="Aún no hay registros de avance para esta actividad."
          columns={[
            { key: 'update_date', label: 'Fecha', render: formatDate },
            { key: 'progress_percent', label: 'Progreso %', render: (value) => `${formatNumber(value)}%` },
            { key: 'status_name', label: 'Estado' },
            { key: 'created_by_username', label: 'Usuario' },
            { key: 'notes', label: 'Comentario' },
          ]}
          rows={progressUpdates}
        />

        <TableBlock
          title={`Historial de actuals (${summary.actual_entry_count})`}
          emptyText="Aún no hay actuals registrados para esta actividad."
          columns={[
            { key: 'actual_date', label: 'Fecha', render: formatDate },
            { key: 'actual_hours', label: 'HH', render: (value) => formatNumber(value) },
            { key: 'actual_cost', label: 'USD', render: (value) => formatCurrency(value) },
            { key: 'created_by_username', label: 'Usuario' },
            { key: 'notes', label: 'Comentario' },
          ]}
          rows={actualEntries}
        />
      </div>
    </div>
  );
}
