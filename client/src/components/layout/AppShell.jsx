export default function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between px-4 py-4 sm:px-6 xl:px-8 2xl:px-10">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">ProyectoMGM</h1>
            <p className="text-sm text-slate-500">
              ERP ligero para control de entregables
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1800px] px-4 py-4 sm:px-6 xl:px-8 2xl:px-10">
        {children}
      </main>
    </div>
  );
}