import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from './components/layout/AppShell.jsx';
import Tabs from './components/layout/Tabs.jsx';
import InlineAlert from './components/common/InlineAlert.jsx';
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
      Cargando seguridad ERP...
    </div>
  );
}

function getVisibleTabs(permissions) {
  const tabs = [];
  if (permissions.projects.read) tabs.push('projects');
  if (permissions.wbs.read) tabs.push('wbs');
  if (permissions.activities.read) tabs.push('activities');
  if (permissions.catalogs.read) tabs.push('catalogs');
  if (permissions.audit.read) tabs.push('audit');
  return tabs;
}

function AuthenticatedApp({ user, onLogout }) {
  const { can, canAny, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('projects');
  const {
    projects,
    activeProjectId,
    setActiveProjectId,
    reloadProjects,
    loading: projectsLoading,
    error: projectsError,
  } = useProjects();

  const permissions = useMemo(
    () => ({
      isAdmin,
      projects: {
        read: can('projects.read'),
        create: can('projects.create'),
        update: can('projects.update'),
        delete: can('projects.delete'),
      },
      wbs: {
        read: can('wbs.read'),
        create: can('wbs.create'),
        update: can('wbs.update'),
        reorder: can('wbs.reorder'),
        delete: can('wbs.delete'),
      },
      activities: {
        read: can('activities.read'),
        create: can('activities.create'),
        update: can('activities.update'),
        reorder: can('activities.reorder'),
        delete: can('activities.delete'),
      },
      baselines: {
        read: can('baselines.read'),
        create: can('baselines.create'),
        delete: can('baselines.delete'),
      },
      catalogs: {
        read: canAny('catalogs.read', 'catalogs.manage'),
        manage: can('catalogs.manage'),
      },
      audit: {
        read: can('audit.read'),
      },
    }),
    [can, canAny, isAdmin]
  );

  const activeProject = useMemo(() => {
    return projects.find((item) => item.id === activeProjectId) || null;
  }, [projects, activeProjectId]);

  const operationalLock = useMemo(() => {
    if (!activeProject) return false;
    if (permissions.isAdmin) return false;
    return String(activeProject.status_code || activeProject.status || 'active').trim().toLowerCase() !== 'active';
  }, [activeProject, permissions.isAdmin]);

  const visibleTabs = useMemo(() => getVisibleTabs(permissions), [permissions]);

  const {
    tree,
    reloadWBS,
    loading: wbsLoading,
    error: wbsError,
  } = useWBS(activeProjectId);
  const {
    activities,
    reloadActivities,
    loading: activitiesLoading,
    error: activitiesError,
  } = useActivities(activeProjectId);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0] || 'projects');
    }
  }, [activeTab, visibleTabs]);

  const handleProjectChanged = useCallback(async (projectId) => {
    setActiveProjectId(projectId);
    await Promise.allSettled([reloadWBS(projectId), reloadActivities(projectId)]);
  }, [reloadWBS, reloadActivities, setActiveProjectId]);

  const handleProjectListChanged = useCallback(async (preferredProjectId) => {
    await reloadProjects(preferredProjectId);
  }, [reloadProjects]);

  const handleWbsChanged = useCallback(async () => {
    if (!activeProjectId) return;
    await Promise.allSettled([reloadWBS(activeProjectId), reloadActivities(activeProjectId)]);
  }, [activeProjectId, reloadWBS, reloadActivities]);

  const handleActivitiesChanged = useCallback(async () => {
    if (!activeProjectId) return [];
    return reloadActivities(activeProjectId);
  }, [activeProjectId, reloadActivities]);

  return (
    <AppShell user={user} onLogout={onLogout}>
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proyecto activo</div>
          <div className="text-lg font-semibold text-slate-900">
            {activeProject ? activeProject.name : projectsLoading ? 'Cargando...' : 'Ninguno'}
          </div>
          <div className="text-sm text-slate-600">
            {activeProject ? activeProject.description || 'Sin descripción' : 'Selecciona un proyecto'}
          </div>
          {activeProject ? (
            <div className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              Estado: {activeProject.status_name || activeProject.status_code || activeProject.status}
            </div>
          ) : null}
        </div>
        <Tabs activeTab={activeTab} onChange={setActiveTab} visibleTabs={visibleTabs} />
      </div>

      {projectsError ? (
        <InlineAlert tone="warning" className="mb-4">
          {projectsError}
        </InlineAlert>
      ) : null}

      {activeTab === 'projects' && permissions.projects.read ? (
        <ProjectsPage
          projects={projects}
          activeProjectId={activeProjectId}
          onProjectSelect={handleProjectChanged}
          reloadProjects={handleProjectListChanged}
          loading={projectsLoading}
          error={projectsError}
          canCreate={permissions.projects.create}
          canUpdate={permissions.projects.update}
          canDelete={permissions.projects.delete}
          canCreateBaseline={permissions.baselines.create}
          canDeleteBaseline={permissions.baselines.delete}
          canOverrideOperationalLock={permissions.isAdmin}
        />
      ) : null}

      {activeTab === 'wbs' && permissions.wbs.read ? (
        <WBSPage
          activeProject={activeProject}
          tree={tree}
          reloadWBS={handleWbsChanged}
          loading={wbsLoading}
          error={wbsError}
          canCreate={permissions.wbs.create}
          canUpdate={permissions.wbs.update}
          canDelete={permissions.wbs.delete}
          canReorder={permissions.wbs.reorder}
          operationallyLocked={operationalLock}
        />
      ) : null}

      {activeTab === 'activities' && permissions.activities.read ? (
        <ActivitiesPage
          activeProject={activeProject}
          tree={tree}
          activities={activities}
          reloadActivities={handleActivitiesChanged}
          loading={activitiesLoading}
          error={activitiesError}
          canCreate={permissions.activities.create}
          canUpdate={permissions.activities.update}
          canDelete={permissions.activities.delete}
          canReorder={permissions.activities.reorder}
          canCreateBaseline={permissions.baselines.read}
          operationallyLocked={operationalLock}
        />
      ) : null}

      {activeTab === 'catalogs' && permissions.catalogs.read ? (
        <CatalogsPage canWrite={permissions.catalogs.manage} />
      ) : null}
      {activeTab === 'audit' && permissions.audit.read ? <AuditPage activeProject={activeProject} /> : null}
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
