const TAB_DEFINITIONS = [
  { key: 'projects', label: 'Proyectos' },
  { key: 'wbs', label: 'WBS' },
  { key: 'activities', label: 'Actividades' },
  { key: 'catalogs', label: 'Catálogos' },
  { key: 'audit', label: 'Auditoría' },
];

export default function Tabs({ activeTab, onChange, visibleTabs = [] }) {
  const visibility = new Set((visibleTabs || []).filter(Boolean));
  const tabs = TAB_DEFINITIONS.filter((tab) => visibility.has(tab.key));

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={[
              'rounded-lg border px-4 py-2 text-sm font-medium',
              active
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
