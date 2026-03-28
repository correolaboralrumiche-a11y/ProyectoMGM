import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const INITIAL_FORM = {
  identifier: '',
  password: '',
};

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(form.identifier, form.password);
      setForm(INITIAL_FORM);
    } catch (loginError) {
      setError(loginError.message || 'No se pudo iniciar sesión');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 space-y-2 text-center">
          <h1 className="text-2xl font-semibold">ProyectoMGM</h1>
          <p className="text-sm text-slate-600">
            Inicia sesión para acceder al ERP de control de entregables.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Usuario o correo</label>
            <input
              value={form.identifier}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  identifier: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              autoComplete="username"
              placeholder="admin"
              disabled={submitting}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Contraseña</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  password: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              autoComplete="current-password"
              placeholder="********"
              disabled={submitting}
            />
          </div>

          {error ? <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
          <div className="font-semibold">Credenciales iniciales del Sprint 2</div>
          <div>Usuario: admin</div>
          <div>Contraseña: Admin123!</div>
          <div className="mt-2">Úsalas solo para la primera entrada y cámbialas en la siguiente fase de seguridad.</div>
        </div>
      </div>
    </div>
  );
}
