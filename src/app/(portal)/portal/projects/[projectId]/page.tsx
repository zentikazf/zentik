'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from '@/components/ui/dialog';
import {
 ArrowLeft,
 CheckCircle2,
 Clock,
 Circle,
 Loader2,
 MessageSquarePlus,
 Plus,
 AlertCircle,
 TrendingUp,
 ListTodo,
 Calendar,
 Sparkles,
 Send,
 FileText,
 Download,
 Eye,
 BarChart3,
 ChevronRight,
 Play,
 Flag,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
 DEFINITION: { label: 'Definición', color: 'text-info', bg: 'bg-info/10' },
 DEVELOPMENT: { label: 'Desarrollo', color: 'text-primary', bg: 'bg-primary/10' },
 PRODUCTION: { label: 'Producción', color: 'text-info', bg: 'bg-info/10' },
 ON_HOLD: { label: 'En Pausa', color: 'text-muted-foreground', bg: 'bg-muted ' },
 COMPLETED: { label: 'Completado', color: 'text-muted-foreground', bg: 'bg-muted' },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
 BACKLOG: { label: 'Pendiente', color: 'text-muted-foreground', bg: 'bg-muted ', icon: Circle },
 TODO: { label: 'Por Hacer', color: 'text-info', bg: 'bg-info/10', icon: Circle },
 IN_PROGRESS: { label: 'En Progreso', color: 'text-primary', bg: 'bg-primary/10', icon: Loader2 },
 IN_REVIEW: { label: 'En Revisión', color: 'text-info', bg: 'bg-info/10', icon: Clock },
 DONE: { label: 'Completada', color: 'text-cyan-600', bg: 'bg-cyan-50', icon: CheckCircle2 },
 CANCELLED: { label: 'Cancelada', color: 'text-muted-foreground', bg: 'bg-muted', icon: AlertCircle },
};

const SUGGESTION_STATUS: Record<string, { label: string; color: string; bg: string }> = {
 PENDING: { label: 'Pendiente', color: 'text-muted-foreground', bg: 'bg-muted ' },
 REVIEWING: { label: 'En Revisión', color: 'text-info', bg: 'bg-info/10' },
 ACCEPTED: { label: 'Aceptada', color: 'text-info', bg: 'bg-info/10' },
 REJECTED: { label: 'Rechazada', color: 'text-muted-foreground', bg: 'bg-muted' },
 IMPLEMENTED: { label: 'Implementada', color: 'text-primary', bg: 'bg-primary/10' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
 LOW: { label: 'Baja', color: 'text-muted-foreground bg-muted ' },
 MEDIUM: { label: 'Media', color: 'text-primary bg-primary/10' },
 HIGH: { label: 'Alta', color: 'text-info bg-info/10' },
};

const ALCANCE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
 DRAFT: { label: 'Borrador', color: 'text-muted-foreground', bg: 'bg-muted ' },
 PENDING_APPROVAL: { label: 'Pendiente de Aprobación', color: 'text-info', bg: 'bg-info/10' },
 APPROVED: { label: 'Aprobado', color: 'text-primary', bg: 'bg-primary/10' },
 REJECTED: { label: 'Rechazado', color: 'text-muted-foreground', bg: 'bg-muted' },
};

const SPRINT_STATUS: Record<string, { label: string; color: string; bg: string; icon: any }> = {
 PLANNING: { label: 'Planificación', color: 'text-muted-foreground', bg: 'bg-muted ', icon: Circle },
 ACTIVE: { label: 'Activo', color: 'text-primary', bg: 'bg-primary/10', icon: Play },
 COMPLETED: { label: 'Completado', color: 'text-info', bg: 'bg-info/10', icon: CheckCircle2 },
};

type TabKey = 'tasks' | 'suggestions';

export default function PortalProjectDetail() {
 const { projectId } = useParams<{ projectId: string }>();
 const router = useRouter();

 const [project, setProject] = useState<any>(null);
 const [suggestions, setSuggestions] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState<TabKey>('tasks');

 // New suggestion dialog
 const [dialogOpen, setDialogOpen] = useState(false);
 const [title, setTitle] = useState('');
 const [description, setDescription] = useState('');
 const [priority, setPriority] = useState('MEDIUM');
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 async function load() {
 try {
 const [projRes, sugRes] = await Promise.all([
 api.get(`/portal/projects/${projectId}`),
 api.get(`/portal/projects/${projectId}/suggestions`),
 ]);
 setProject(projRes.data);
 const sugList = Array.isArray(sugRes.data) ? sugRes.data : sugRes.data?.data || [];
 setSuggestions(sugList);
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'Error al cargar el proyecto';
 toast.error('Error', msg);
 } finally {
 setLoading(false);
 }
 }
 load();
 }, [projectId]);

 const handleCreateSuggestion = async () => {
 if (!title.trim()) return;
 setSaving(true);
 try {
 const res = await api.post(`/portal/projects/${projectId}/suggestions`, {
 title: title.trim(),
 description: description.trim() || undefined,
 priority,
 });
 const newSug = res.data;
 setSuggestions((prev) => [newSug, ...prev]);
 setDialogOpen(false);
 setTitle('');
 setDescription('');
 setPriority('MEDIUM');
 toast.success('Sugerencia enviada', 'Tu equipo la revisará pronto');
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'Error al crear sugerencia';
 toast.error('Error', msg);
 } finally {
 setSaving(false);
 }
 };

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
 <Button variant="outline"className="mt-6 rounded-xl"onClick={() => router.push('/portal')}>
 <ArrowLeft className="mr-2 h-4 w-4"/>
 Volver al portal
 </Button>
 </div>
 );
 }

 const statusConfig = STATUS_CONFIG[project.status] || STATUS_CONFIG.DEFINITION;
 const tasks = project.tasks || [];
 const sprints = project.sprints || [];
 const doneTasks = tasks.filter((t: any) => t.status === 'DONE').length;
 const inProgressTasks = tasks.filter((t: any) => t.status === 'IN_PROGRESS').length;
 const pendingSuggestions = suggestions.filter((s) => s.status === 'PENDING' || s.status === 'REVIEWING').length;
 const alcanceInfo = project.alcanceStatus ? ALCANCE_STATUS[project.alcanceStatus] : null;

 // Group tasks by status
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
 href="/portal"
 className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-muted-foreground"
 >
 <ArrowLeft className="h-4 w-4"/>
 Mis Proyectos
 </Link>

 {/* Project Header Card */}
 <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 p-6 md:p-8">
 <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-card/5"/>
 <div className="absolute bottom-0 right-20 h-24 w-24 rounded-full bg-card/5"/>
 <div className="relative">
 <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
 <div className="flex-1">
 <Badge className={`${statusConfig.bg} ${statusConfig.color} mb-3 text-[11px] font-semibold`}>
 {statusConfig.label}
 </Badge>
 <h1 className="text-xl md:text-2xl font-bold text-white">{project.name}</h1>
 {project.description && (
 <p className="mt-2 text-sm text-primary-foreground/80 max-w-lg">{project.description}</p>
 )}
 </div>
 <div className="flex items-center gap-3">
 {project.startDate && (
 <div className="flex items-center gap-1.5 rounded-xl bg-card/10 px-3 py-2 text-xs text-primary-foreground">
 <Calendar className="h-3.5 w-3.5"/>
 {new Date(project.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
 </div>
 )}
 {project.endDate && (
 <div className="flex items-center gap-1.5 rounded-xl bg-card/10 px-3 py-2 text-xs text-primary-foreground">
 <Flag className="h-3.5 w-3.5"/>
 {new Date(project.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
 </div>
 )}
 </div>
 </div>

 {/* Progress Bar in Header */}
 <div className="mt-6">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm font-medium text-primary-foreground">Progreso general</span>
 <span className="text-lg font-bold text-white">{project.progress}%</span>
 </div>
 <div className="h-2.5 w-full rounded-full bg-card/20">
 <div
 className="h-full rounded-full bg-card transition-all duration-700"
 style={{ width: `${project.progress}%` }}
 />
 </div>
 <p className="mt-2 text-xs text-primary-foreground/70">
 {project.completedTasks} de {project.totalVisible} tareas completadas
 </p>
 </div>
 </div>
 </div>

 {/* KPI Cards */}
 <div className="grid gap-4 sm:grid-cols-3">
 <div className="flex items-center gap-4 rounded-xl bg-card p-5">
 <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
 <ListTodo className="h-5 w-5 text-primary"/>
 </div>
 <div>
 <p className="text-2xl font-bold text-foreground">{tasks.length}</p>
 <p className="text-xs text-muted-foreground">Tareas Totales</p>
 </div>
 </div>
 <div className="flex items-center gap-4 rounded-xl bg-card p-5">
 <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-50">
 <TrendingUp className="h-5 w-5 text-cyan-600"/>
 </div>
 <div>
 <p className="text-2xl font-bold text-foreground">
 {doneTasks}<span className="text-sm font-normal text-muted-foreground">/{tasks.length}</span>
 </p>
 <p className="text-xs text-muted-foreground">Completadas</p>
 </div>
 </div>
 <div className="flex items-center gap-4 rounded-xl bg-card p-5">
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
 <div className="rounded-xl bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
 <FileText className="h-5 w-5 text-info"/>
 </div>
 <div>
 <h3 className="text-sm font-semibold text-foreground">Alcance del Proyecto</h3>
 <p className="text-xs text-muted-foreground">Documento de alcance y especificaciones</p>
 </div>
 </div>
 <Badge className={`${alcanceInfo.bg} ${alcanceInfo.color} text-[11px] font-semibold`}>
 {alcanceInfo.label}
 </Badge>
 </div>

 {project.alcanceFile && (
 <div className="flex items-center justify-between rounded-xl border border-border bg-muted/50 p-4/50">
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
 <Button
 variant="outline"
 size="sm"
 className="shrink-0 rounded-xl"
 onClick={handleDownloadAlcance}
 >
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

 {/* Sprint Timeline */}
 {sprints.length > 0 && (
 <div className="rounded-xl bg-card p-6">
 <div className="flex items-center gap-3 mb-5">
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
 <BarChart3 className="h-5 w-5 text-primary"/>
 </div>
 <div>
 <h3 className="text-sm font-semibold text-foreground">Timeline de Sprints</h3>
 <p className="text-xs text-muted-foreground">{sprints.length} sprints planificados</p>
 </div>
 </div>
 <div className="relative">
 {/* Timeline line */}
 <div className="absolute left-[19px] top-3 bottom-3 w-px bg-muted"/>

 <div className="space-y-3">
 {sprints.map((sprint: any, i: number) => {
 const sprintStatus = SPRINT_STATUS[sprint.status] || SPRINT_STATUS.PLANNING;
 const SprintIcon = sprintStatus.icon;
 const isActive = sprint.status === 'ACTIVE';
 return (
 <div
 key={sprint.id}
 className={`relative flex items-center gap-4 rounded-xl px-3 py-3 transition-colors ${
 isActive
 ? 'bg-success/10 ring-1 ring-green-200'
 : 'hover:bg-muted/50/50'
 }`}
 >
 <div className={`relative z-10 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full ${
 isActive
 ? 'bg-primary/15 ring-4 ring-blue-50'
 : 'bg-muted ring-4 ring-background'
 }`}>
 <SprintIcon className={`h-4 w-4 ${sprintStatus.color}`} />
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <p className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
 {sprint.name}
 </p>
 <Badge className={`${sprintStatus.bg} ${sprintStatus.color} text-[10px]`}>
 {sprintStatus.label}
 </Badge>
 </div>
 {(sprint.startDate || sprint.endDate) && (
 <p className="mt-0.5 text-xs text-muted-foreground">
 {sprint.startDate && new Date(sprint.startDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
 {sprint.startDate && sprint.endDate && ' → '}
 {sprint.endDate && new Date(sprint.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
 </p>
 )}
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 )}

 {/* Tab Navigation */}
 <div className="flex items-center gap-2 rounded-[16px] bg-muted p-1.5">
 <button
 onClick={() => setActiveTab('tasks')}
 className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
 activeTab === 'tasks'
 ? 'bg-card text-foreground shadow-sm '
 : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 <ListTodo className="h-4 w-4"/>
 Tareas
 <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
 activeTab === 'tasks' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
 }`}>
 {tasks.length}
 </span>
 </button>
 <button
 onClick={() => setActiveTab('suggestions')}
 className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
 activeTab === 'suggestions'
 ? 'bg-card text-foreground shadow-sm '
 : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 <MessageSquarePlus className="h-4 w-4"/>
 Sugerencias
 {pendingSuggestions > 0 && (
 <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
 {pendingSuggestions}
 </span>
 )}
 </button>
 </div>

 {/* Tasks Tab */}
 {activeTab === 'tasks' && (
 <div className="space-y-4">
 {tasks.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-xl bg-card py-16 text-center">
 <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
 <ListTodo className="h-7 w-7 text-muted-foreground/50"/>
 </div>
 <h3 className="text-base font-semibold text-foreground">Sin tareas visibles</h3>
 <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
 Las tareas aparecerán aquí cuando tu equipo las asigne al proyecto.
 </p>
 </div>
 ) : (
 taskGroups.map((group) => {
 const config = TASK_STATUS_CONFIG[group.key] || TASK_STATUS_CONFIG.BACKLOG;
 return (
 <div key={group.key} className="rounded-xl bg-card overflow-hidden">
 <div className="flex items-center gap-3 px-6 pt-5 pb-3">
 <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.bg}`}>
 <config.icon className={`h-3.5 w-3.5 ${config.color}`} />
 </div>
 <h3 className="text-sm font-semibold text-foreground">
 {config.label}
 </h3>
 <span className="text-xs font-medium text-muted-foreground">{group.tasks.length}</span>
 </div>
 <div className="divide-y divide-border px-3 pb-3">
 {group.tasks.map((task: any) => (
 <div
 key={task.id}
 className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50/50"
 >
 <CheckCircle2
 className={`h-4 w-4 shrink-0 ${
 task.status === 'DONE' ? 'text-cyan-500' : 'text-muted-foreground/50'
 }`}
 />
 <div className="flex-1 min-w-0">
 <p
 className={`text-sm font-medium ${
 task.status === 'DONE'
 ? 'text-muted-foreground line-through'
 : 'text-foreground'
 }`}
 >
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
 })
 )}
 </div>
 )}

 {/* Suggestions Tab */}
 {activeTab === 'suggestions' && (
 <div className="space-y-4">
 {/* New Suggestion CTA */}
 <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 p-5 border border-primary/20">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
 <Sparkles className="h-5 w-5 text-primary"/>
 </div>
 <div>
 <p className="text-sm font-semibold text-foreground">
 ¿Tienes una idea o mejora?
 </p>
 <p className="text-xs text-muted-foreground">
 Envía sugerencias directamente a tu equipo de desarrollo
 </p>
 </div>
 </div>
 <Button
 size="sm"
 className="rounded-xl bg-primary hover:bg-primary/90 text-white shadow-sm transition-all hover:-translate-y-0.5"
 onClick={() => setDialogOpen(true)}
 >
 <Plus className="mr-1.5 h-3.5 w-3.5"/>
 <span className="hidden sm:inline">Nueva Sugerencia</span>
 <span className="sm:hidden">Nueva</span>
 </Button>
 </div>

 {suggestions.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-xl bg-card py-16 text-center">
 <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
 <MessageSquarePlus className="h-7 w-7 text-primary-foreground/70"/>
 </div>
 <h3 className="text-base font-semibold text-foreground">Sin sugerencias</h3>
 <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
 Aún no has enviado sugerencias. ¡Propón mejoras, nuevas funciones o reporta problemas!
 </p>
 </div>
 ) : (
 <div className="rounded-xl bg-card overflow-hidden divide-y divide-border">
 {suggestions.map((sug) => {
 const statusInfo = SUGGESTION_STATUS[sug.status] || SUGGESTION_STATUS.PENDING;
 const priorityInfo = PRIORITY_CONFIG[sug.priority] || PRIORITY_CONFIG.MEDIUM;
 return (
 <div
 key={sug.id}
 className="p-5 transition-colors hover:bg-muted/50/30"
 >
 <div className="flex items-start justify-between gap-3">
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <p className="text-sm font-semibold text-foreground">
 {sug.title}
 </p>
 <Badge className={`${statusInfo.bg} ${statusInfo.color} text-[10px] font-medium`}>
 {statusInfo.label}
 </Badge>
 </div>
 {sug.description && (
 <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
 {sug.description}
 </p>
 )}
 <div className="flex items-center gap-3 mt-2.5">
 <Badge className={`${priorityInfo.color} text-[10px] font-medium`}>
 {priorityInfo.label}
 </Badge>
 <span className="text-[11px] text-muted-foreground">
 {new Date(sug.createdAt).toLocaleDateString('es-ES', {
 day: '2-digit',
 month: 'short',
 year: 'numeric',
 })}
 </span>
 </div>
 </div>
 {sug.status === 'ACCEPTED' && (
 <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
 <CheckCircle2 className="h-4 w-4 text-primary"/>
 </div>
 )}
 </div>
 {sug.response && (
 <div className="mt-3 rounded-xl bg-primary/10 p-3">
 <p className="text-[11px] font-medium text-primary mb-1">
 Respuesta del equipo
 </p>
 <p className="text-xs text-primary/80 /70">{sug.response}</p>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}

 {/* Create Suggestion Dialog */}
 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent className="max-w-md rounded-xl">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2">
 <MessageSquarePlus className="h-5 w-5 text-primary"/>
 Nueva Sugerencia
 </DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-2">
 <div className="space-y-2">
 <Label className="text-sm font-medium">Título *</Label>
 <Input
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="¿Qué te gustaría sugerir?"
 className="rounded-xl"
 autoFocus
 />
 </div>
 <div className="space-y-2">
 <Label className="text-sm font-medium">Descripción</Label>
 <Textarea
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Describe tu sugerencia con detalle..."
 className="rounded-xl resize-none"
 rows={4}
 />
 </div>
 <div className="space-y-2">
 <Label className="text-sm font-medium">Prioridad</Label>
 <Select value={priority} onValueChange={setPriority}>
 <SelectTrigger className="rounded-xl">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="LOW">Baja</SelectItem>
 <SelectItem value="MEDIUM">Media</SelectItem>
 <SelectItem value="HIGH">Alta</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 <DialogFooter className="gap-2 sm:gap-0">
 <Button variant="outline"className="rounded-xl"onClick={() => setDialogOpen(false)}>
 Cancelar
 </Button>
 <Button
 className="rounded-xl bg-primary hover:bg-primary/90"
 onClick={handleCreateSuggestion}
 disabled={saving || !title.trim()}
 >
 {saving ? (
 <>
 <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
 Enviando...
 </>
 ) : (
 <>
 <Send className="mr-2 h-4 w-4"/>
 Enviar Sugerencia
 </>
 )}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
