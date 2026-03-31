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
  Upload, Shield, Eye, EyeOff,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatDate, formatRelative, getInitials } from '@/lib/utils';

// ── Constant maps ──────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'TODO', label: 'Por Hacer' },
  { value: 'IN_PROGRESS', label: 'En Progreso' },
  { value: 'IN_REVIEW', label: 'En Revisión' },
  { value: 'DONE', label: 'Completada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Baja', color: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400' },
  { value: 'MEDIUM', label: 'Media', color: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400' },
  { value: 'HIGH', label: 'Alta', color: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400' },
  { value: 'URGENT', label: 'Urgente', color: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400' },
];

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: 'bg-gray-400', TODO: 'bg-blue-400', IN_PROGRESS: 'bg-yellow-400',
  IN_REVIEW: 'bg-purple-400', DONE: 'bg-green-400', CANCELLED: 'bg-red-400',
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

  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  // Subtasks
  const [newSubtask, setNewSubtask] = useState('');

  // Tab: 'comments' | 'activity'
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');

  // ── Load task ─────────────────────────────────────────────────
  const loadTask = useCallback(async () => {
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
        <Skeleton className="h-8 w-64 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-[25px] lg:col-span-2" />
          <Skeleton className="h-96 rounded-[25px]" />
        </div>
      </div>
    );
  }

  if (!task) return <div className="py-12 text-center text-gray-400">Tarea no encontrada</div>;

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
        <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[task.status]}`} />
          <span className="text-xs text-gray-500">{STATUS_OPTIONS.find(s => s.value === task.status)?.label || task.status}</span>
          <Badge className={priorityOpt?.color || 'bg-gray-100 text-gray-600'}>{priorityOpt?.label || task.priority}</Badge>
        </div>
      </div>

      {/* ── Main Grid ──────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── LEFT PANEL ──────────────────────────────────── */}
        <div className="space-y-5 lg:col-span-2">
          {/* Title & Description */}
          <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
            {editTitle ? (
              <Input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} onBlur={saveTitle} onKeyDown={(e) => e.key === 'Enter' && saveTitle()} className="text-xl font-semibold border-none px-0 focus-visible:ring-0" />
            ) : (
              <h1 onClick={() => setEditTitle(true)} className="text-xl font-semibold text-gray-800 dark:text-white cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-1 -mx-1 py-0.5 transition-colors">{task.title}</h1>
            )}

            <Separator className="my-4" />

            {editDesc ? (
              <Textarea autoFocus value={descDraft} onChange={(e) => setDescDraft(e.target.value)} onBlur={saveDesc} rows={6} className="border-none px-0 focus-visible:ring-0 resize-none" placeholder="Agregar descripción..." />
            ) : (
              <p onClick={() => setEditDesc(true)} className="whitespace-pre-wrap text-sm text-gray-500 dark:text-gray-400 cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-1 -mx-1 py-1 transition-colors min-h-[3rem]">{task.description || 'Haz clic para agregar una descripción...'}</p>
            )}
          </div>

          {/* Subtasks */}
          <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-semibold text-gray-800 dark:text-white">Subtareas</h2>
              {totalSubs > 0 && (
                <span className="text-xs text-gray-400">{completedSubs}/{totalSubs} completadas</span>
              )}
            </div>

            {totalSubs > 0 && (
              <div className="mb-3 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${totalSubs > 0 ? (completedSubs / totalSubs) * 100 : 0}%` }} />
              </div>
            )}

            <div className="space-y-2">
              {(task.subTasks || []).map((sub: any) => (
                <div key={sub.id} className="flex items-center gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" onClick={() => router.push(`/projects/${projectId}/tasks/${sub.id}`)}>
                  <CheckCircle2 className={`h-4 w-4 shrink-0 ${sub.status === 'DONE' ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
                  <span className={`flex-1 text-sm ${sub.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-white'}`}>{sub.title}</span>
                  <div className="flex -space-x-1">
                    {(sub.assignments || []).slice(0, 2).map((a: any) => (
                      <Avatar key={a.user?.id} className="h-5 w-5 border border-white dark:border-gray-900">
                        <AvatarImage src={a.user?.image} />
                        <AvatarFallback className="text-[8px]">{a.user?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <Input placeholder="Nueva subtarea..." value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateSubtask()} className="h-9 rounded-full text-sm" />
              <Button size="sm" className="rounded-full h-9 px-3" onClick={handleCreateSubtask} disabled={!newSubtask.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Comments / Activity Tabs */}
          <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
            <div className="flex gap-4 mb-4 border-b border-gray-100 dark:border-gray-800">
              <button onClick={() => setTab('comments')} className={`pb-2.5 text-sm font-medium transition-colors ${tab === 'comments' ? 'text-gray-800 dark:text-white border-b-2 border-gray-800 dark:border-white' : 'text-gray-400 hover:text-gray-600'}`}>
                <MessageSquare className="inline h-3.5 w-3.5 mr-1.5" />Comentarios
              </button>
              <button onClick={() => setTab('activity')} className={`pb-2.5 text-sm font-medium transition-colors ${tab === 'activity' ? 'text-gray-800 dark:text-white border-b-2 border-gray-800 dark:border-white' : 'text-gray-400 hover:text-gray-600'}`}>
                <Clock className="inline h-3.5 w-3.5 mr-1.5" />Actividad
              </button>
            </div>

            {tab === 'comments' ? (
              <div className="space-y-4">
                {loadingComments ? <Skeleton className="h-16 rounded-xl" /> : comments.length > 0 ? (
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
                              <span className="text-xs font-medium text-gray-800 dark:text-white">{c.user?.name}</span>
                              <span className="text-[10px] text-gray-400">{formatRelative(c.createdAt)}</span>
                              {c.editedAt && <span className="text-[10px] text-gray-400 italic">(editado)</span>}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 whitespace-pre-wrap">{c.content}</p>
                            {/* Replies */}
                            {(c.replies || []).length > 0 && (
                              <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-100 dark:border-gray-800 pl-3">
                                {c.replies.map((r: any) => (
                                  <div key={r.id} className="flex gap-2">
                                    <Avatar className="h-5 w-5 shrink-0">
                                      <AvatarImage src={r.user?.image} />
                                      <AvatarFallback className="text-[8px]">{r.user?.name?.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">{r.user?.name}</span>
                                      <p className="text-xs text-gray-500 whitespace-pre-wrap">{r.content}</p>
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
                  <p className="text-xs text-gray-400 text-center py-6">No hay comentarios aún</p>
                )}

                {/* New comment input */}
                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <Input placeholder="Escribe un comentario..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()} className="h-9 rounded-full text-sm" />
                  <Button size="sm" className="rounded-full h-9 px-3" onClick={handleAddComment} disabled={!newComment.trim()}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <ActivityFeed endpoint={`/tasks/${taskId}/activity`} emptyMessage="No hay actividad" maxItems={15} />
            )}
          </div>
        </div>

        {/* ── RIGHT SIDEBAR ─────────────────────────────────── */}
        <div className="space-y-4">
          {/* Timer */}
          <TimerWidget taskId={task.id} taskTitle={task.title} />

          {/* Details */}
          <div className="rounded-[25px] bg-white p-5 dark:bg-gray-900">
            <h3 className="mb-4 text-[15px] font-semibold text-gray-800 dark:text-white">Detalles</h3>
            <div className="space-y-3 text-sm">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Estado</span>
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
                <span className="text-gray-400 text-xs">Prioridad</span>
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
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-400 text-xs"><User className="h-3 w-3" /> Asignados</span>
                <div className="flex -space-x-1">
                  {(task.assignments || []).map((a: any) => (
                    <Avatar key={a.user?.id} className="h-6 w-6 border-2 border-white dark:border-gray-900">
                      <AvatarImage src={a.user?.image} />
                      <AvatarFallback className="text-[8px] bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">{getInitials(a.user?.name || '')}</AvatarFallback>
                    </Avatar>
                  ))}
                  {(!task.assignments || task.assignments.length === 0) && <span className="text-xs text-gray-400">Ninguno</span>}
                </div>
              </div>
              <Separator />

              {/* Dates */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-400 text-xs"><Calendar className="h-3 w-3" /> Fecha límite</span>
                <span className="text-xs text-gray-800 dark:text-white">{task.dueDate ? formatDate(task.dueDate) : '—'}</span>
              </div>
              {task.startDate && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Fecha inicio</span>
                    <span className="text-xs text-gray-800 dark:text-white">{formatDate(task.startDate)}</span>
                  </div>
                </>
              )}
              <Separator />

              {/* Estimated hours */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Horas estimadas</span>
                <span className="text-xs text-gray-800 dark:text-white">{task.estimatedHours ? `${task.estimatedHours}h` : '—'}</span>
              </div>
              <Separator />

              {/* Labels */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-400 text-xs"><Tag className="h-3 w-3" /> Etiquetas</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {(task.taskLabels || []).map((tl: any) => (
                    <Badge key={tl.label?.id || tl.id} className="bg-gray-100 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400" style={{ borderColor: tl.label?.color }}>{tl.label?.name}</Badge>
                  ))}
                  {(!task.taskLabels || task.taskLabels.length === 0) && <span className="text-xs text-gray-400">Ninguna</span>}
                </div>
              </div>
              <Separator />

              {/* Sprint */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Sprint</span>
                <span className="text-xs text-gray-800 dark:text-white">{task.sprint?.name || '—'}</span>
              </div>
              <Separator />

              {/* Board Column */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Columna</span>
                <span className="text-xs text-gray-800 dark:text-white">{task.boardColumn?.name || 'Sin asignar'}</span>
              </div>
              <Separator />

              {/* Rol destino */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-400 text-xs"><Shield className="h-3 w-3" /> Rol destino</span>
                {task.role ? (
                  <Badge className="bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 text-[10px]">{task.role.name}</Badge>
                ) : (
                  <span className="text-xs text-gray-400">Sin rol</span>
                )}
              </div>
              <Separator />

              {/* Client visibility */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-400 text-xs"><Eye className="h-3 w-3" /> Visible al cliente</span>
                <button
                  onClick={() => patchTask({ clientVisible: !task.clientVisible })}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    task.clientVisible
                      ? 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400'
                      : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                  }`}
                >
                  {task.clientVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  {task.clientVisible ? 'Visible' : 'Oculta'}
                </button>
              </div>
              <Separator />

              {/* Review attempts */}
              {task.reviewAttempts > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Rechazos</span>
                    <Badge variant="destructive" className="text-[10px]">{task.reviewAttempts}</Badge>
                  </div>
                  <Separator />
                </>
              )}

              {/* Created */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-gray-400 text-xs"><Clock className="h-3 w-3" /> Creada</span>
                <span className="text-xs text-gray-800 dark:text-white">{formatRelative(task.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Time Summary */}
          <div className="rounded-[25px] bg-white p-5 dark:bg-gray-900">
            <h3 className="mb-2 text-[15px] font-semibold text-gray-800 dark:text-white">Tiempo Registrado</h3>
            <p className="text-2xl font-bold text-gray-800 dark:text-white">{totalHours}h {totalMins}m</p>
            {task.timeEntries && task.timeEntries.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {task.timeEntries.slice(0, 5).map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={entry.user?.image} />
                        <AvatarFallback className="text-[7px]">{entry.user?.name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span>{entry.description || 'Sin descripción'}</span>
                    </div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{entry.duration ? `${Math.floor(entry.duration / 3600)}h ${Math.floor((entry.duration % 3600) / 60)}m` : '—'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Files */}
          <div className="rounded-[25px] bg-white p-5 dark:bg-gray-900">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-gray-800 dark:text-white flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" /> Archivos
                {(task.files || []).length > 0 && <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 text-[10px]">{task.files.length}</Badge>}
              </h3>
              <label className="cursor-pointer">
                <input type="file" className="hidden" onChange={handleFileUpload} />
                <div className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">
                  <Upload className="h-3 w-3" /> Subir
                </div>
              </label>
            </div>

            {(task.files || []).length > 0 ? (
              <div className="space-y-1.5">
                {task.files.map((f: any) => {
                  const Icon = f.mimeType?.startsWith('image/') ? Image : f.mimeType?.includes('pdf') ? FileText : FileIcon;
                  return (
                    <div key={f.id} className="flex items-center gap-2 rounded-lg border border-gray-100 dark:border-gray-800 p-2">
                      <Icon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                      <span className="flex-1 truncate text-xs text-gray-700 dark:text-gray-300">{f.originalName || f.name}</span>
                      <button onClick={async () => {
                        try {
                          const res = await api.get(`/files/${f.id}/download`);
                          const url = res.data?.url || res.data;
                          if (url) window.open(url as string, '_blank');
                        } catch { toast.error('Error', 'No se pudo descargar'); }
                      }} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 p-1 rounded">
                        <Download className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">Sin archivos adjuntos</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
