export default function AppShell({ children, user, onLogout }) {
  const displayName = user?.full_name || user?.username || 'Usuario';
  const username = user?.username ? `@${user.username}` : '';
  const roles = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles.join(', ') : 'sin rol';

  return (
    <div className="min-h-full bg-slate-100 text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700 shadow-sm">
                MGM
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  ERP técnico de control
                </p>
                <h1 className="truncate text-lg font-semibold text-slate-900">
                  ProyectoMGM
                </h1>
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-2 xl:flex">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-slate-600">
              Plataforma ERP
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-700">
              Sesión activa
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden min-w-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-right shadow-sm sm:block">
                <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="truncate text-xs text-slate-500">{username || roles}</p>
                <p className="truncate text-[11px] uppercase tracking-wide text-slate-400">{roles}</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50"
              >
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] px-4 py-4 lg:px-6 lg:py-5">
        <div className="space-y-4">{children}</div>
      </main>
    </div>
  );
}
