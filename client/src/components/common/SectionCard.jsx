export default function SectionCard({ title, subtitle, actions, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-500">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 max-w-4xl text-sm text-slate-600">{subtitle}</p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>
        ) : null}
      </div>

      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
