const TAB_DEFINITIONS = [
  { key: 'projects', label: 'Proyectos' },
  { key: 'wbs', label: 'WBS' },
  { key: 'activities', label: 'Actividades' },
  { key: 'control_periods', label: 'Periodos financieros' },
  { key: 'templates', label: 'Plantillas' },
  { key: 'deliverables', label: 'Entregables' },
  { key: 'catalogs', label: 'Catálogos' },
  { key: 'audit', label: 'Auditoría' },
];

export default function Tabs({ activeTab, onChange, visibleTabs = [] }) {
  const visibility = new Set((visibleTabs || []).filter(Boolean));
  const tabs = TAB_DEFINITIONS.filter((tab) => visibility.has(tab.key));

  if (!tabs.length) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2">
        <div className="overflow-x-auto">
          <div className="flex min-w-max items-center gap-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onChange(tab.key)}
                  className={[
                    'inline-flex items-center rounded-xl px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                    active
                      ? 'border border-slate-300 bg-white text-slate-900 shadow-sm'
                      : 'border border-transparent bg-transparent text-slate-600 hover:bg-white hover:text-slate-900',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
