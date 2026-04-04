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
import { PhaseBadge } from '@/components/ui/phase-badge';
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
 // Sugerencias desactivado — reemplazado por sistema de Tickets
 // { label: 'Sugerencias', href: '/suggestions', icon: MessageSquare, badgeKey: 'suggestions', permission: 'manage:projects' },
 { label: 'Archivos', href: '/files', icon: FolderOpen },
 { label: 'Aprobaciones', href: '/approvals', icon: ClipboardCheck, badgeKey: 'approvals', permission: 'manage:projects' },
 { label: 'Calendario', href: '/calendar', icon: CalendarDays },
 { label: 'Config', href: '/settings', icon: Settings, permission: 'manage:projects' },
];

const statusLabels: Record<string, string> = {
 DISCOVERY: 'Descubrimiento',
 PLANNING: 'Planificación',
 DEVELOPMENT: 'Desarrollo',
 TESTING: 'Testing',
 DEPLOY: 'Deploy',
 SUPPORT: 'Soporte',
 ON_HOLD: 'En Pausa',
 COMPLETED: 'Completado',
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
 <Skeleton className="h-16 rounded-xl"/>
 <Skeleton className="h-12 rounded-xl"/>
 <Skeleton className="h-[500px] rounded-xl"/>
 </div>
 );
 }

 if (!project) {
 return (
 <div className="flex items-center justify-center py-24">
 <p className="text-muted-foreground">Proyecto no encontrado</p>
 </div>
 );
 }

 return (
 <div className="space-y-6">
 {/* Title Row */}
 <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
 <div className="flex items-center gap-3">
 <h1 className="text-xl md:text-2xl font-semibold text-foreground">
 {project.name}
 </h1>
 <PhaseBadge
 phase={project.status}
 label={statusLabels[project.status] || project.status}
 />
 </div>

 <div className="flex items-center gap-4">
 {/* Secondary Actions */}
 <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 shadow-sm">
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
 ? 'bg-primary/10 text-primary'
 : 'text-muted-foreground hover:bg-muted hover:text-foreground',
 )}
 >
 <div className="relative flex items-center justify-center">
 <Icon className="h-4 w-4"/>
 {badgeCount > 0 && (
 <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background">
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
 <Avatar key={m.id} className="h-8 w-8 border-2 border-background">
 <AvatarImage src={m.user?.image} />
 <AvatarFallback className="bg-muted text-xs text-muted-foreground">
 {getInitials(m.user?.name || '')}
 </AvatarFallback>
 </Avatar>
 ))}
 </div>
 {project._count?.members > 3 && (
 <span className="text-xs font-medium text-muted-foreground">
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
 <div className="flex items-center rounded-lg border border-border bg-muted/50 p-1">
 {visiblePrimaryTabs.map((tab) => {
 const Icon = tab.icon;
 const active = isTabActive(tab.href);
 return (
 <Link key={tab.href} href={base + tab.href}>
 <button
 className={cn(
 'flex shrink-0 items-center gap-2 rounded-md px-3 md:px-4 py-2 text-sm font-medium transition-all',
 active
 ? 'bg-background shadow-sm text-foreground border border-border'
 : 'text-muted-foreground hover:text-foreground',
 )}
 >
 <Icon className="h-4 w-4"/>
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
 <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-sm">
 <span className="text-primary font-semibold">{project._count?.tasks || 0}</span>
 <span className="text-primary/70">Total</span>
 </div>
 <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-1.5 text-sm">
 <span className="text-success font-semibold">{project.stats?.completed || 0}</span>
 <span className="text-success/70">Completadas</span>
 </div>
 <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-1.5 text-sm">
 <span className="text-warning font-semibold">{project.stats?.inProgress || 0}</span>
 <span className="text-warning/70">En Progreso</span>
 </div>
 {project.alcanceStatus && (
 <div className={cn(
 'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm',
 project.alcanceStatus === 'APPROVED' && 'bg-success/10',
 project.alcanceStatus === 'PENDING_APPROVAL' && 'bg-warning/10',
 project.alcanceStatus === 'REJECTED' && 'bg-destructive/10',
 project.alcanceStatus === 'DRAFT' && 'bg-muted',
 )}>
 <span className={cn(
 'font-semibold',
 project.alcanceStatus === 'APPROVED' && 'text-success',
 project.alcanceStatus === 'PENDING_APPROVAL' && 'text-warning',
 project.alcanceStatus === 'REJECTED' && 'text-destructive',
 project.alcanceStatus === 'DRAFT' && 'text-muted-foreground',
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
