const TAB_DEFINITIONS = [
  { key: 'projects', label: 'Proyectos', module: 'project_control', moduleLabel: 'Control de Proyectos' },
  { key: 'wbs', label: 'WBS', module: 'project_control', moduleLabel: 'Control de Proyectos' },
  { key: 'activities', label: 'Actividades', module: 'project_control', moduleLabel: 'Control de Proyectos' },
  { key: 'control_periods', label: 'Periodos financieros', module: 'project_control', moduleLabel: 'Control de Proyectos' },
  { key: 'deliverables', label: 'Entregables', module: 'document_control', moduleLabel: 'Control Documentario' },
  { key: 'catalogs', label: 'Catálogos', module: 'administration', moduleLabel: 'Administración' },
  { key: 'audit', label: 'Auditoría', module: 'administration', moduleLabel: 'Administración' },
];

function buildGroups(visibleTabs = [], activeModule) {
  const visibility = new Set((visibleTabs || []).filter(Boolean));
  const visibleDefinitions = TAB_DEFINITIONS.filter((tab) => visibility.has(tab.key));

  const groups = [];

  const activeModuleTabs = visibleDefinitions.filter((tab) => tab.module === activeModule);
  if (activeModuleTabs.length > 0) {
    groups.push({
      key: activeModule,
      label: activeModuleTabs[0].moduleLabel,
      tabs: activeModuleTabs,
    });
  }

  const adminTabs = visibleDefinitions.filter((tab) => tab.module === 'administration');
  if (adminTabs.length > 0) {
    groups.push({
      key: 'administration',
      label: 'Administración',
      tabs: adminTabs,
    });
  }

  return groups;
}

export default function Tabs({ activeTab, onChange, visibleTabs = [], activeModule }) {
  const groups = buildGroups(visibleTabs, activeModule);

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.key} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            {group.label}
          </div>
          <div className="flex flex-wrap gap-2">
            {group.tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onChange(tab.key)}
                  className={[
                    'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
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
        </div>
      ))}
    </div>
  );
}
