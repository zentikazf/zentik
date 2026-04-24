'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { TimerWidget } from '@/components/timer/timer-widget';
import { ActivityFeed } from '@/components/activity/activity-feed';
import {
 ArrowLeft, Calendar, Tag, User, Clock, CheckCircle2, Paperclip,
 Download, File as FileIcon, Image, FileText, Plus, Send, MessageSquare,
 Upload, Shield, Eye, EyeOff, AlertTriangle,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatDate, formatRelative, getInitials, cn } from '@/lib/utils';

// ── Constant maps ──────────────────────────────────────────────────
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

// ── Component ──────────────────────────────────────────────────────
export default function TaskDetailPage() {
 const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
 const router = useRouter();

 const [task, setTask] = useState<any>(null);
 const [loading, setLoading] = useState(true);

 // Inline edit
 const [editTitle, setEditTitle] = useState(false);
 const [editDesc, setEditDesc] = useState(false);
 const [titleDraft, setTitleDraft] = useState('');
 const [descDraft, setDescDraft] = useState('');

 // Horas estimadas: draft local + guardado explicito
 const [hoursDraft, setHoursDraft] = useState<string>('');
 const [savingHours, setSavingHours] = useState(false);

 // Comments
 const [comments, setComments] = useState<any[]>([]);
 const [newComment, setNewComment] = useState('');
 const [loadingComments, setLoadingComments] = useState(false);

 // Subtasks
 const [newSubtask, setNewSubtask] = useState('');

 // Tab: 'comments' | 'activity'
 const [tab, setTab] = useState<'comments' | 'activity'>('comments');
 const [showRejections, setShowRejections] = useState(false);
 const [confirmDelete, setConfirmDelete] = useState(false);

 // Project members for assignee picker
 const [projectMembers, setProjectMembers] = useState<any[]>([]);
 // Available client hours
 const [clientHours, setClientHours] = useState<{ availableHours: number; clientName: string; contractedHours: number; usedHours: number } | null>(null);

 // ── Load task ─────────────────────────────────────────────────
 const loadTask = useCallback(async () => {
 try {
 const res = await api.get(`/tasks/${taskId}`);
 setTask(res.data);
 setTitleDraft(res.data.title || '');
 setDescDraft(res.data.description || '');
 setHoursDraft(
 res.data.estimatedHours !== null && res.data.estimatedHours !== undefined
 ? String(res.data.estimatedHours)
 : '',
 );
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'Error al cargar la tarea';
 toast.error('Error', msg);
 } finally {
 setLoading(false);
 }
 }, [taskId]);

 // ── Load comments ─────────────────────────────────────────────
 const loadComments = useCallback(async () => {
 setLoadingComments(true);
 try {
 const res = await api.get(`/tasks/${taskId}/comments`);
 const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
 setComments(list);
 } catch {
 /* silent */
 } finally {
 setLoadingComments(false);
 }
 }, [taskId]);

 useEffect(() => { loadTask(); loadComments(); }, [loadTask, loadComments]);

 useEffect(() => {
  if (projectId) {
   api.get(`/projects/${projectId}/members`).then((res) => {
    const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
    setProjectMembers(list);
   }).catch(() => {});
   api.get(`/projects/${projectId}/available-hours`).then((res) => {
    if (res.data) setClientHours(res.data);
   }).catch(() => {});
  }
 }, [projectId]);

 // ── Patch helper ──────────────────────────────────────────────
 const patchTask = async (data: Record<string, unknown>) => {
 try {
 const res = await api.patch(`/tasks/${taskId}`, data);
 setTask(res.data);
 toast.success('Tarea actualizada');
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'Error al actualizar';
 toast.error('Error', msg);
 }
 };

 // ── Save inline title / description ───────────────────────────
 const saveTitle = async () => {
 if (titleDraft.trim() && titleDraft !== task.title) await patchTask({ title: titleDraft });
 setEditTitle(false);
 };
 const saveDesc = async () => {
 if (descDraft !== task.description) await patchTask({ description: descDraft });
 setEditDesc(false);
 };

 // ── Save estimated hours (manual, con boton) ──────────────────
 const saveHours = async () => {
 const current = task?.estimatedHours ?? null;
 const parsed = hoursDraft.trim() === '' ? null : Number(hoursDraft);
 if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) {
 toast.error('Error', 'Ingresá un número válido de horas');
 return;
 }
 if (parsed === current) return;
 setSavingHours(true);
 try {
 await patchTask({ estimatedHours: parsed ?? 0 });
 } finally {
 setSavingHours(false);
 }
 };

 const resetHours = () => {
 setHoursDraft(
 task?.estimatedHours !== null && task?.estimatedHours !== undefined
 ? String(task.estimatedHours)
 : '',
 );
 };

 const hoursDirty =
 hoursDraft.trim() !==
 (task?.estimatedHours !== null && task?.estimatedHours !== undefined
 ? String(task.estimatedHours)
 : '');

 // ── Create subtask ────────────────────────────────────────────
 const handleCreateSubtask = async () => {
 if (!newSubtask.trim()) return;
 try {
 await api.post(`/tasks/${taskId}/subtasks`, { title: newSubtask.trim() });
 setNewSubtask('');
 loadTask();
 toast.success('Subtarea creada');
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'Error al crear subtarea';
 toast.error('Error', msg);
 }
 };

 // ── Add comment ───────────────────────────────────────────────
 const handleAddComment = async () => {
 if (!newComment.trim()) return;
 try {
 await api.post(`/tasks/${taskId}/comments`, { content: newComment.trim() });
 setNewComment('');
 loadComments();
 } catch (err) {
 const msg = err instanceof ApiError ? err.message : 'Error al comentar';
 toast.error('Error', msg);
 }
 };

 // ── Upload file ───────────────────────────────────────────────
 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
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

 // ── Loading / not found ───────────────────────────────────────
 if (loading) {
 return (
 <div className="space-y-4">
 <Skeleton className="h-8 w-64 rounded-xl"/>
 <div className="grid gap-6 lg:grid-cols-3">
 <Skeleton className="h-96 rounded-xl lg:col-span-2"/>
 <Skeleton className="h-96 rounded-xl"/>
 </div>
 </div>
 );
 }

 if (!task) return <div className="py-12 text-center text-muted-foreground">Tarea no encontrada</div>;

 const priorityOpt = PRIORITY_OPTIONS.find((p) => p.value === task.priority);
 const completedSubs = (task.subTasks || []).filter((s: any) => s.status === 'DONE').length;
 const totalSubs = (task.subTasks || []).length;
 const totalSeconds = task.totalDuration || 0;
 const totalHours = Math.floor(totalSeconds / 3600);
 const totalMins = Math.floor((totalSeconds % 3600) / 60);

 return (
 <div className="mx-auto max-w-6xl space-y-5">
 {/* ── Header ─────────────────────────────────────────── */}
 <div className="flex items-center gap-4">
 <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground transition-colors hover:bg-muted">
 <ArrowLeft className="h-4 w-4"/>
 </button>
 <div className="flex items-center gap-2">
 <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[task.status]}`} />
 <span className="text-xs text-muted-foreground">{STATUS_OPTIONS.find(s => s.value === task.status)?.label || task.status}</span>
 <Badge className={priorityOpt?.color || 'bg-muted text-muted-foreground'}>{priorityOpt?.label || task.priority}</Badge>
 </div>
 </div>

 {/* ── Main Grid ──────────────────────────────────────── */}
 <div className="grid gap-6 lg:grid-cols-3">
 {/* ── LEFT PANEL ──────────────────────────────────── */}
 <div className="space-y-5 lg:col-span-2">
 {/* Title & Description */}
 <div className="rounded-xl border border-border bg-card p-6">
 {editTitle ? (
 <Input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => e.key === 'Enter' && saveTitle()} className="text-xl font-semibold border-none px-0 focus-visible:ring-0"/>
 ) : (
 <h1 onClick={() => setEditTitle(true)} className="text-xl font-semibold text-foreground cursor-text hover:bg-muted/50 rounded-lg px-1 -mx-1 py-0.5 transition-colors">{task.title}</h1>
 )}

 <Separator className="my-4"/>

 {editDesc ? (
 <Textarea autoFocus value={descDraft} onChange={(e) => setDescDraft(e.target.value)} onBlur={saveDesc} rows={6} className="border-none px-0 focus-visible:ring-0 resize-none"placeholder="Agregar descripción..."/>
 ) : (
 <p onClick={() => setEditDesc(true)} className="whitespace-pre-wrap text-sm text-muted-foreground cursor-text hover:bg-muted/50 rounded-lg px-1 -mx-1 py-1 transition-colors min-h-[3rem]">{task.description || 'Haz clic para agregar una descripción...'}</p>
 )}
 </div>

 {/* Subtasks */}
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-[15px] font-semibold text-foreground">Subtareas</h2>
 {totalSubs > 0 && (
 <span className="text-xs text-muted-foreground">{completedSubs}/{totalSubs} completadas</span>
 )}
 </div>

 {totalSubs > 0 && (
 <div className="mb-3 h-1.5 w-full rounded-full bg-muted">
 <div className="h-full rounded-full bg-success transition-all"style={{ width: `${totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0}%` }} />
 </div>
 )}

 <div className="space-y-2">
 {(task.subTasks || []).map((sub: any) => (
 <div key={sub.id} className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/50 transition-colors"onClick={() => router.push(`/projects/${projectId}/tasks/${sub.id}`)}>
 <CheckCircle2 className={`h-4 w-4 shrink-0 ${sub.status === 'DONE' ? 'text-success' : 'text-muted-foreground/50'}`} />
 <span className={`flex-1 text-sm ${sub.status === 'DONE' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{sub.title}</span>
 <div className="flex -space-x-1">
 {(sub.assignments || []).slice(0, 2).map((a: any) => (
 <Avatar key={a.user?.id} className="h-5 w-5 border border-white">
 <AvatarImage src={a.user?.image} />
 <AvatarFallback className="text-[8px]">{a.user?.name?.charAt(0)}</AvatarFallback>
 </Avatar>
 ))}
 </div>
 </div>
 ))}
 </div>

 <div className="mt-3 flex gap-2">
 <Input placeholder="Nueva subtarea..."value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateSubtask()} className="h-9 rounded-full text-sm"/>
 <Button size="sm"className="rounded-full h-9 px-3"onClick={handleCreateSubtask} disabled={!newSubtask.trim()}>
 <Plus className="h-3.5 w-3.5"/>
 </Button>
 </div>
 </div>

 {/* Comments / Activity Tabs */}
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex gap-4 mb-4 border-b border-border">
 <button onClick={() => setTab('comments')} className={`pb-2.5 text-sm font-medium transition-colors ${tab === 'comments' ? 'text-foreground border-b-2 border-borderborder-primary' : 'text-muted-foreground hover:text-muted-foreground'}`}>
 <MessageSquare className="inline h-3.5 w-3.5 mr-1.5"/>Comentarios
 </button>
 <button onClick={() => setTab('activity')} className={`pb-2.5 text-sm font-medium transition-colors ${tab === 'activity' ? 'text-foreground border-b-2 border-borderborder-primary' : 'text-muted-foreground hover:text-muted-foreground'}`}>
 <Clock className="inline h-3.5 w-3.5 mr-1.5"/>Actividad
 </button>
 </div>

 {tab === 'comments' ? (
 <div className="space-y-4">
 {loadingComments ? <Skeleton className="h-16 rounded-xl"/> : comments.length > 0 ? (
 <ScrollArea className="max-h-80">
 <div className="space-y-3 pr-2">
 {comments.map((c: any) => (
 <div key={c.id} className="flex gap-3">
 <Avatar className="h-7 w-7 shrink-0">
 <AvatarImage src={c.user?.image} />
 <AvatarFallback className="text-[9px]">{c.user?.name?.charAt(0)}</AvatarFallback>
 </Avatar>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2">
 <span className="text-xs font-medium text-foreground">{c.user?.name}</span>
 <span className="text-[10px] text-muted-foreground">{formatRelative(c.createdAt)}</span>
 {c.editedAt && <span className="text-[10px] text-muted-foreground italic">(editado)</span>}
 </div>
 <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{c.content}</p>
 {/* Replies */}
 {(c.replies || []).length > 0 && (
 <div className="mt-2 ml-4 space-y-2 border-l-2 border-border pl-3">
 {c.replies.map((r: any) => (
 <div key={r.id} className="flex gap-2">
 <Avatar className="h-5 w-5 shrink-0">
 <AvatarImage src={r.user?.image} />
 <AvatarFallback className="text-[8px]">{r.user?.name?.charAt(0)}</AvatarFallback>
 </Avatar>
 <div>
 <span className="text-[11px] font-medium text-foreground">{r.user?.name}</span>
 <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.content}</p>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 </ScrollArea>
 ) : (
 <p className="text-xs text-muted-foreground text-center py-6">No hay comentarios aún</p>
 )}

 {/* New comment input */}
 <div className="flex gap-2 pt-2 border-t border-border">
 <Input placeholder="Escribe un comentario..."value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()} className="h-9 rounded-full text-sm"/>
 <Button size="sm"className="rounded-full h-9 px-3"onClick={handleAddComment} disabled={!newComment.trim()}>
 <Send className="h-3.5 w-3.5"/>
 </Button>
 </div>
 </div>
 ) : (
 <ActivityFeed endpoint={`/tasks/${taskId}/activity`} emptyMessage="No hay actividad"maxItems={15} />
 )}
 </div>
 </div>

 {/* ── RIGHT SIDEBAR ─────────────────────────────────── */}
 <div className="space-y-4">
 {/* Timer */}
 <TimerWidget taskId={task.id} taskTitle={task.title} />

 {/* Details */}
 <div className="rounded-xl border border-border bg-card p-5">
 <h3 className="mb-4 text-[15px] font-semibold text-foreground">Detalles</h3>
 <div className="space-y-3 text-sm">
 {/* Status */}
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground text-xs">Estado</span>
 <Select value={task.status} onValueChange={(v) => patchTask({ status: v })}>
 <SelectTrigger className="h-7 w-32 text-xs border-none shadow-none">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <Separator />

 {/* Priority */}
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground text-xs">Prioridad</span>
 <Select value={task.priority} onValueChange={(v) => patchTask({ priority: v })}>
 <SelectTrigger className="h-7 w-32 text-xs border-none shadow-none">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
 </SelectContent>
 </Select>
 </div>
 <Separator />

 {/* Assignees */}
 <div>
 <span className="flex items-center gap-1.5 text-muted-foreground text-xs mb-2"><User className="h-3 w-3"/> Asignados</span>
 <div className="flex flex-wrap gap-1.5 mb-2">
 {(task.assignments || []).map((a: any) => (
 <div key={a.user?.id} className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-1">
 <Avatar className="h-5 w-5">
 <AvatarImage src={a.user?.image} />
 <AvatarFallback className="text-[8px] bg-primary/15 text-primary">{getInitials(a.user?.name || '')}</AvatarFallback>
 </Avatar>
 <span className="text-[11px] text-foreground">{a.user?.name}</span>
 <button onClick={() => patchTask({ assigneeIds: (task.assignments || []).filter((x: any) => x.user?.id !== a.user?.id).map((x: any) => x.user?.id) })} className="text-muted-foreground hover:text-destructive text-xs ml-0.5">×</button>
 </div>
 ))}
 {(!task.assignments || task.assignments.length === 0) && <span className="text-xs text-muted-foreground">Sin asignar</span>}
 </div>
 {projectMembers.length > 0 && (
 <Select value="" onValueChange={(userId) => {
 const currentIds = (task.assignments || []).map((a: any) => a.user?.id).filter(Boolean);
 if (!currentIds.includes(userId)) patchTask({ assigneeIds: [...currentIds, userId] });
 }}>
 <SelectTrigger className="h-7 text-xs">
 <SelectValue placeholder="Agregar miembro..."/>
 </SelectTrigger>
 <SelectContent>
 {projectMembers.filter((m: any) => !(task.assignments || []).some((a: any) => a.user?.id === m.userId)).map((m: any) => (
 <SelectItem key={m.userId} value={m.userId}>{m.user?.name || m.userId}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 )}
 </div>
 <Separator />

 {/* Dates */}
 <div className="flex items-center justify-between">
 <span className="flex items-center gap-1.5 text-muted-foreground text-xs"><Calendar className="h-3 w-3"/> Fecha inicio</span>
 <input type="date" value={task.startDate ? task.startDate.split('T')[0] : ''} onChange={(e) => patchTask({ startDate: e.target.value ? new Date(e.target.value).toISOString() : null })} className="h-7 w-32 rounded border border-border bg-background px-2 text-xs text-foreground"/>
 </div>
 <Separator />
 <div className="flex items-center justify-between">
 <span className="flex items-center gap-1.5 text-muted-foreground text-xs"><Calendar className="h-3 w-3"/> Fecha límite</span>
 <input type="date" value={task.dueDate ? task.dueDate.split('T')[0] : ''} onChange={(e) => patchTask({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })} className="h-7 w-32 rounded border border-border bg-background px-2 text-xs text-foreground"/>
 </div>
 <Separator />

 {/* Estimated hours */}
 <div className="space-y-1">
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground text-xs">Horas estimadas</span>
 <div className="flex items-center gap-1.5">
 <input
 type="number"
 min="0"
 step="0.5"
 value={hoursDraft}
 onChange={(e) => setHoursDraft(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') { e.preventDefault(); saveHours(); }
 if (e.key === 'Escape') { e.preventDefault(); resetHours(); }
 }}
 placeholder="—"
 className={cn(
 'h-7 w-20 rounded border bg-background px-2 text-xs text-foreground text-right transition-colors',
 hoursDirty ? 'border-warning' : 'border-border',
 )}
 />
 <Button
 size="sm"
 variant="outline"
 className="h-7 px-2 text-xs"
 disabled={!hoursDirty || savingHours}
 onClick={saveHours}
 >
 {savingHours ? 'Guardando...' : 'Guardar'}
 </Button>
 </div>
 </div>
 {task.type === 'SUPPORT' && clientHours && (
 <div className="flex items-center justify-between text-[10px]">
 <span className="text-muted-foreground">Disponibles: {clientHours.availableHours.toFixed(1)}h / {clientHours.contractedHours}h</span>
 {task.estimatedHours && task.estimatedHours > clientHours.availableHours && (
 <span className="flex items-center gap-1 text-destructive font-medium">
 <AlertTriangle className="h-3 w-3"/> Excede
 </span>
 )}
 </div>
 )}
 </div>
 <Separator />

 {/* Labels */}
 <div className="flex items-center justify-between">
 <span className="flex items-center gap-1.5 text-muted-foreground text-xs"><Tag className="h-3 w-3"/> Etiquetas</span>
 <div className="flex flex-wrap gap-1 justify-end">
 {(task.taskLabels || []).map((tl: any) => (
 <Badge key={tl.label?.id || tl.id} className="bg-muted text-[10px] text-muted-foreground"style={{ borderColor: tl.label?.color }}>{tl.label?.name}</Badge>
 ))}
 {(!task.taskLabels || task.taskLabels.length === 0) && <span className="text-xs text-muted-foreground">Ninguna</span>}
 </div>
 </div>
 <Separator />


 {/* Board Column */}
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground text-xs">Columna</span>
 <span className="text-xs text-foreground">{task.boardColumn?.name || 'Sin asignar'}</span>
 </div>
 <Separator />

 {/* Rol destino */}
 <div className="flex items-center justify-between">
 <span className="flex items-center gap-1.5 text-muted-foreground text-xs"><Shield className="h-3 w-3"/> Rol destino</span>
 {task.role ? (
 <Badge className="bg-info/10 text-info text-[10px]">{task.role.name}</Badge>
 ) : (
 <span className="text-xs text-muted-foreground">Sin rol</span>
 )}
 </div>
 <Separator />

 {/* Client visibility */}
 <div className="flex items-center justify-between">
 <span className="flex items-center gap-1.5 text-muted-foreground text-xs"><Eye className="h-3 w-3"/> Visible al cliente</span>
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
 <Separator />

 {/* Review attempts with rejection reasons */}
 {task.reviewAttempts > 0 && (
 <>
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground text-xs">Rechazos</span>
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
 <div className="mt-2 space-y-2">
 {comments.filter((c: any) => c.isSystem && c.content?.startsWith('Tarea rechazada')).length > 0 ? (
 comments.filter((c: any) => c.isSystem && c.content?.startsWith('Tarea rechazada')).map((c: any) => (
 <div key={c.id} className="rounded-lg bg-destructive/5 border border-destructive/10 p-2.5">
 <p className="text-xs text-foreground">{c.content.replace('Tarea rechazada: ', '').replace('Tarea rechazada (sin motivo)', 'Sin motivo especificado')}</p>
 <p className="text-[10px] text-muted-foreground mt-1">{formatRelative(c.createdAt)} — {c.user?.name || 'Sistema'}</p>
 </div>
 ))
 ) : (
 <p className="text-xs text-muted-foreground italic">Sin motivos registrados</p>
 )}
 </div>
 )}
 <Separator />
 </>
 )}

 {/* Created */}
 <div className="flex items-center justify-between">
 <span className="flex items-center gap-1.5 text-muted-foreground text-xs"><Clock className="h-3 w-3"/> Creada</span>
 <span className="text-xs text-foreground">{formatRelative(task.createdAt)}</span>
 </div>
 </div>
 </div>

 {/* Time Summary */}
 <div className="rounded-xl border border-border bg-card p-5">
 <h3 className="mb-2 text-[15px] font-semibold text-foreground">Tiempo Registrado</h3>
 <p className="text-2xl font-bold text-foreground">{totalHours}h {totalMins}m</p>
 {task.timeEntries && task.timeEntries.length > 0 && (
 <div className="mt-3 space-y-1.5">
 {task.timeEntries.slice(0, 5).map((entry: any) => (
 <div key={entry.id} className="flex items-center justify-between text-xs text-muted-foreground">
 <div className="flex items-center gap-1.5">
 <Avatar className="h-4 w-4">
 <AvatarImage src={entry.user?.image} />
 <AvatarFallback className="text-[7px]">{entry.user?.name?.charAt(0)}</AvatarFallback>
 </Avatar>
 <span>{entry.description || 'Sin descripción'}</span>
 </div>
 <span className="font-medium text-foreground">{entry.duration ? `${Math.floor(entry.duration / 3600)}h ${Math.floor((entry.duration % 3600) / 60)}m` : '—'}</span>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Files */}
 <div className="rounded-xl border border-border bg-card p-5">
 <div className="flex items-center justify-between mb-3">
 <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-1.5">
 <Paperclip className="h-3.5 w-3.5"/> Archivos
 {(task.files || []).length > 0 && <Badge className="bg-primary/10 text-primary text-[10px]">{task.files.length}</Badge>}
 </h3>
 <label className="cursor-pointer">
 <input type="file"className="hidden"onChange={handleFileUpload} />
 <div className="flex items-center gap-1 text-xs text-primary hover:text-primary font-medium">
 <Upload className="h-3 w-3"/> Subir
 </div>
 </label>
 </div>

 {(task.files || []).length > 0 ? (
 <div className="space-y-1.5">
 {task.files.map((f: any) => {
 const Icon = f.mimeType?.startsWith('image/') ? Image : f.mimeType?.includes('pdf') ? FileText : FileIcon;
 return (
 <div key={f.id} className="flex items-center gap-2 rounded-lg border border-border p-2">
 <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0"/>
 <span className="flex-1 truncate text-xs text-foreground">{f.originalName || f.name}</span>
 <button onClick={async () => {
 try {
 const res = await api.get(`/files/${f.id}/download`);
 const url = res.data?.url || res.data;
 if (url) window.open(url as string, '_blank');
 } catch { toast.error('Error', 'No se pudo descargar'); }
 }} className="text-primary hover:text-primary p-1 rounded">
 <Download className="h-3 w-3"/>
 </button>
 </div>
 );
 })}
 </div>
 ) : (
 <p className="text-xs text-muted-foreground text-center py-4">Sin archivos adjuntos</p>
 )}
 </div>

 {/* Delete Task */}
 <div className="rounded-xl border border-destructive/20 bg-card p-5">
 {!confirmDelete ? (
 <Button
 variant="outline"
 size="sm"
 className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
 onClick={() => setConfirmDelete(true)}
 >
 Eliminar tarea
 </Button>
 ) : (
 <div className="space-y-3">
 <p className="text-xs text-destructive font-medium">Esta accion es irreversible. Se eliminaran todos los datos asociados.</p>
 <div className="flex gap-2">
 <Button
 variant="outline"
 size="sm"
 className="flex-1"
 onClick={() => setConfirmDelete(false)}
 >
 Cancelar
 </Button>
 <Button
 variant="destructive"
 size="sm"
 className="flex-1"
 onClick={async () => {
 try {
 await api.delete(`/tasks/${taskId}`);
 toast.success('Tarea eliminada');
 router.push(`/projects/${projectId}/board`);
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'No se pudo eliminar');
 }
 }}
 >
 Confirmar
 </Button>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
