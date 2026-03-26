'use client';

import { useParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare,
  FolderOpen,
  Settings,
  FileText as AlcanceIcon,
  Calculator,
  ListTodo,
  LayoutDashboard,
  FileText,
  BarChart2,
  Timer,
  BarChart3,
  ClipboardCheck,
  CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ProjectProvider, useProject } from '@/providers/project-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { getInitials } from '@/lib/utils';

interface TabItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  badgeKey?: 'suggestions' | 'approvals';
}

const primaryTabs: TabItem[] = [
  { label: 'Alcance', href: '/alcance', icon: AlcanceIcon, permission: 'manage:projects' },
  { label: 'Presupuesto', href: '/presupuesto', icon: Calculator, permission: 'manage:projects' },
  { label: 'Tareas', href: '/backlog', icon: ListTodo, permission: 'read:tasks' },
  { label: 'Kanban', href: '/board', icon: LayoutDashboard, permission: 'read:boards' },
  { label: 'Factura', href: '/invoices', icon: FileText, permission: 'read:billing' },
  { label: 'Reportes', href: '/reports', icon: BarChart2, permission: 'read:projects' },
];

const secondaryActions: TabItem[] = [
  { label: 'Sprints', href: '/sprints', icon: BarChart3, permission: 'read:sprints' },
  { label: 'Tiempo', href: '/time', icon: Timer, permission: 'read:time-entries' },
  { label: 'Sugerencias', href: '/suggestions', icon: MessageSquare, badgeKey: 'suggestions', permission: 'manage:projects' },
  { label: 'Archivos', href: '/files', icon: FolderOpen },
  { label: 'Aprobaciones', href: '/approvals', icon: ClipboardCheck, badgeKey: 'approvals', permission: 'manage:projects' },
  { label: 'Calendario', href: '/calendar', icon: CalendarDays },
  { label: 'Config', href: '/settings', icon: Settings, permission: 'manage:projects' },
];

const statusConfig: Record<string, { label: string; className: string }> = {
  DEFINITION: { label: 'Definición', className: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400' },
  DEVELOPMENT: { label: 'Desarrollo', className: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400' },
  PRODUCTION: { label: 'Producción', className: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400' },
  ON_HOLD: { label: 'En Pausa', className: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400' },
  COMPLETED: { label: 'Completado', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

function ProjectLayoutInner({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const pathname = usePathname();
  const { project, loading } = useProject();
  const { hasPermission } = usePermissions();

  const base = `/projects/${projectId}`;

  const visiblePrimaryTabs = primaryTabs.filter(
    (tab) => !tab.permission || hasPermission(tab.permission),
  );

  const visibleSecondaryActions = secondaryActions.filter(
    (action) => !action.permission || hasPermission(action.permission),
  );

  const isTabActive = (href: string) => {
    const fullPath = base + href;
    return pathname === fullPath || pathname.startsWith(fullPath + '/');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-[500px] rounded-[25px]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-gray-400">Proyecto no encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-white">
            {project.name}
          </h1>
          <Badge className={statusConfig[project.status]?.className || 'bg-gray-100 text-gray-500'}>
            {statusConfig[project.status]?.label || project.status}
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          {/* Secondary Actions */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-100 bg-white p-1 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {visibleSecondaryActions.map((action) => {
              const Icon = action.icon;
              const active = isTabActive(action.href);
              const badgeCount = action.badgeKey === 'suggestions'
                ? (project.pendingSuggestionsCount || 0)
                : action.badgeKey === 'approvals'
                  ? (project.pendingApprovalsCount || 0)
                  : 0;
              return (
                <Link key={action.href} href={base + action.href}>
                  <button
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400',
                    )}
                  >
                    <div className="relative flex items-center justify-center">
                      <Icon className="h-4 w-4" />
                      {badgeCount > 0 && (
                        <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </div>
                    <span className="hidden lg:inline">{action.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>

          {/* Team Avatars (compact) - hidden on small screens */}
          {project._count?.members > 0 && (
            <Link href={base + '/settings'} className="hidden sm:block">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {(project.members || []).slice(0, 3).map((m: any) => (
                    <Avatar key={m.id} className="h-8 w-8 border-2 border-white dark:border-gray-950">
                      <AvatarImage src={m.user?.image} />
                      <AvatarFallback className="bg-blue-100 text-xs text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                        {getInitials(m.user?.name || '')}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                {project._count?.members > 3 && (
                  <span className="text-xs font-medium text-gray-400">
                    +{project._count.members - 3}
                  </span>
                )}
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
            {visiblePrimaryTabs.map((tab) => {
              const Icon = tab.icon;
              const active = isTabActive(tab.href);
              return (
                <Link key={tab.href} href={base + tab.href}>
                  <button
                    className={cn(
                      'flex shrink-0 items-center gap-2 rounded-md px-3 md:px-4 py-2 text-sm font-medium transition-all',
                      active
                        ? 'border border-gray-100 bg-white text-blue-600 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-blue-400'
                        : 'text-gray-500 hover:bg-white hover:text-blue-600 hover:shadow-sm dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mini Summary */}
      <div className="flex flex-wrap items-center gap-2 md:gap-4">
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm dark:bg-blue-950">
          <span className="text-blue-600 dark:text-blue-400 font-semibold">{project._count?.tasks || 0}</span>
          <span className="text-blue-500/70 dark:text-blue-400/70">Total</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-1.5 text-sm dark:bg-green-950">
          <span className="text-green-600 dark:text-green-400 font-semibold">{project.stats?.completed || 0}</span>
          <span className="text-green-500/70 dark:text-green-400/70">Completadas</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-yellow-50 px-3 py-1.5 text-sm dark:bg-yellow-950">
          <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{project.stats?.inProgress || 0}</span>
          <span className="text-yellow-500/70 dark:text-yellow-400/70">En Progreso</span>
        </div>
        {project.alcanceStatus && (
          <div className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm',
            project.alcanceStatus === 'APPROVED' && 'bg-green-50 dark:bg-green-950',
            project.alcanceStatus === 'PENDING_APPROVAL' && 'bg-orange-50 dark:bg-orange-950',
            project.alcanceStatus === 'REJECTED' && 'bg-red-50 dark:bg-red-950',
            project.alcanceStatus === 'DRAFT' && 'bg-gray-50 dark:bg-gray-800',
          )}>
            <span className={cn(
              'font-semibold',
              project.alcanceStatus === 'APPROVED' && 'text-green-600 dark:text-green-400',
              project.alcanceStatus === 'PENDING_APPROVAL' && 'text-orange-600 dark:text-orange-400',
              project.alcanceStatus === 'REJECTED' && 'text-red-600 dark:text-red-400',
              project.alcanceStatus === 'DRAFT' && 'text-gray-600 dark:text-gray-400',
            )}>
              Alcance: {
                project.alcanceStatus === 'DRAFT' ? 'Borrador' :
                project.alcanceStatus === 'PENDING_APPROVAL' ? 'Pendiente' :
                project.alcanceStatus === 'APPROVED' ? 'Aprobado' : 'Rechazado'
              }
            </span>
          </div>
        )}
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <ProjectProvider projectId={projectId}>
      <ProjectLayoutInner>{children}</ProjectLayoutInner>
    </ProjectProvider>
  );
}
