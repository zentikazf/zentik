'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderKanban, MessageSquarePlus, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
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

interface PortalProject {
 id: string;
 name: string;
 status: string;
 startDate?: string;
 endDate?: string;
 createdAt: string;
 suggestionsCount: number;
 visibleTasks: number;
 completedTasks: number;
 progress: number;
}

export default function PortalProjectsPage() {
 const [projects, setProjects] = useState<PortalProject[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 async function load() {
 try {
 const res = await api.get('/portal/projects');
 const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
 setProjects(data);
 } catch (err) {
 toast.error('Error', 'Error al cargar los proyectos');
 } finally {
 setLoading(false);
 }
 }
 load();
 }, []);

 if (loading) {
 return (
 <div className="mx-auto max-w-5xl space-y-6">
 <Skeleton className="h-10 w-48 rounded-xl"/>
 <div className="grid gap-4 md:grid-cols-2">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-48 rounded-xl"/>
 ))}
 </div>
 </div>
 );
 }

 return (
 <div className="mx-auto max-w-5xl space-y-8 pb-4">
 <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <h1 className="text-2xl font-bold text-foreground">Mis Proyectos</h1>
 <p className="text-sm text-muted-foreground mt-1">Gestiona y visualiza el progreso de tus proyectos activos</p>
 </div>
 <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1.5">
 <FolderKanban className="h-4 w-4 text-primary"/>
 <span className="text-sm font-semibold text-primary">{projects.length} Total</span>
 </div>
 </div>

 {projects.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-xl bg-card py-20 text-center border border-border">
 <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
 <FolderKanban className="h-7 w-7 text-primary"/>
 </div>
 <h3 className="text-lg font-semibold text-foreground">Sin proyectos</h3>
 <p className="mt-2 max-w-sm text-sm text-muted-foreground">
 Aun no tienes proyectos asignados. El equipo se pondra en contacto pronto.
 </p>
 </div>
 ) : (
 <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
 {projects.map((project) => {
 const config = STATUS_CONFIG[project.status] || STATUS_CONFIG.DEFINITION;
 return (
 <Link
 key={project.id}
 href={`/portal/projects/${project.id}`}
 className="group flex flex-col justify-between relative rounded-xl bg-card p-6 transition-colors border border-border hover:bg-muted/30 hover:border-primary/30"
 >
 <div>
 <div className="mb-4 flex justify-between items-start gap-4">
 <h3 className="text-lg font-bold leading-tight text-foreground group-hover:text-primary transition-colors">
 {project.name}
 </h3>
 <Badge className={`${config.bg} ${config.color} border-none text-[10px] uppercase tracking-wider font-bold shrink-0`}>
 {config.label}
 </Badge>
 </div>

 <div className="mb-6 space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-xs font-semibold text-muted-foreground">Progreso General</span>
 <span className="text-sm font-bold text-primary">{project.progress}%</span>
 </div>
 <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
 <div
 className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
 style={{ width: `${project.progress}%` }}
 />
 </div>
 </div>
 </div>

 <div className="flex items-center gap-4 text-xs mt-4 pt-4 border-t border-border">
 <span className="flex items-center gap-1.5 text-muted-foreground">
 <CheckCircle2 className="h-4 w-4 text-primary"/>
 <span className="font-semibold text-foreground">{project.completedTasks}</span>/{project.visibleTasks}
 </span>
 {project.suggestionsCount > 0 && (
 <span className="flex items-center gap-1.5 text-muted-foreground">
 <MessageSquarePlus className="h-4 w-4 text-primary"/>
 <span className="font-semibold text-foreground">{project.suggestionsCount}</span>
 </span>
 )}
 {project.endDate && (
 <span className="flex items-center gap-1.5 text-muted-foreground ml-auto">
 <Clock className="h-4 w-4 text-muted-foreground"/>
 {new Date(project.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
 </span>
 )}
 </div>
 </Link>
 );
 })}
 </div>
 )}
 </div>
 );
}
