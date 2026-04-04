import { useCallback, useEffect, useMemo, useState } from 'react';
import AppShell from './components/layout/AppShell.jsx';
import Tabs from './components/layout/Tabs.jsx';
import InlineAlert from './components/common/InlineAlert.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import WBSPage from './pages/WBSPage.jsx';
import ActivitiesPage from './pages/ActivitiesPage.jsx';
import ControlPeriodsPage from './pages/ControlPeriodsPage.jsx';
import TemplatesPage from './pages/TemplatesPage.jsx';
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
      'Gestiona proyectos, WBS, actividades, períodos financieros, plantillas y el seguimiento operativo del proyecto activo.',
    preferredTabs: ['projects', 'wbs', 'activities', 'control_periods', 'templates', 'catalogs', 'audit'],
  },
  document_control: {
    key: 'document_control',
    label: 'Control Documentario',
    eyebrow: 'Módulo 2',
    description:
      'Registra y controla entregables, códigos documentarios, revisiones y respuestas.',
    preferredTabs: ['deliverables', 'catalogs', 'audit'],
  },
};

function LoadingScreen() {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="text-sm font-medium text-slate-500">Cargando seguridad ERP...</div>
    </div>
  );
}

function getAllVisibleTabs(permissions) {
  const tabs = [];
  if (permissions.projects.read) tabs.push('projects');
  if (permissions.wbs.read) tabs.push('wbs');
  if (permissions.activities.read) tabs.push('activities');
  if (permissions.controlPeriods.read) tabs.push('control_periods');
  const hasProjectControlAccess =
    permissions.projects.read ||
    permissions.wbs.read ||
    permissions.activities.read ||
    permissions.controlPeriods.read ||
    permissions.layoutTemplates.read;
  if (hasProjectControlAccess) tabs.push('templates');
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
    permissions.layoutTemplates.read ||
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
    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
      {label}: {value}
    </span>
  );
}

function ActiveProjectSummary({ activeProject, loading, activeModule }) {
  const helperText =
    activeModule === 'document_control'
      ? 'El proyecto activo define el contexto del registro documentario.'
      : 'Selecciona un proyecto para trabajar sobre su WBS, actividades, periodos financieros y plantillas.';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proyecto activo</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">
        {activeProject ? activeProject.name : loading ? 'Cargando...' : 'Ninguno'}
      </div>
      <div className="mt-1 text-sm text-slate-500">
        {activeProject ? activeProject.description || 'Sin descripción' : helperText}
      </div>
      {activeProject ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill label="Código" value={activeProject.code} />
          <Pill label="Estado" value={activeProject.status_code || activeProject.status} />
          <Pill label="Prioridad" value={activeProject.priority_code} />
          <Pill label="Moneda" value={activeProject.currency_code} />
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
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{module.eyebrow}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{module.label}</div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{module.description}</div>
      <div className="mt-6 text-sm font-medium text-blue-700">
        {disabled ? 'Sin acceso disponible' : 'Ingresar al módulo'}
      </div>
    </button>
  );
}

function ModuleSelectionScreen({ availableModules, onSelectModule }) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">ProyectoMGM</div>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900">Selecciona el módulo al que deseas ingresar</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          La aplicación se divide en dos frentes operativos. Ingresa al módulo de control del proyecto
          o al módulo de control documentario según el trabajo que vayas a realizar.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
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
      layoutTemplates: {
        read: can('layout_templates.read'),
        create: can('layout_templates.create'),
        update: can('layout_templates.update'),
        delete: can('layout_templates.delete'),
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

  const handleProjectChanged = useCallback(
    async (projectId) => {
      setActiveProjectId(projectId);
    },
    [setActiveProjectId],
  );

  const handleProjectListChanged = useCallback(
    async (preferredProjectId) => {
      await reloadProjects(preferredProjectId);
    },
    [reloadProjects],
  );

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
    return <ModuleSelectionScreen availableModules={availableModules} onSelectModule={handleSelectModule} />;
  }

  return (
    <AppShell user={user} onLogout={onLogout}>
      <div className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {MODULE_DEFINITIONS[activeModule]?.eyebrow}
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900">
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
        </div>

        <ActiveProjectSummary activeProject={activeProject} loading={projectsLoading} activeModule={activeModule} />

        <Tabs activeTab={activeTab} onChange={setActiveTab} visibleTabs={visibleTabs} />

        {activeTabError ? <InlineAlert variant="error">{activeTabError}</InlineAlert> : null}

        {activeTab === 'projects' && permissions.projects.read ? (
          <ProjectsPage
            projects={projects}
            activeProjectId={activeProjectId}
            activeProject={activeProject}
            onProjectChanged={handleProjectChanged}
            onProjectListChanged={handleProjectListChanged}
            permissions={permissions}
            operationalLock={operationalLock}
          />
        ) : null}

        {activeTab === 'wbs' && permissions.wbs.read ? (
          <WBSPage
            activeProjectId={activeProjectId}
            activeProject={activeProject}
            tree={tree}
            loading={wbsLoading}
            error={wbsError}
            onChanged={handleWbsChanged}
            permissions={permissions}
            operationalLock={operationalLock}
          />
        ) : null}

        {activeTab === 'activities' && permissions.activities.read ? (
          <ActivitiesPage
            activeProjectId={activeProjectId}
            activeProject={activeProject}
            tree={tree}
            activities={activities}
            loading={activitiesLoading}
            error={activitiesError}
            onChanged={handleActivitiesChanged}
            permissions={permissions}
            operationalLock={operationalLock}
          />
        ) : null}

        {activeTab === 'control_periods' && permissions.controlPeriods.read ? (
          <ControlPeriodsPage
            activeProjectId={activeProjectId}
            activeProject={activeProject}
            permissions={permissions}
            operationalLock={operationalLock}
          />
        ) : null}

        {activeTab === 'templates' && permissions.layoutTemplates.read ? (
          <TemplatesPage
            activeProjectId={activeProjectId}
            activeProject={activeProject}
            permissions={permissions}
            operationalLock={operationalLock}
          />
        ) : null}

        {activeTab === 'deliverables' && permissions.deliverables.read ? (
          <DeliverablesPage
            activeProjectId={activeProjectId}
            activeProject={activeProject}
            permissions={permissions}
            operationalLock={operationalLock}
          />
        ) : null}

        {activeTab === 'catalogs' && permissions.catalogs.read ? (
          <CatalogsPage permissions={permissions} />
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
