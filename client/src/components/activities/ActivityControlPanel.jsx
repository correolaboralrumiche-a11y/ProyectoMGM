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
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}

function SummaryCards({ summary }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <StatCard label="HH presupuesto" value={formatNumber(summary.budget_hours)} />
      <StatCard label="USD presupuesto" value={formatCurrency(summary.budget_cost)} />
      <StatCard label="HH actual" value={formatNumber(summary.actual_hours)} accent="text-sky-700" />
      <StatCard label="USD actual" value={formatCurrency(summary.actual_cost)} accent="text-sky-700" />
      <StatCard label="HH restante" value={formatNumber(summary.remaining_hours)} />
      <StatCard label="USD restante" value={formatCurrency(summary.remaining_cost)} />
      <StatCard label="Avance actual" value={`${formatNumber(summary.current_progress)}%`} accent="text-emerald-700" />
      <StatCard label="Registros" value={`${summary.progress_update_count} av. · ${summary.actual_entry_count} act.`} />
    </div>
  );
}

function TableBlock({ title, columns, rows, emptyText }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">{title}</div>
      {rows.length ? (
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th key={column.key} className="px-3 py-2 text-left font-semibold">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id || `${title}-${index}`} className="border-t border-slate-100">
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-2 align-top text-slate-700">
                      {column.render ? column.render(row[column.key], row) : row[column.key] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-6 text-sm text-slate-500">{emptyText}</div>
      )}
    </div>
  );
}

function ProgressForm({ form, onChange, onSubmit, disabled, submitting }) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-slate-800">Registrar avance</div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-600">
          Fecha de avance
          <input type="date" value={form.update_date} onChange={(event) => onChange('update_date', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm" disabled={disabled || submitting} />
        </label>
        <label className="text-xs text-slate-600">
          Progreso %
          <input type="number" min="0" max="100" step="0.01" value={form.progress_percent} onChange={(event) => onChange('progress_percent', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm" disabled={disabled || submitting} />
        </label>
      </div>
      <label className="mt-3 block text-xs text-slate-600">
        Estado
        <select value={form.status_code} onChange={(event) => onChange('status_code', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm" disabled={disabled || submitting}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.code} value={option.code}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-xs text-slate-600">
        Comentario
        <textarea value={form.notes} onChange={(event) => onChange('notes', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" disabled={disabled || submitting} />
      </label>
      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={disabled || submitting} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {submitting ? 'Registrando...' : 'Registrar avance'}
        </button>
      </div>
    </form>
  );
}

function ActualForm({ form, onChange, onSubmit, disabled, submitting }) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-slate-800">Registrar actual</div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs text-slate-600">
          Fecha de actual
          <input type="date" value={form.actual_date} onChange={(event) => onChange('actual_date', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm" disabled={disabled || submitting} />
        </label>
        <label className="text-xs text-slate-600">
          HH reales
          <input type="number" min="0" step="0.01" value={form.actual_hours} onChange={(event) => onChange('actual_hours', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm" disabled={disabled || submitting} />
        </label>
      </div>
      <label className="mt-3 block text-xs text-slate-600">
        Costo real USD
        <input type="number" min="0" step="0.01" value={form.actual_cost} onChange={(event) => onChange('actual_cost', event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-300 px-3 text-sm" disabled={disabled || submitting} />
      </label>
      <label className="mt-3 block text-xs text-slate-600">
        Comentario
        <textarea value={form.notes} onChange={(event) => onChange('notes', event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" disabled={disabled || submitting} />
      </label>
      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={disabled || submitting} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {submitting ? 'Registrando...' : 'Registrar actual'}
        </button>
      </div>
    </form>
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
  const [progressForm, setProgressForm] = useState({
    update_date: todayDate(),
    progress_percent: '0',
    status_code: 'not_started',
    notes: '',
  });
  const [actualForm, setActualForm] = useState({
    actual_date: todayDate(),
    actual_hours: '',
    actual_cost: '',
    notes: '',
  });
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
  }, [activity?.id, activity?.progress, activity?.status_code]);

  const summary = useMemo(
    () =>
      controlData?.summary || {
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
      },
    [activity, controlData],
  );

  if (!activity) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
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
      setProgressForm((previous) => ({ ...previous, notes: '' }));
      setLocalSuccess('Avance registrado correctamente.');
    } catch (requestError) {
      setLocalError(requestError?.message || 'No se pudo registrar el avance.');
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
    } catch (requestError) {
      setLocalError(requestError?.message || 'No se pudo registrar el actual.');
    } finally {
      setSubmittingActual(false);
    }
  }

  const handleProgressFormChange = (field, value) => {
    setProgressForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleActualFormChange = (field, value) => {
    setActualForm((previous) => ({ ...previous, [field]: value }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-sm font-semibold text-slate-800">Control de actividad</div>
        <div className="mt-1 text-sm text-slate-700">{activity.activity_id} · {activity.name}</div>
        <div className="mt-1 text-xs text-slate-500">{activity.wbs_code ? `${activity.wbs_code} · ` : ''}{activity.wbs_name || 'Sin WBS'}</div>
        <div className="mt-1 text-xs text-slate-500">Estado actual: {activity.status || '—'}</div>
      </div>
      {loading ? <InlineAlert tone="info">Cargando historial operativo de la actividad...</InlineAlert> : null}
      {error ? <InlineAlert tone="warning">{error}</InlineAlert> : null}
      {localError ? <InlineAlert tone="warning">{localError}</InlineAlert> : null}
      {localSuccess ? <InlineAlert tone="success">{localSuccess}</InlineAlert> : null}
      {!canWrite ? (
        <InlineAlert tone="info">
          Tu perfil tiene acceso de consulta. Puedes revisar resumen, avance y actuals, pero no registrar nuevos movimientos.
        </InlineAlert>
      ) : null}

      <SummaryCards summary={summary} />

      <div className="grid gap-4 xl:grid-cols-2">
        <ProgressForm form={progressForm} onChange={handleProgressFormChange} onSubmit={handleSubmitProgress} disabled={!canWrite} submitting={submittingProgress} />
        <ActualForm form={actualForm} onChange={handleActualFormChange} onSubmit={handleSubmitActual} disabled={!canWrite} submitting={submittingActual} />
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
