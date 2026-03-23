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

  const activeProject = useMemo(() => {
    return projects.find((item) => item.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  const { tree, reloadWBS } = useWBS(activeProjectId);
  const { activities, reloadActivities } = useActivities(activeProjectId);

  async function handleProjectChanged(projectId) {
    setActiveProjectId(projectId);
    await reloadWBS(projectId);
    await reloadActivities(projectId);
  }

  async function handleProjectListChanged(preferredProjectId) {
    await reloadProjects(preferredProjectId);
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-700">Proyecto activo</div>
          <div className="mt-1 text-lg font-bold text-slate-900">
            {activeProject ? activeProject.name : 'Ninguno'}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {activeProject
              ? activeProject.description || 'Sin descripción'
              : 'Selecciona un proyecto'}
          </div>
        </div>

        <Tabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'projects' ? (
          <ProjectsPage
            projects={projects}
            activeProjectId={activeProjectId}
            onProjectSelect={handleProjectChanged}
            reloadProjects={handleProjectListChanged}
          />
        ) : null}

        {activeTab === 'wbs' ? (
          <WBSPage
            activeProject={activeProject}
            tree={tree}
            reloadWBS={async () => {
              await reloadWBS(activeProjectId);
              await reloadActivities(activeProjectId);
            }}
          />
        ) : null}

        {activeTab === 'activities' ? (
          <ActivitiesPage
            activeProject={activeProject}
            tree={tree}
            activities={activities}
            reloadActivities={async () => {
              await reloadActivities(activeProjectId);
            }}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
