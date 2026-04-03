import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from './components/layout/AppShell.jsx';
import Tabs from './components/layout/Tabs.jsx';
import InlineAlert from './components/common/InlineAlert.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import WBSPage from './pages/WBSPage.jsx';
import ActivitiesPage from './pages/ActivitiesPage.jsx';
import ControlPeriodsPage from './pages/ControlPeriodsPage.jsx';
import DeliverablesPage from './pages/DeliverablesPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import CatalogsPage from './pages/CatalogsPage.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useProjects } from './hooks/useProjects.js';
import { useWBS } from './hooks/useWBS.js';
import { useActivities } from './hooks/useActivities.js';

const MODULE_DEFINITIONS = {
  project_control: {
    key: 'project_control',
    label: 'Control de Proyectos',
    eyebrow: 'Módulo 1',
    description:
      'Gestiona proyectos, WBS, actividades, períodos financieros y el seguimiento operativo del proyecto activo.',
    icon: '📊',
    preferredTabs: ['projects', 'wbs', 'activities', 'control_periods', 'catalogs', 'audit'],
  },
  document_control: {
    key: 'document_control',
    label: 'Control Documentario',
    eyebrow: 'Módulo 2',
    description:
      'Registra y controla entregables, códigos documentarios, revisiones y respuestas.',
    icon: '📄',
    preferredTabs: ['deliverables', 'catalogs', 'audit'],
  },
};

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="text-sm font-medium text-slate-700">Cargando seguridad ERP...</div>
      </div>
    </div>
  );
}

function getAllVisibleTabs(permissions) {
  const tabs = [];
  if (permissions.projects.read) tabs.push('projects');
  if (permissions.wbs.read) tabs.push('wbs');
  if (permissions.activities.read) tabs.push('activities');
  if (permissions.controlPeriods.read) tabs.push('control_periods');
  if (permissions.deliverables.read) tabs.push('deliverables');
  if (permissions.catalogs.read) tabs.push('catalogs');
  if (permissions.audit.read) tabs.push('audit');
  return tabs;
}

function getAvailableModules(permissions) {
  const modules = [];
  if (
    permissions.projects.read ||
    permissions.wbs.read ||
    permissions.activities.read ||
    permissions.controlPeriods.read ||
    permissions.catalogs.read ||
    permissions.audit.read
  ) {
    modules.push('project_control');
  }
  if (permissions.deliverables.read || permissions.catalogs.read || permissions.audit.read) {
    modules.push('document_control');
  }
  return modules;
}

function getVisibleTabsForModule(allVisibleTabs, activeModule) {
  const visibility = new Set(allVisibleTabs || []);
  if (!activeModule) return [];

  const moduleConfig = MODULE_DEFINITIONS[activeModule];
  if (!moduleConfig) return [];

  return moduleConfig.preferredTabs.filter((tab) => visibility.has(tab));
}

function getDefaultTabForModule(activeModule, visibleTabs) {
  const moduleConfig = MODULE_DEFINITIONS[activeModule];
  if (!moduleConfig) return null;
  return moduleConfig.preferredTabs.find((tab) => visibleTabs.includes(tab)) || visibleTabs[0] || null;
}

function getProjectOperationalLock(activeProject, isAdmin) {
  if (!activeProject || isAdmin) return false;
  return String(activeProject.status_code || activeProject.status || 'active').trim().toLowerCase() !== 'active';
}

function Pill({ label, value }) {
  if (!value) return null;
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
      {label}: {value}
    </div>
  );
}

function ActiveProjectSummary({ activeProject, loading, activeModule }) {
  const helperText =
    activeModule === 'document_control'
      ? 'El proyecto activo define el contexto del registro documentario.'
      : 'Selecciona un proyecto para trabajar sobre su WBS, actividades y períodos financieros.';

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proyecto activo</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">
        {activeProject ? activeProject.name : loading ? 'Cargando...' : 'Ninguno'}
      </div>
      <div className="mt-1 text-sm text-slate-500">
        {activeProject ? activeProject.description || 'Sin descripción' : helperText}
      </div>
      {activeProject ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill label="Estado" value={activeProject.status_name || activeProject.status_code || activeProject.status} />
          <Pill label="Prioridad" value={activeProject.priority_name || activeProject.priority_code} />
          <Pill label="Moneda" value={activeProject.currency_code || activeProject.currency_name} />
        </div>
      ) : null}
    </div>
  );
}

function ModuleCard({ moduleKey, disabled, onSelect }) {
  const module = MODULE_DEFINITIONS[moduleKey];

  return (
    <button
      type="button"
      onClick={() => onSelect(moduleKey)}
      disabled={disabled}
      className={[
        'w-full rounded-3xl border bg-white p-6 text-left shadow-sm transition-all',
        disabled
          ? 'cursor-not-allowed border-slate-200 opacity-60'
          : 'border-slate-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{module.eyebrow}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{module.label}</div>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">{module.description}</p>
        </div>
        <div className="text-4xl leading-none">{module.icon}</div>
      </div>

      <div className="mt-6 inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">
        {disabled ? 'Sin acceso disponible' : 'Ingresar al módulo'}
      </div>
    </button>
  );
}

function ModuleSelectionScreen({ user, onLogout, availableModules, onSelectModule }) {
  return (
    <AppShell user={user} onLogout={onLogout}>
      <div className="mx-auto max-w-5xl py-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">ProyectoMGM</div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Selecciona el módulo al que deseas ingresar</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            La aplicación se divide en dos frentes operativos. Ingresa al módulo de control del proyecto o al módulo de
            control documentario según el trabajo que vayas a realizar.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <ModuleCard
              moduleKey="project_control"
              disabled={!availableModules.includes('project_control')}
              onSelect={onSelectModule}
            />
            <ModuleCard
              moduleKey="document_control"
              disabled={!availableModules.includes('document_control')}
              onSelect={onSelectModule}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function AuthenticatedApp({ user, onLogout }) {
  const { can, canAny, isAdmin } = useAuth();
  const [activeModule, setActiveModule] = useState(null);
  const [activeTab, setActiveTab] = useState('projects');

  const {
    projects,
    activeProjectId,
    activeProject,
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
      controlPeriods: {
        read: can('control_periods.read'),
        create: can('control_periods.create'),
        close: can('control_periods.close'),
        reopen: can('control_periods.reopen'),
        delete: can('control_periods.delete'),
      },
      deliverables: {
        read: can('deliverables.read'),
        create: can('deliverables.create'),
        update: can('deliverables.update'),
        delete: can('deliverables.delete'),
        manageRevisions: can('deliverables.manage_revisions'),
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
    [can, canAny, isAdmin],
  );

  const operationalLock = useMemo(
    () => getProjectOperationalLock(activeProject, permissions.isAdmin),
    [activeProject, permissions.isAdmin],
  );

  const availableModules = useMemo(() => getAvailableModules(permissions), [permissions]);
  const allVisibleTabs = useMemo(() => getAllVisibleTabs(permissions), [permissions]);
  const visibleTabs = useMemo(
    () => getVisibleTabsForModule(allVisibleTabs, activeModule),
    [allVisibleTabs, activeModule],
  );

  const { tree, reloadWBS, loading: wbsLoading, error: wbsError } = useWBS(activeProjectId);
  const { activities, reloadActivities, loading: activitiesLoading, error: activitiesError } = useActivities(activeProjectId);

  useEffect(() => {
    if (!activeModule) return;
    if (!availableModules.includes(activeModule)) {
      setActiveModule(null);
      return;
    }
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(getDefaultTabForModule(activeModule, visibleTabs) || 'projects');
    }
  }, [activeModule, activeTab, availableModules, visibleTabs]);

  const handleProjectChanged = useCallback(async (projectId) => {
    setActiveProjectId(projectId);
  }, [setActiveProjectId]);

  const handleProjectListChanged = useCallback(async (preferredProjectId) => {
    await reloadProjects(preferredProjectId);
  }, [reloadProjects]);

  const handleWbsChanged = useCallback(async () => {
    if (!activeProjectId) return;
    await Promise.allSettled([reloadWBS(activeProjectId), reloadActivities(activeProjectId)]);
  }, [activeProjectId, reloadActivities, reloadWBS]);

  const handleActivitiesChanged = useCallback(async () => {
    if (!activeProjectId) return [];
    return reloadActivities(activeProjectId);
  }, [activeProjectId, reloadActivities]);

  const handleSelectModule = useCallback(
    (moduleKey) => {
      if (!availableModules.includes(moduleKey)) return;
      setActiveModule(moduleKey);
      const moduleVisibleTabs = getVisibleTabsForModule(allVisibleTabs, moduleKey);
      setActiveTab(getDefaultTabForModule(moduleKey, moduleVisibleTabs) || 'projects');
    },
    [allVisibleTabs, availableModules],
  );

  const activeTabError =
    activeTab === 'projects'
      ? projectsError
      : activeTab === 'wbs'
        ? wbsError
        : activeTab === 'activities'
          ? activitiesError
          : '';

  if (!activeModule) {
    return (
      <ModuleSelectionScreen
        user={user}
        onLogout={onLogout}
        availableModules={availableModules}
        onSelectModule={handleSelectModule}
      />
    );
  }

  return (
    <AppShell user={user} onLogout={onLogout}>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            {MODULE_DEFINITIONS[activeModule]?.eyebrow}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {MODULE_DEFINITIONS[activeModule]?.label}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {MODULE_DEFINITIONS[activeModule]?.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveModule(null)}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cambiar de módulo
        </button>
      </div>

      <ActiveProjectSummary activeProject={activeProject} loading={projectsLoading} activeModule={activeModule} />

      <Tabs activeTab={activeTab} onChange={setActiveTab} visibleTabs={visibleTabs} activeModule={activeModule} />

      {activeTabError ? <InlineAlert tone="warning" className="mt-4">{activeTabError}</InlineAlert> : null}

      <div className="mt-4">
        {activeTab === 'projects' && permissions.projects.read ? (
          <ProjectsPage
            projects={projects}
            activeProjectId={activeProjectId}
            onProjectChange={handleProjectChanged}
            onProjectsChanged={handleProjectListChanged}
            canCreate={permissions.projects.create}
            canUpdate={permissions.projects.update}
            canDelete={permissions.projects.delete}
            canCreateBaseline={permissions.baselines.create}
            canDeleteBaseline={permissions.baselines.delete}
          />
        ) : null}

        {activeTab === 'wbs' && permissions.wbs.read ? (
          <WBSPage
            activeProject={activeProject}
            tree={tree}
            canCreate={permissions.wbs.create}
            canUpdate={permissions.wbs.update}
            canDelete={permissions.wbs.delete}
            canReorder={permissions.wbs.reorder}
            operationalLock={operationalLock}
            onTreeChanged={handleWbsChanged}
          />
        ) : null}

        {activeTab === 'activities' && permissions.activities.read ? (
          <ActivitiesPage
            activeProject={activeProject}
            tree={tree}
            activities={activities}
            reloadActivities={handleActivitiesChanged}
          />
        ) : null}

        {activeTab === 'control_periods' && permissions.controlPeriods.read ? (
          <ControlPeriodsPage
            activeProject={activeProject}
            canCreate={permissions.controlPeriods.create}
            canClose={permissions.controlPeriods.close}
            canReopen={permissions.controlPeriods.reopen}
            canDelete={permissions.controlPeriods.delete}
          />
        ) : null}

        {activeTab === 'deliverables' && permissions.deliverables.read ? (
          <DeliverablesPage
            activeProject={activeProject}
            canCreate={permissions.deliverables.create}
            canUpdate={permissions.deliverables.update}
            canDelete={permissions.deliverables.delete}
            canManageRevisions={permissions.deliverables.manageRevisions}
          />
        ) : null}

        {activeTab === 'catalogs' && permissions.catalogs.read ? (
          <CatalogsPage canManage={permissions.catalogs.manage} />
        ) : null}

        {activeTab === 'audit' && permissions.audit.read ? <AuditPage /> : null}
      </div>
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
