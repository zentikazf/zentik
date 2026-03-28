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
      <SheetContent side="right" className="w-full sm:max-w-[540px] p-0 flex flex-col">
        {loading || !task ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-3">
              <SheetHeader>
                <div className="flex items-center gap-2 mb-2 pr-6">
                  <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[task.status]}`} />
                  <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                    {STATUS_OPTIONS.find((s) => s.value === task.status)?.label}
                  </span>
                  <Badge className={`text-[10px] ${priorityOpt?.color || 'bg-gray-100 text-gray-600'}`}>
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
                    className="cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-1 -mx-1 py-0.5 transition-colors text-left"
                  >
                    {task.title}
                  </SheetTitle>
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
                    className="cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-1 -mx-1 py-0.5 transition-colors text-left min-h-[1.5rem]"
                  >
                    {task.description || 'Haz clic para agregar descripción...'}
                  </SheetDescription>
                )}
              </SheetHeader>

              {/* Link to full page */}
              <Link
                href={`/projects/${projectId}/tasks/${taskId}`}
                className="inline-flex items-center gap-1 mt-2 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> Ver página completa
              </Link>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-gray-100 dark:border-gray-800 px-6">
              {(['details', 'subtasks', 'comments', 'activity'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`pb-2.5 px-3 text-xs font-medium transition-colors ${
                    tab === t
                      ? 'text-gray-800 dark:text-white border-b-2 border-gray-800 dark:border-white'
                      : 'text-gray-400 hover:text-gray-600'
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
                        <span className="text-gray-400 text-xs">Estado</span>
                        <Select value={task.status} onValueChange={handleStatusChange}>
                          <SelectTrigger className="h-7 w-36 text-xs border-none shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.filter((s) => s.value !== 'DONE').map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                            <div className="px-2 py-1.5 text-xs text-gray-400 cursor-not-allowed flex items-center gap-1.5">
                              <Lock className="h-3 w-3" /> Completada — requiere aprobación
                            </div>
                          </SelectContent>
                        </Select>
                      </div>
                      <Separator />

                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-xs">Prioridad</span>
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

                      {/* Assignees */}
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                          <User className="h-3 w-3" /> Asignados
                        </span>
                        <div className="flex -space-x-1">
                          {(task.assignments || []).map((a: any) => (
                            <Avatar key={a.user?.id} className="h-6 w-6 border-2 border-white dark:border-gray-900">
                              <AvatarImage src={a.user?.image} />
                              <AvatarFallback className="text-[8px] bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                                {getInitials(a.user?.name || '')}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {(!task.assignments || task.assignments.length === 0) && (
                            <span className="text-xs text-gray-400">Ninguno</span>
                          )}
                        </div>
                      </div>
                      <Separator />

                      {/* Dates */}
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                          <Calendar className="h-3 w-3" /> Fecha límite
                        </span>
                        <span className="text-xs text-gray-800 dark:text-white">
                          {task.dueDate ? formatDate(task.dueDate) : '—'}
                        </span>
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
                        <span className="text-xs text-gray-800 dark:text-white">
                          {task.estimatedHours ? `${task.estimatedHours}h` : '—'}
                        </span>
                      </div>
                      <Separator />

                      {/* Labels */}
                      <div>
                        <span className="flex items-center gap-1.5 text-gray-400 text-xs mb-2">
                          <Tag className="h-3 w-3" /> Etiquetas
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
                        <span className="text-gray-400 text-xs">Sprint</span>
                        <span className="text-xs text-gray-800 dark:text-white">{task.sprint?.name || '—'}</span>
                      </div>
                      <Separator />

                      {/* Board Column */}
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-xs">Columna</span>
                        <span className="text-xs text-gray-800 dark:text-white">
                          {task.boardColumn?.name || 'Sin asignar'}
                        </span>
                      </div>
                      <Separator />

                      {/* Role */}
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                          <Shield className="h-3 w-3" /> Rol destino
                        </span>
                        {task.role ? (
                          <Badge className="bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 text-[10px]">
                            {task.role.name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-gray-400">Sin rol</span>
                        )}
                      </div>
                      <Separator />

                      {/* Client Visibility */}
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                          <Eye className="h-3 w-3" /> Visible al cliente
                        </span>
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
                    </div>

                    {/* Time summary */}
                    <div className="rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                          <Clock className="h-3 w-3" /> Tiempo
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">Estimadas</p>
                          <p className="text-sm font-bold text-gray-800 dark:text-white">{task.estimatedHours || 0}h</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">Registradas</p>
                          <p className="text-sm font-bold text-gray-800 dark:text-white">{totalHours}h {totalMins}m</p>
                        </div>
                      </div>
                    </div>

                    {/* Files */}
                    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                          <Paperclip className="h-3 w-3" /> Archivos
                          {(task.files || []).length > 0 && (
                            <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 text-[9px] px-1.5">
                              {task.files.length}
                            </Badge>
                          )}
                        </span>
                        <label className="cursor-pointer">
                          <input type="file" className="hidden" onChange={handleFileUpload} />
                          <div className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">
                            <Upload className="h-3 w-3" /> Subir
                          </div>
                        </label>
                      </div>
                      {(task.files || []).length > 0 ? (
                        <div className="space-y-1">
                          {task.files.map((f: any) => {
                            const Icon = f.mimeType?.startsWith('image/') ? Image : f.mimeType?.includes('pdf') ? FileText : FileIcon;
                            return (
                              <div key={f.id} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-gray-50 dark:hover:bg-gray-800">
                                <Icon className="h-3 w-3 text-gray-400 shrink-0" />
                                <span className="flex-1 truncate text-[11px] text-gray-600 dark:text-gray-300">{f.originalName || f.name}</span>
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
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 p-0.5 rounded"
                                >
                                  <Download className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-400 text-center py-2">Sin archivos</p>
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
                          <span className="text-xs text-gray-400">{completedSubs}/{totalSubs} completadas</span>
                          <span className="text-xs text-gray-400">
                            {totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all"
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
                              className="flex w-full items-center gap-2 sm:gap-2.5 rounded-xl border border-gray-100 p-2 sm:p-2.5 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:border-blue-200 dark:hover:border-blue-800 transition-colors text-left"
                            >
                              <CheckCircle2
                                className={`h-4 w-4 shrink-0 ${
                                  sub.status === 'DONE' ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'
                                }`}
                              />
                              <span
                                className={`flex-1 text-xs sm:text-sm truncate ${
                                  sub.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-white'
                                }`}
                              >
                                {sub.title}
                              </span>
                              <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
                            </button>
                          ))}
                        </div>

                        {totalSubs === 0 && (
                          <p className="text-xs text-gray-400 text-center py-6">No hay subtareas</p>
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
                          <Plus className="h-3 w-3" />
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
                                <span className="text-xs font-medium text-gray-800 dark:text-white">{c.user?.name}</span>
                                <span className="text-[10px] text-gray-400">{formatRelative(c.createdAt)}</span>
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 whitespace-pre-wrap">{c.content}</p>
                              {/* Replies */}
                              {(c.replies || []).length > 0 && (
                                <div className="mt-2 ml-3 space-y-2 border-l-2 border-gray-100 dark:border-gray-800 pl-2.5">
                                  {c.replies.map((r: any) => (
                                    <div key={r.id} className="flex gap-2">
                                      <Avatar className="h-5 w-5 shrink-0">
                                        <AvatarImage src={r.user?.image} />
                                        <AvatarFallback className="text-[7px]">{r.user?.name?.charAt(0)}</AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">{r.user?.name}</span>
                                        <p className="text-[11px] text-gray-500 whitespace-pre-wrap">{r.content}</p>
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
                      <p className="text-xs text-gray-400 text-center py-8">No hay comentarios aún</p>
                    )}

                    {/* New comment */}
                    <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
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
                        <Send className="h-3 w-3" />
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
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full rounded-xl" />
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
        className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
      >
        <ChevronRight className="h-3 w-3 rotate-180" /> Volver a subtareas
      </button>

      {/* Title */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 sm:p-4">
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
            className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-1 -mx-1 py-0.5 transition-colors break-words"
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
            className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 cursor-text hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-1 -mx-1 py-0.5 transition-colors min-h-[1.5rem] break-words"
          >
            {data.description || 'Haz clic para agregar descripción...'}
          </p>
        )}
      </div>

      {/* Status & Priority */}
      <div className="space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-400 text-[11px] sm:text-xs shrink-0">Estado</span>
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
              <div className="px-2 py-1.5 text-xs text-gray-400 cursor-not-allowed flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> Completada — requiere aprobación
              </div>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-400 text-[11px] sm:text-xs shrink-0">Prioridad</span>
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
          <span className="flex items-center gap-1 sm:gap-1.5 text-gray-400 text-[11px] sm:text-xs shrink-0">
            <User className="h-3 w-3" /> Asignados
          </span>
          <div className="flex -space-x-1 flex-wrap justify-end">
            {(data.assignments || []).map((a: any) => (
              <Avatar key={a.user?.id} className="h-5 w-5 sm:h-6 sm:w-6 border-2 border-white dark:border-gray-900">
                <AvatarImage src={a.user?.image} />
                <AvatarFallback className="text-[7px] sm:text-[8px] bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                  {getInitials(a.user?.name || '')}
                </AvatarFallback>
              </Avatar>
            ))}
            {(!data.assignments || data.assignments.length === 0) && (
              <span className="text-[11px] sm:text-xs text-gray-400">Ninguno</span>
            )}
          </div>
        </div>

        <Separator />

        {/* Dates */}
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 sm:gap-1.5 text-gray-400 text-[11px] sm:text-xs shrink-0">
            <Calendar className="h-3 w-3" /> Fecha límite
          </span>
          <span className="text-[11px] sm:text-xs text-gray-800 dark:text-white">
            {data.dueDate ? formatDate(data.dueDate) : '—'}
          </span>
        </div>
      </div>

    </div>
  );
}
