const baseTabs = [
  { key: 'projects', label: 'Proyectos' },
  { key: 'wbs', label: 'WBS' },
  { key: 'activities', label: 'Actividades' },
];

export default function Tabs({ activeTab, onChange, canViewAudit = false, canViewCatalogs = false }) {
  const tabs = [...baseTabs];

  if (canViewCatalogs) {
    tabs.push({ key: 'catalogs', label: 'Catálogos' });
  }

  if (canViewAudit) {
    tabs.push({ key: 'audit', label: 'Auditoría' });
  }

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
