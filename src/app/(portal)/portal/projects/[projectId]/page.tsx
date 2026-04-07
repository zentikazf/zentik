'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
 ArrowLeft,
 CheckCircle2,
 Clock,
 Circle,
 Loader2,
 AlertCircle,
 TrendingUp,
 ListTodo,
 Calendar,
 FileText,
 Download,
 Flag,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
 DISCOVERY: { label: 'Descubrimiento', color: 'text-info', bg: 'bg-info/10' },
 PLANNING: { label: 'Planificación', color: 'text-info', bg: 'bg-info/10' },
 DEVELOPMENT: { label: 'Desarrollo', color: 'text-primary', bg: 'bg-primary/10' },
 TESTING: { label: 'Testing', color: 'text-warning', bg: 'bg-warning/10' },
 DEPLOY: { label: 'Deploy', color: 'text-success', bg: 'bg-success/10' },
 SUPPORT: { label: 'Soporte', color: 'text-info', bg: 'bg-info/10' },
 ON_HOLD: { label: 'En Pausa', color: 'text-muted-foreground', bg: 'bg-muted' },
 COMPLETED: { label: 'Completado', color: 'text-muted-foreground', bg: 'bg-muted' },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
 BACKLOG: { label: 'Nuevo', color: 'text-muted-foreground', bg: 'bg-muted', icon: Circle },
 TODO: { label: 'Pendiente', color: 'text-info', bg: 'bg-info/10', icon: Circle },
 IN_PROGRESS: { label: 'En Desarrollo', color: 'text-primary', bg: 'bg-primary/10', icon: Loader2 },
 IN_REVIEW: { label: 'En Revisión', color: 'text-info', bg: 'bg-info/10', icon: Clock },
 DONE: { label: 'Completada', color: 'text-success', bg: 'bg-success/10', icon: CheckCircle2 },
 CANCELLED: { label: 'Cancelada', color: 'text-muted-foreground', bg: 'bg-muted', icon: AlertCircle },
};

const ALCANCE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
 DRAFT: { label: 'Borrador', color: 'text-muted-foreground', bg: 'bg-muted' },
 PENDING_APPROVAL: { label: 'Pendiente de Aprobación', color: 'text-info', bg: 'bg-info/10' },
 APPROVED: { label: 'Aprobado', color: 'text-primary', bg: 'bg-primary/10' },
 REJECTED: { label: 'Rechazado', color: 'text-muted-foreground', bg: 'bg-muted' },
};

export default function PortalProjectDetail() {
 const { projectId } = useParams<{ projectId: string }>();
 const router = useRouter();

 const [project, setProject] = useState<any>(null);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
  async function load() {
   try {
    const projRes = await api.get(`/portal/projects/${projectId}`);
    setProject(projRes.data);
   } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'Error al cargar el proyecto';
    toast.error('Error', msg);
   } finally {
    setLoading(false);
   }
  }
  load();
 }, [projectId]);

 const handleDownloadAlcance = async () => {
  if (!project?.alcanceFileId) return;
  try {
   const res = await api.get(`/files/${project.alcanceFileId}/download`);
   const url = res.data?.url || res.data;
   if (url) window.open(url, '_blank');
  } catch {
   toast.error('Error', 'No se pudo descargar el documento');
  }
 };

 if (loading) {
  return (
   <div className="mx-auto max-w-5xl space-y-6">
    <Skeleton className="h-10 w-48 rounded-xl"/>
    <Skeleton className="h-48 rounded-xl"/>
    <div className="grid gap-4 sm:grid-cols-3">
     {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-24 rounded-xl"/>
     ))}
    </div>
    <Skeleton className="h-96 rounded-xl"/>
   </div>
  );
 }

 if (!project) {
  return (
   <div className="flex flex-col items-center justify-center py-24 text-center">
    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
     <AlertCircle className="h-7 w-7 text-muted-foreground/50"/>
    </div>
    <h3 className="text-base font-semibold text-foreground">Proyecto no encontrado</h3>
    <p className="mt-1.5 text-sm text-muted-foreground">Este proyecto no existe o no tienes acceso.</p>
    <Button variant="outline" className="mt-6 rounded-xl" onClick={() => router.push('/portal/projects')}>
     <ArrowLeft className="mr-2 h-4 w-4"/>
     Volver a proyectos
    </Button>
   </div>
  );
 }

 const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG.DISCOVERY;
 const tasks = project.tasks || [];
 const doneTasks = tasks.filter((t: any) => t.status === 'DONE').length;
 const inProgressTasks = tasks.filter((t: any) => t.status === 'IN_PROGRESS').length;
 const alcanceInfo = project.alcanceStatus ? ALCANCE_STATUS[project.alcanceStatus] : null;

 const taskGroups = [
  { key: 'IN_PROGRESS', tasks: tasks.filter((t: any) => t.status === 'IN_PROGRESS') },
  { key: 'IN_REVIEW', tasks: tasks.filter((t: any) => t.status === 'IN_REVIEW') },
  { key: 'TODO', tasks: tasks.filter((t: any) => t.status === 'TODO') },
  { key: 'BACKLOG', tasks: tasks.filter((t: any) => t.status === 'BACKLOG') },
  { key: 'DONE', tasks: tasks.filter((t: any) => t.status === 'DONE') },
  { key: 'CANCELLED', tasks: tasks.filter((t: any) => t.status === 'CANCELLED') },
 ].filter((g) => g.tasks.length > 0);

 return (
  <div className="mx-auto max-w-5xl space-y-6">
   {/* Back Navigation */}
   <Link
    href="/portal/projects"
    className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
   >
    <ArrowLeft className="h-4 w-4"/>
    Mis Proyectos
   </Link>

   {/* Project Header */}
   <div className="rounded-xl border border-border bg-card p-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
     <div className="flex-1">
      <Badge className={`${statusConfig.bg} ${statusConfig.color} mb-3 text-[11px] font-semibold border-none`}>
       {statusConfig.label}
      </Badge>
      <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
      {project.description && (
       <p className="mt-2 text-sm text-muted-foreground max-w-lg">{project.description}</p>
      )}
     </div>
     <div className="flex items-center gap-3">
      {project.startDate && (
       <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5"/>
        {new Date(project.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
       </div>
      )}
      {project.endDate && (
       <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Flag className="h-3.5 w-3.5"/>
        {new Date(project.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
       </div>
      )}
     </div>
    </div>

    {/* Progress Bar */}
    <div className="mt-6">
     <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium text-muted-foreground">Progreso general</span>
      <span className="text-lg font-bold text-foreground">{project.progress}%</span>
     </div>
     <div className="h-2 w-full rounded-full bg-muted">
      <div
       className="h-full rounded-full bg-primary transition-all duration-700"
       style={{ width: `${project.progress}%` }}
      />
     </div>
     <p className="mt-2 text-xs text-muted-foreground">
      {project.completedTasks} de {project.totalVisible} tareas completadas
     </p>
    </div>
   </div>

   {/* KPI Cards */}
   <div className="grid gap-4 sm:grid-cols-3">
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
     <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
      <ListTodo className="h-5 w-5 text-primary"/>
     </div>
     <div>
      <p className="text-2xl font-bold text-foreground">{tasks.length}</p>
      <p className="text-xs text-muted-foreground">Tareas Totales</p>
     </div>
    </div>
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
     <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
      <TrendingUp className="h-5 w-5 text-primary"/>
     </div>
     <div>
      <p className="text-2xl font-bold text-foreground">
       {doneTasks}<span className="text-sm font-normal text-muted-foreground">/{tasks.length}</span>
      </p>
      <p className="text-xs text-muted-foreground">Completadas</p>
     </div>
    </div>
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
     <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
      <Loader2 className="h-5 w-5 text-primary"/>
     </div>
     <div>
      <p className="text-2xl font-bold text-foreground">{inProgressTasks}</p>
      <p className="text-xs text-muted-foreground">En Progreso</p>
     </div>
    </div>
   </div>

   {/* Alcance Section */}
   {alcanceInfo && (
    <div className="rounded-xl border border-border bg-card p-6">
     <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
       <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
        <FileText className="h-5 w-5 text-primary"/>
       </div>
       <div>
        <h3 className="text-sm font-semibold text-foreground">Alcance del Proyecto</h3>
        <p className="text-xs text-muted-foreground">Documento de alcance y especificaciones</p>
       </div>
      </div>
      <Badge className={`${alcanceInfo.bg} ${alcanceInfo.color} text-[11px] font-semibold border-none`}>
       {alcanceInfo.label}
      </Badge>
     </div>

     {project.alcanceFile && (
      <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 p-4">
       <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground"/>
        <div className="min-w-0">
         <p className="text-sm font-medium text-foreground truncate">
          {project.alcanceFile.originalName}
         </p>
         <p className="text-xs text-muted-foreground">
          {(project.alcanceFile.size / 1024).toFixed(0)} KB
          {' · '}
          {new Date(project.alcanceFile.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
         </p>
        </div>
       </div>
       <Button variant="outline" size="sm" className="shrink-0" onClick={handleDownloadAlcance}>
        <Download className="mr-1.5 h-3.5 w-3.5"/>
        Descargar
       </Button>
      </div>
     )}

     {!project.alcanceFile && (
      <p className="text-sm text-muted-foreground text-center py-4">
       El documento de alcance aún no ha sido cargado.
      </p>
     )}
    </div>
   )}

   {/* Tasks */}
   <div>
    <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
     <ListTodo className="h-5 w-5 text-primary"/>
     Tareas
     <span className="text-sm font-normal text-muted-foreground">({tasks.length})</span>
    </h2>

    {tasks.length === 0 ? (
     <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
       <ListTodo className="h-7 w-7 text-muted-foreground/50"/>
      </div>
      <h3 className="text-base font-semibold text-foreground">Sin tareas visibles</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
       Las tareas aparecerán aquí cuando tu equipo las asigne al proyecto.
      </p>
     </div>
    ) : (
     <div className="space-y-4">
      {taskGroups.map((group) => {
       const config = TASK_STATUS_CONFIG[group.key] || TASK_STATUS_CONFIG.BACKLOG;
       return (
        <div key={group.key} className="rounded-xl border border-border bg-card overflow-hidden">
         <div className="flex items-center gap-3 px-6 pt-5 pb-3">
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.bg}`}>
           <config.icon className={`h-3.5 w-3.5 ${config.color}`} />
          </div>
          <h3 className="text-sm font-semibold text-foreground">{config.label}</h3>
          <span className="text-xs font-medium text-muted-foreground">{group.tasks.length}</span>
         </div>
         <div className="divide-y divide-border px-3 pb-3">
          {group.tasks.map((task: any) => (
           <div key={task.id} className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50">
            <CheckCircle2
             className={`h-4 w-4 shrink-0 ${
              task.status === 'DONE' ? 'text-success' : 'text-muted-foreground/50'
             }`}
            />
            <div className="flex-1 min-w-0">
             <p className={`text-sm font-medium ${task.status === 'DONE' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {task.title}
             </p>
             {task.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
             )}
            </div>
            {task.dueDate && (
             <span className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3"/>
              {new Date(task.dueDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
             </span>
            )}
           </div>
          ))}
         </div>
        </div>
       );
      })}
     </div>
    )}
   </div>
  </div>
 );
}
