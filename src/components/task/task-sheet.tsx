'use client';

import { useEffect, useState, useCallback } from 'react';
import {
 Sheet,
 SheetContent,
 SheetHeader,
 SheetTitle,
 SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
 Calendar, Tag, User, Clock, CheckCircle2, Paperclip,
 Download, File as FileIcon, Image, FileText, Plus, Send,
 MessageSquare, Upload, Shield, ExternalLink, Eye, EyeOff, Lock, ChevronRight,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatDate, formatRelative, getInitials } from '@/lib/utils';
import Link from 'next/link';
import { LabelSelector } from '@/components/labels/label-selector';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { TASK_TYPE_OPTIONS } from '@/lib/task-utils';

const STATUS_OPTIONS = [
 { value: 'BACKLOG', label: 'Nuevo' },
 { value: 'TODO', label: 'Pendiente' },
 { value: 'IN_PROGRESS', label: 'En Desarrollo' },
 { value: 'IN_REVIEW', label: 'En Revisión' },
 { value: 'DONE', label: 'Completada' },
 { value: 'CANCELLED', label: 'Cancelada' },
];

const PRIORITY_OPTIONS = [
 { value: 'LOW', label: 'Baja', color: 'bg-primary/10 text-primary' },
 { value: 'MEDIUM', label: 'Media', color: 'bg-warning/10 text-warning' },
 { value: 'HIGH', label: 'Alta', color: 'bg-warning/10 text-warning ' },
 { value: 'URGENT', label: 'Urgente', color: 'bg-destructive/10 text-destructive' },
];

const STATUS_COLORS: Record<string, string> = {
 BACKLOG: 'bg-muted-foreground', TODO: 'bg-primary', IN_PROGRESS: 'bg-warning',
 IN_REVIEW: 'bg-info', DONE: 'bg-success', CANCELLED: 'bg-destructive',
};

interface TaskSheetProps {
 taskId: string | null;
 projectId: string;
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onTaskUpdated?: () => void;
}

export function TaskSheet({ taskId, projectId, open, onOpenChange, onTaskUpdated }: TaskSheetProps) {
 const [task, setTask] = useState<any>(null);
 const [loading, setLoading] = useState(false);

 // Inline edit
 const [editTitle, setEditTitle] = useState(false);
 const [editDesc, setEditDesc] = useState(false);
 const [titleDraft, setTitleDraft] = useState('');
 const [descDraft, setDescDraft] = useState('');

 // Comments
 const [comments, setComments] = useState<any[]>([]);
 const [newComment, setNewComment] = useState('');

 // Subtasks
 const [newSubtask, setNewSubtask] = useState('');

 // Tab
 const [tab, setTab] = useState<'details' | 'comments' | 'subtasks' | 'activity'>('details');
 const [showRejections, setShowRejections] = useState(false);

 const loadTask = useCallback(async () => {
 if (!taskId) return;
 setLoading(true);
 try {
 const res = await api.get(`/tasks/${taskId}`);
 setTask(res.data);
 setTitleDraft(res.data.title || '');
 setDescDraft(res.data.description || '');
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'Error al cargar la tarea';
 toast.error('Error', msg);
 } finally {
 setLoading(false);
 }
 }, [taskId]);

 const loadComments = useCallback(async () => {
 if (!taskId) return;
 try {
 const res = await api.get(`/tasks/${taskId}/comments`);
 const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
 setComments(list);
 } catch {
 /* silent */
 }
 }, [taskId]);

 useEffect(() => {
 if (open && taskId) {
 setTask(null);
 setTab('details');
 setEditTitle(false);
 setEditDesc(false);
 setNewComment('');
 setNewSubtask('');
 loadTask();
 loadComments();
 }
 }, [open, taskId, loadTask, loadComments]);

 const [selectedSubtask, setSelectedSubtask] = useState<any>(null);

 const patchTask = async (data: Record<string, unknown>) => {
 if (!taskId) return;
 try {
 const res = await api.patch(`/tasks/${taskId}`, data);
 setTask(res.data);
 onTaskUpdated?.();
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'Error al actualizar';
 toast.error('Error', msg);
 }
 };

 const handleStatusChange = (newStatus: string) => {
 if (!task) return;
 if (newStatus === 'DONE') {
 toast.error('Acción no permitida', 'La tarea debe ser aprobada explícitamente desde Testing. No se puede cambiar a Completada directamente.');
 return;
 }
 patchTask({ status: newStatus });
 };

 const saveTitle = async () => {
 if (titleDraft.trim() && titleDraft !== task?.title) await patchTask({ title: titleDraft });
 setEditTitle(false);
 };

 const saveDesc = async () => {
 if (descDraft !== (task?.description || '')) await patchTask({ description: descDraft });
 setEditDesc(false);
 };

 const handleCreateSubtask = async () => {
 if (!newSubtask.trim() || !taskId) return;
 try {
 await api.post(`/tasks/${taskId}/subtasks`, { title: newSubtask.trim() });
 setNewSubtask('');
 loadTask();
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'Error al crear subtarea';
 toast.error('Error', msg);
 }
 };

 const handleAddComment = async () => {
 if (!newComment.trim() || !taskId) return;
 try {
 await api.post(`/tasks/${taskId}/comments`, { content: newComment.trim() });
 setNewComment('');
 loadComments();
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'Error al comentar';
 toast.error('Error', msg);
 }
 };

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file || !taskId) return;
 try {
 const fd = new FormData();
 fd.append('file', file);
 fd.append('taskId', taskId);
 await api.upload(`/files`, fd);
 loadTask();
 toast.success('Archivo subido');
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'Error al subir archivo';
 toast.error('Error', msg);
 }
 };

 const priorityOpt = task ? PRIORITY_OPTIONS.find((p) => p.value === task.priority) : null;
 const completedSubs = (task?.subTasks || []).filter((s: any) => s.status === 'DONE').length;
 const totalSubs = (task?.subTasks || []).length;
 const totalSeconds = task?.totalDuration || 0;
 const totalHours = Math.floor(totalSeconds / 3600);
 const totalMins = Math.floor((totalSeconds % 3600) / 60);

 // Reset selected subtask when task changes
 useEffect(() => {
 setSelectedSubtask(null);
 }, [taskId]);

 return (
 <Sheet open={open} onOpenChange={onOpenChange}>
 <SheetContent side="right"className="w-full sm:max-w-[540px] p-0 flex flex-col">
 {loading || !task ? (
 <div className="p-6 space-y-4">
 <Skeleton className="h-6 w-3/4"/>
 <Skeleton className="h-4 w-1/2"/>
 <Skeleton className="h-32 w-full rounded-xl"/>
 <Skeleton className="h-20 w-full rounded-xl"/>
 </div>
 ) : (
 <>
 {/* Header */}
 <div className="px-6 pt-6 pb-3">
 <SheetHeader>
 <div className="flex items-center gap-2 mb-2 pr-6">
 <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[task.status]}`} />
 <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
 {STATUS_OPTIONS.find((s) => s.value === task.status)?.label}
 </span>
 <Badge className={`text-[10px] ${priorityOpt?.color || 'bg-muted text-muted-foreground'}`}>
 {priorityOpt?.label || task.priority}
 </Badge>
 </div>

 {/* Editable title */}
 {editTitle ? (
 <Input
 autoFocus
 value={titleDraft}
 onChange={(e) => setTitleDraft(e.target.value)}
 onBlur={saveTitle}
 onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
 className="text-lg font-semibold border-none px-0 focus-visible:ring-0 shadow-none"
 />
 ) : (
 <SheetTitle
 onClick={() => setEditTitle(true)}
 className="cursor-text hover:bg-muted rounded-lg px-1 -mx-1 py-0.5 transition-colors text-left"
 >
 {task.title}
 </SheetTitle>
 )}
 {(task as any).type === 'SUPPORT' && (
 <Badge className="bg-warning/15 text-warning text-[10px] w-fit">Soporte</Badge>
 )}

 {/* Editable description */}
 {editDesc ? (
 <Textarea
 autoFocus
 value={descDraft}
 onChange={(e) => setDescDraft(e.target.value)}
 onBlur={saveDesc}
 rows={3}
 className="border-none px-0 focus-visible:ring-0 resize-none shadow-none text-sm"
 placeholder="Agregar descripción..."
 />
 ) : (
 <SheetDescription
 onClick={() => setEditDesc(true)}
 className="cursor-text hover:bg-muted rounded-lg px-1 -mx-1 py-0.5 transition-colors text-left min-h-[1.5rem]"
 >
 {task.description || 'Haz clic para agregar descripción...'}
 </SheetDescription>
 )}
 </SheetHeader>

 {/* Link to full page */}
 <Link
 href={`/projects/${projectId}/tasks/${taskId}`}
 className="inline-flex items-center gap-1 mt-2 text-[11px] text-primary hover:underline"
 >
 <ExternalLink className="h-3 w-3"/> Ver página completa
 </Link>
 </div>

 {/* Tab navigation */}
 <div className="flex border-b border-border px-6">
 {(['details', 'subtasks', 'comments', 'activity'] as const).map((t) => (
 <button
 key={t}
 onClick={() => setTab(t)}
 className={`pb-2.5 px-3 text-xs font-medium transition-colors ${
 tab === t
 ? 'text-foreground border-b-2 border-borderborder-primary'
 : 'text-muted-foreground hover:text-muted-foreground'
 }`}
 >
 {t === 'details' && 'Detalles'}
 {t === 'subtasks' && `Subtareas${totalSubs > 0 ? ` (${completedSubs}/${totalSubs})` : ''}`}
 {t === 'comments' && `Comentarios${comments.length > 0 ? ` (${comments.length})` : ''}`}
 {t === 'activity' && 'Actividad'}
 </button>
 ))}
 </div>

 {/* Tab content */}
 <ScrollArea className="flex-1">
 <div className="px-6 py-4">
 {tab === 'details' && (
 <div className="space-y-4">
 {/* Status & Priority */}
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground text-xs">Estado</span>
 <Select value={task.status} onValueChange={handleStatusChange}>
 <SelectTrigger className="h-7 w-36 text-xs border-none shadow-none">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {STATUS_OPTIONS.filter((s) => s.value !== 'DONE').map((s) => (
 <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
 ))}
 <div className="px-2 py-1.5 text-xs text-muted-foreground cursor-not-allowed flex items-center gap-1.5">
 <Lock className="h-3 w-3"/> Completada — requiere aprobación
 </div>
 </SelectContent>
 </Select>
 </div>
 <Separator />

 <div className="flex items-center justify-between">
 <span className="text-muted-foreground text-xs">Prioridad</span>
 <Select value={task.priority} onValueChange={(v) => patchTask({ priority: v })}>
 <SelectTrigger className="h-7 w-36 text-xs border-none shadow-none">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {PRIORITY_OPTIONS.map((p) => (
 <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <Separator />

 {/* Type */}
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground text-xs">Tipo</span>
 <Select value={task.type ?? 'PROJECT'} onValueChange={(v) => patchTask({ type: v })}>
 <SelectTrigger className="h-7 w-36 text-xs border-none shadow-none">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {TASK_TYPE_OPTIONS.map((t) => (
 <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <Separator />

 {/* Assignees */}
 <div className="flex items-center justify-between">
 <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
 <User className="h-3 w-3"/> Asignados
 </span>
 <div className="flex -space-x-1">
 {(task.assignments || []).map((a: any) => (
 <Avatar key={a.user?.id} className="h-6 w-6 border-2 border-white">
 <AvatarImage src={a.user?.image} />
 <AvatarFallback className="text-[8px] bg-primary/15 text-primary">
 {getInitials(a.user?.name || '')}
 </AvatarFallback>
 </Avatar>
 ))}
 {(!task.assignments || task.assignments.length === 0) && (
 <span className="text-xs text-muted-foreground">Ninguno</span>
 )}
 </div>
 </div>
 <Separator />

 {/* Dates */}
 <div className="flex items-center justify-between">
 <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
 <Calendar className="h-3 w-3"/> Fecha límite
 </span>
 <span className="text-xs text-foreground">
 {task.dueDate ? formatDate(task.dueDate) : '—'}
 </span>
 </div>
 {task.startDate && (
 <>
 <Separator />
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground text-xs">Fecha inicio</span>
 <span className="text-xs text-foreground">{formatDate(task.startDate)}</span>
 </div>
 </>
 )}
 <Separator />

 {/* Estimated hours */}
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground text-xs">Horas estimadas</span>
 <span className="text-xs text-foreground">
 {task.estimatedHours ? `${task.estimatedHours}h` : '—'}
 </span>
 </div>
 <Separator />

 {/* Labels */}
 <div>
 <span className="flex items-center gap-1.5 text-muted-foreground text-xs mb-2">
 <Tag className="h-3 w-3"/> Etiquetas
 </span>
 <LabelSelector
 taskId={task.id}
 currentLabels={task.taskLabels || []}
 onLabelsChanged={loadTask}
 />
 </div>
 <Separator />

 {/* Sprint */}
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground text-xs">Sprint</span>
 <span className="text-xs text-foreground">{task.sprint?.name || '—'}</span>
 </div>
 <Separator />

 {/* Board Column */}
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground text-xs">Columna</span>
 <span className="text-xs text-foreground">
 {task.boardColumn?.name || 'Sin asignar'}
 </span>
 </div>
 <Separator />

 {/* Role */}
 <div className="flex items-center justify-between">
 <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
 <Shield className="h-3 w-3"/> Rol destino
 </span>
 {task.role ? (
 <Badge className="bg-info/10 text-info text-[10px]">
 {task.role.name}
 </Badge>
 ) : (
 <span className="text-xs text-muted-foreground">Sin rol</span>
 )}
 </div>
 <Separator />

 {/* Client Visibility */}
 <div className="flex items-center justify-between">
 <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
 <Eye className="h-3 w-3"/> Visible al cliente
 </span>
 <button
 onClick={() => patchTask({ clientVisible: !task.clientVisible })}
 className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
 task.clientVisible
 ? 'bg-success/10 text-success'
 : 'bg-muted text-muted-foreground'
 }`}
 >
 {task.clientVisible ? <Eye className="h-3 w-3"/> : <EyeOff className="h-3 w-3"/>}
 {task.clientVisible ? 'Visible' : 'Oculta'}
 </button>
 </div>
 </div>

 {/* Review attempts with rejection reasons */}
 {task.reviewAttempts > 0 && (
 <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-3 space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-xs font-medium text-destructive">Rechazos</span>
 <div className="flex items-center gap-2">
 <Badge variant="destructive" className="text-[10px]">{task.reviewAttempts}</Badge>
 <button
 onClick={() => setShowRejections(!showRejections)}
 className="text-[10px] text-primary hover:underline"
 >
 {showRejections ? 'Ocultar' : 'Ver motivos'}
 </button>
 </div>
 </div>
 {showRejections && (
 <div className="space-y-1.5">
 {comments.filter((c: any) => c.isSystem && c.content?.startsWith('Tarea rechazada')).length > 0 ? (
 comments.filter((c: any) => c.isSystem && c.content?.startsWith('Tarea rechazada')).map((c: any) => (
 <div key={c.id} className="rounded-lg bg-background p-2">
 <p className="text-[11px] text-foreground">{c.content.replace('Tarea rechazada: ', '').replace('Tarea rechazada (sin motivo)', 'Sin motivo especificado')}</p>
 <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelative(c.createdAt)}</p>
 </div>
 ))
 ) : (
 <p className="text-[11px] text-muted-foreground italic">Sin motivos registrados</p>
 )}
 </div>
 )}
 </div>
 )}

 {/* Time summary */}
 <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 space-y-2">
 <div className="flex items-center justify-between">
 <span className="text-xs font-medium text-primary flex items-center gap-1.5">
 <Clock className="h-3 w-3"/> Tiempo
 </span>
 </div>
 <div className="grid grid-cols-2 gap-2">
 <div>
 <p className="text-[10px] text-muted-foreground">Estimadas</p>
 <p className="text-sm font-bold text-foreground">{task.estimatedHours || 0}h</p>
 </div>
 <div>
 <p className="text-[10px] text-muted-foreground">Registradas</p>
 <p className="text-sm font-bold text-foreground">{totalHours}h {totalMins}m</p>
 </div>
 </div>
 </div>

 {/* Files */}
 <div className="rounded-xl border border-border p-3">
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
 <Paperclip className="h-3 w-3"/> Archivos
 {(task.files || []).length > 0 && (
 <Badge className="bg-primary/10 text-primary text-[9px] px-1.5">
 {task.files.length}
 </Badge>
 )}
 </span>
 <label className="cursor-pointer">
 <input type="file"className="hidden"onChange={handleFileUpload} />
 <div className="flex items-center gap-1 text-[11px] text-primary hover:text-primary font-medium">
 <Upload className="h-3 w-3"/> Subir
 </div>
 </label>
 </div>
 {(task.files || []).length > 0 ? (
 <div className="space-y-1">
 {task.files.map((f: any) => {
 const Icon = f.mimeType?.startsWith('image/') ? Image : f.mimeType?.includes('pdf') ? FileText : FileIcon;
 return (
 <div key={f.id} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-muted">
 <Icon className="h-3 w-3 text-muted-foreground shrink-0"/>
 <span className="flex-1 truncate text-[11px] text-muted-foreground">{f.originalName || f.name}</span>
 <button
 onClick={async () => {
 try {
 const res = await api.get(`/files/${f.id}/download`);
 const url = res.data?.url || res.data;
 if (url) window.open(url as string, '_blank');
 } catch {
 toast.error('Error', 'No se pudo descargar');
 }
 }}
 className="text-primary hover:text-primary p-0.5 rounded"
 >
 <Download className="h-3 w-3"/>
 </button>
 </div>
 );
 })}
 </div>
 ) : (
 <p className="text-[11px] text-muted-foreground text-center py-2">Sin archivos</p>
 )}
 </div>
 </div>
 )}

 {tab === 'subtasks' && (
 <div className="space-y-3">
 {/* Progress */}
 {totalSubs > 0 && (
 <div>
 <div className="flex items-center justify-between mb-1.5">
 <span className="text-xs text-muted-foreground">{completedSubs}/{totalSubs} completadas</span>
 <span className="text-xs text-muted-foreground">
 {totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0}%
 </span>
 </div>
 <div className="h-1.5 w-full rounded-full bg-muted">
 <div
 className="h-full rounded-full bg-success transition-all"
 style={{ width: `${totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0}%` }}
 />
 </div>
 </div>
 )}

 {/* Subtask list */}
 {!selectedSubtask ? (
 <>
 <div className="space-y-1.5">
 {(task.subTasks || []).map((sub: any) => (
 <button
 key={sub.id}
 onClick={() => setSelectedSubtask(sub)}
 className="flex w-full items-center gap-2 sm:gap-2.5 rounded-xl border border-border p-2 sm:p-2.5 hover:bg-primary/10 hover:border-primary/30 transition-colors text-left"
 >
 <CheckCircle2
 className={`h-4 w-4 shrink-0 ${
 sub.status === 'DONE' ? 'text-success' : 'text-muted-foreground/50'
 }`}
 />
 <span
 className={`flex-1 text-xs sm:text-sm truncate ${
 sub.status === 'DONE' ? 'text-muted-foreground line-through' : 'text-foreground'
 }`}
 >
 {sub.title}
 </span>
 <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50"/>
 </button>
 ))}
 </div>

 {totalSubs === 0 && (
 <p className="text-xs text-muted-foreground text-center py-6">No hay subtareas</p>
 )}
 </>
 ) : (
 <SubtaskDetail
 subtask={selectedSubtask}
 projectId={projectId}
 onBack={() => { setSelectedSubtask(null); loadTask(); }}
 onUpdated={loadTask}
 />
 )}

 {/* New subtask */}
 {!selectedSubtask && (
 <div className="flex gap-2 pt-1">
 <Input
 placeholder="Nueva subtarea..."
 value={newSubtask}
 onChange={(e) => setNewSubtask(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handleCreateSubtask()}
 className="h-8 rounded-full text-xs min-w-0 flex-1"
 />
 <Button
 size="sm"
 className="rounded-full h-8 px-3 shrink-0"
 onClick={handleCreateSubtask}
 disabled={!newSubtask.trim()}
 >
 <Plus className="h-3 w-3"/>
 </Button>
 </div>
 )}
 </div>
 )}

 {tab === 'activity' && task && (
 <ActivityFeed
 endpoint={`/tasks/${task.id}/activity`}
 emptyMessage="No hay actividad registrada"
 maxItems={20}
 />
 )}

 {tab === 'comments' && (
 <div className="space-y-3">
 {comments.length > 0 ? (
 <div className="space-y-3">
 {comments.map((c: any) => (
 <div key={c.id} className="flex gap-2.5">
 <Avatar className="h-6 w-6 shrink-0">
 <AvatarImage src={c.user?.image} />
 <AvatarFallback className="text-[8px]">{c.user?.name?.charAt(0)}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="text-xs font-medium text-foreground">{c.user?.name}</span>
 <span className="text-[10px] text-muted-foreground">{formatRelative(c.createdAt)}</span>
 </div>
 <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{c.content}</p>
 {/* Replies */}
 {(c.replies || []).length > 0 && (
 <div className="mt-2 ml-3 space-y-2 border-l-2 border-border pl-2.5">
 {c.replies.map((r: any) => (
 <div key={r.id} className="flex gap-2">
 <Avatar className="h-5 w-5 shrink-0">
 <AvatarImage src={r.user?.image} />
 <AvatarFallback className="text-[7px]">{r.user?.name?.charAt(0)}</AvatarFallback>
 </Avatar>
 <div>
 <span className="text-[10px] font-medium text-foreground">{r.user?.name}</span>
 <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{r.content}</p>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 ) : (
 <p className="text-xs text-muted-foreground text-center py-8">No hay comentarios aún</p>
 )}

 {/* New comment */}
 <div className="flex gap-2 pt-2 border-t border-border">
 <Input
 placeholder="Escribe un comentario..."
 value={newComment}
 onChange={(e) => setNewComment(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
 className="h-8 rounded-full text-xs"
 />
 <Button
 size="sm"
 className="rounded-full h-8 px-3"
 onClick={handleAddComment}
 disabled={!newComment.trim()}
 >
 <Send className="h-3 w-3"/>
 </Button>
 </div>
 </div>
 )}
 </div>
 </ScrollArea>
 </>
 )}
 </SheetContent>
 </Sheet>
 );
}

// ============================================
// Subtask Detail — inline within the task sheet
// ============================================

function SubtaskDetail({
 subtask,
 projectId,
 onBack,
 onUpdated,
}: {
 subtask: any;
 projectId: string;
 onBack: () => void;
 onUpdated: () => void;
}) {
 const [data, setData] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [editTitle, setEditTitle] = useState(false);
 const [titleDraft, setTitleDraft] = useState('');
 const [editDesc, setEditDesc] = useState(false);
 const [descDraft, setDescDraft] = useState('');

 useEffect(() => {
 setLoading(true);
 api.get(`/tasks/${subtask.id}`)
 .then((res) => {
 setData(res.data);
 setTitleDraft(res.data.title || '');
 setDescDraft(res.data.description || '');
 })
 .catch(() => toast.error('Error', 'No se pudo cargar la subtarea'))
 .finally(() => setLoading(false));
 }, [subtask.id]);

 const patchSubtask = async (payload: Record<string, unknown>) => {
 try {
 const res = await api.patch(`/tasks/${subtask.id}`, payload);
 setData(res.data);
 onUpdated();
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'Error al actualizar';
 toast.error('Error', msg);
 }
 };

 if (loading || !data) {
 return (
 <div className="space-y-3">
 <Skeleton className="h-6 w-3/4"/>
 <Skeleton className="h-4 w-1/2"/>
 <Skeleton className="h-20 w-full rounded-xl"/>
 </div>
 );
 }

 const statusOpt = STATUS_OPTIONS.find((s) => s.value === data.status);
 const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === data.priority);

 return (
 <div className="space-y-4">
 {/* Back button */}
 <button
 onClick={onBack}
 className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
 >
 <ChevronRight className="h-3 w-3 rotate-180"/> Volver a subtareas
 </button>

 {/* Title */}
 <div className="rounded-xl border border-border p-3 sm:p-4">
 {editTitle ? (
 <Input
 autoFocus
 value={titleDraft}
 onChange={(e) => setTitleDraft(e.target.value)}
 onBlur={() => { if (titleDraft.trim() && titleDraft !== data.title) patchSubtask({ title: titleDraft }); setEditTitle(false); }}
 onKeyDown={(e) => { if (e.key === 'Enter') { if (titleDraft.trim() && titleDraft !== data.title) patchSubtask({ title: titleDraft }); setEditTitle(false); }}}
 className="text-sm sm:text-base font-semibold border-none px-0 focus-visible:ring-0 shadow-none"
 />
 ) : (
 <h3
 onClick={() => setEditTitle(true)}
 className="text-sm sm:text-base font-semibold text-foreground cursor-text hover:bg-muted rounded-lg px-1 -mx-1 py-0.5 transition-colors break-words"
 >
 {data.title}
 </h3>
 )}

 {editDesc ? (
 <Textarea
 autoFocus
 value={descDraft}
 onChange={(e) => setDescDraft(e.target.value)}
 onBlur={() => { if (descDraft !== (data.description || '')) patchSubtask({ description: descDraft }); setEditDesc(false); }}
 rows={3}
 className="border-none px-0 focus-visible:ring-0 resize-none shadow-none text-xs sm:text-sm mt-2"
 placeholder="Agregar descripción..."
 />
 ) : (
 <p
 onClick={() => setEditDesc(true)}
 className="text-xs sm:text-sm text-muted-foreground mt-1 cursor-text hover:bg-muted rounded-lg px-1 -mx-1 py-0.5 transition-colors min-h-[1.5rem] break-words"
 >
 {data.description || 'Haz clic para agregar descripción...'}
 </p>
 )}
 </div>

 {/* Status & Priority */}
 <div className="space-y-2.5 sm:space-y-3">
 <div className="flex items-center justify-between gap-2">
 <span className="text-muted-foreground text-[11px] sm:text-xs shrink-0">Estado</span>
 <Select value={data.status} onValueChange={(v) => {
 if (v === 'DONE') { toast.error('Acción no permitida', 'La subtarea debe ser aprobada.'); return; }
 patchSubtask({ status: v });
 }}>
 <SelectTrigger className="h-7 w-28 sm:w-36 text-[11px] sm:text-xs border-none shadow-none">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {STATUS_OPTIONS.filter((s) => s.value !== 'DONE').map((s) => (
 <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
 ))}
 <div className="px-2 py-1.5 text-xs text-muted-foreground cursor-not-allowed flex items-center gap-1.5">
 <Lock className="h-3 w-3"/> Completada — requiere aprobación
 </div>
 </SelectContent>
 </Select>
 </div>

 <Separator />

 <div className="flex items-center justify-between gap-2">
 <span className="text-muted-foreground text-[11px] sm:text-xs shrink-0">Prioridad</span>
 <Select value={data.priority} onValueChange={(v) => patchSubtask({ priority: v })}>
 <SelectTrigger className="h-7 w-28 sm:w-36 text-[11px] sm:text-xs border-none shadow-none">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {PRIORITY_OPTIONS.map((p) => (
 <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 <Separator />

 {/* Assignees */}
 <div className="flex items-center justify-between gap-2">
 <span className="flex items-center gap-1 sm:gap-1.5 text-muted-foreground text-[11px] sm:text-xs shrink-0">
 <User className="h-3 w-3"/> Asignados
 </span>
 <div className="flex -space-x-1 flex-wrap justify-end">
 {(data.assignments || []).map((a: any) => (
 <Avatar key={a.user?.id} className="h-5 w-5 sm:h-6 sm:w-6 border-2 border-white">
 <AvatarImage src={a.user?.image} />
 <AvatarFallback className="text-[7px] sm:text-[8px] bg-primary/15 text-primary">
 {getInitials(a.user?.name || '')}
 </AvatarFallback>
 </Avatar>
 ))}
 {(!data.assignments || data.assignments.length === 0) && (
 <span className="text-[11px] sm:text-xs text-muted-foreground">Ninguno</span>
 )}
 </div>
 </div>

 <Separator />

 {/* Dates */}
 <div className="flex items-center justify-between gap-2">
 <span className="flex items-center gap-1 sm:gap-1.5 text-muted-foreground text-[11px] sm:text-xs shrink-0">
 <Calendar className="h-3 w-3"/> Fecha límite
 </span>
 <span className="text-[11px] sm:text-xs text-foreground">
 {data.dueDate ? formatDate(data.dueDate) : '—'}
 </span>
 </div>
 </div>

 </div>
 );
}
