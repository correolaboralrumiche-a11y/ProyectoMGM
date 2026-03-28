import { useMemo, useState } from 'react';
import AppShell from './components/layout/AppShell.jsx';
import Tabs from './components/layout/Tabs.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import WBSPage from './pages/WBSPage.jsx';
import ActivitiesPage from './pages/ActivitiesPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import CatalogsPage from './pages/CatalogsPage.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useProjects } from './hooks/useProjects.js';
import { useWBS } from './hooks/useWBS.js';
import { useActivities } from './hooks/useActivities.js';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
      Cargando ERP...
    </div>
  );
}

function hasAccess(user, permissionCode) {
  const roles = new Set((user?.roles || []).map((value) => String(value || '').toLowerCase()));
  if (roles.has('admin')) return true;

  const permissions = new Set((user?.permissions || []).map((value) => String(value || '').trim()));
  return permissions.has(permissionCode);
}

function AuthenticatedApp({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('projects');
  const { projects, activeProjectId, setActiveProjectId, reloadProjects } = useProjects();

  const activeProject = useMemo(() => {
    return projects.find((item) => item.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  const canViewAudit = hasAccess(user, 'audit.read');
  const canViewCatalogs = hasAccess(user, 'catalogs.read') || hasAccess(user, 'catalogs.write');
  const canWriteCatalogs = hasAccess(user, 'catalogs.write');

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

  async function handleWbsChanged() {
    await reloadWBS(activeProjectId);
    await reloadActivities(activeProjectId);
  }

  async function handleActivitiesChanged() {
    await reloadActivities(activeProjectId);
  }

  return (
    <AppShell user={user} onLogout={onLogout}>
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proyecto activo</div>
          <div className="text-lg font-semibold text-slate-900">{activeProject ? activeProject.name : 'Ninguno'}</div>
          <div className="text-sm text-slate-600">
            {activeProject ? activeProject.description || 'Sin descripción' : 'Selecciona un proyecto'}
          </div>
        </div>
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          canViewAudit={canViewAudit}
          canViewCatalogs={canViewCatalogs}
        />
      </div>

      {activeTab === 'projects' ? (
        <ProjectsPage
          projects={projects}
          activeProjectId={activeProjectId}
          onProjectSelect={handleProjectChanged}
          reloadProjects={handleProjectListChanged}
        />
      ) : null}

      {activeTab === 'wbs' ? (
        <WBSPage activeProject={activeProject} tree={tree} reloadWBS={handleWbsChanged} />
      ) : null}

      {activeTab === 'activities' ? (
        <ActivitiesPage
          activeProject={activeProject}
          tree={tree}
          activities={activities}
          reloadActivities={handleActivitiesChanged}
        />
      ) : null}

      {activeTab === 'catalogs' && canViewCatalogs ? (
        <CatalogsPage canWrite={canWriteCatalogs} />
      ) : null}

      {activeTab === 'audit' && canViewAudit ? <AuditPage activeProject={activeProject} /> : null}
    </AppShell>
  );
}

export default function App() {
  const { user, loading, isAuthenticated, logout } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <AuthenticatedApp user={user} onLogout={logout} />;
}
