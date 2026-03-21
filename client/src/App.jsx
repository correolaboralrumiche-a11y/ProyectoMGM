import { useMemo, useState } from 'react';
import AppShell from './components/layout/AppShell.jsx';
import Tabs from './components/layout/Tabs.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import WBSPage from './pages/WBSPage.jsx';
import ActivitiesPage from './pages/ActivitiesPage.jsx';
import { useProjects } from './hooks/useProjects.js';
import { useWBS } from './hooks/useWBS.js';
import { useActivities } from './hooks/useActivities.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('projects');

  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    reloadProjects,
  } = useProjects();

  const activeProject = useMemo(
    () => projects.find((item) => item.id === activeProjectId) || null,
    [projects, activeProjectId]
  );

  const { tree, reloadWBS } = useWBS(activeProjectId);
  const { activities, reloadActivities } = useActivities(activeProjectId);

  return (
    <AppShell>
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">Proyecto activo</div>
            <div className="text-lg font-semibold text-slate-900">
              {activeProject ? activeProject.name : 'Ninguno'}
            </div>
          </div>

          <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            {activeProject ? activeProject.description || 'Sin descripción' : 'Selecciona un proyecto'}
          </div>
        </div>
      </div>

      <Tabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'projects' ? (
        <ProjectsPage
          projects={projects}
          activeProjectId={activeProjectId}
          setActiveProjectId={setActiveProjectId}
          reloadProjects={reloadProjects}
        />
      ) : null}

      {activeTab === 'wbs' ? (
        <WBSPage
          activeProject={activeProject}
          tree={tree}
          reloadWBS={async () => {
            await reloadWBS();
            await reloadActivities();
          }}
        />
      ) : null}

      {activeTab === 'activities' ? (
        <ActivitiesPage
          activeProject={activeProject}
          tree={tree}
          activities={activities}
          reloadActivities={reloadActivities}
        />
      ) : null}
    </AppShell>
  );
}
