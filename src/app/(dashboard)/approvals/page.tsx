'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { PhaseBadge } from '@/components/ui/phase-badge';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import {
 CheckCircle2,
 XCircle,
 Clock,
 User,
 FolderKanban,
 AlertTriangle,
} from 'lucide-react';

interface ApprovalTask {
 id: string;
 title: string;
 description?: string;
 status: string;
 priority?: 'alta' | 'media' | 'baja';
 project?: { id: string; name: string };
 assignee?: { id: string; name: string };
 estimatedHours?: number;
 reviewAttempts?: number;
 createdAt: string;
}

const priorityConfig: Record<string, { label: string; variant: 'destructive' | 'warning' | 'muted' }> = {
 alta: { label: 'Alta', variant: 'destructive' },
 media: { label: 'Media', variant: 'warning' },
 baja: { label: 'Baja', variant: 'muted' },
};

export default function ApprovalsPage() {
 const { orgId } = useOrg();
 const [tasks, setTasks] = useState<ApprovalTask[]>([]);
 const [loading, setLoading] = useState(true);
 const [actioningId, setActioningId] = useState<string | null>(null);
 const [rejectingId, setRejectingId] = useState<string | null>(null);
 const [rejectReason, setRejectReason] = useState('');

 useEffect(() => {
 if (orgId) loadApprovals();
 }, [orgId]);

 const loadApprovals = async () => {
 if (!orgId) return;
 try {
 const res = await api.get(`/organizations/${orgId}/approvals`);
 const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
 setTasks(list);
 } catch (err) {
 const message =
 err instanceof ApiError ? err.message : 'Error al cargar aprobaciones';
 toast.error('Error', message);
 } finally {
 setLoading(false);
 }
 };

 const handleApprove = async (taskId: string) => {
 if (!orgId) return;
 setActioningId(taskId);
 try {
 await api.post(`/tasks/${taskId}/approve`);
 toast.success('Aprobada', 'La tarea fue aprobada exitosamente');
 setTasks((prev) => prev.filter((t) => t.id !== taskId));
 } catch (err) {
 const message =
 err instanceof ApiError ? err.message : 'Error al aprobar la tarea';
 toast.error('Error', message);
 } finally {
 setActioningId(null);
 }
 };

 const handleReject = async (taskId: string) => {
 if (!orgId) return;
 setActioningId(taskId);
 try {
 await api.post(`/tasks/${taskId}/reject`, { reason: rejectReason || undefined });
 toast.success('Rechazada', 'La tarea fue devuelta a Desarrollo');
 setRejectingId(null);
 setRejectReason('');
 setTasks((prev) => prev.filter((t) => t.id !== taskId));
 } catch (err) {
 const message =
 err instanceof ApiError ? err.message : 'Error al rechazar la tarea';
 toast.error('Error', message);
 } finally {
 setActioningId(null);
 }
 };

 const formatDate = (dateStr: string) => {
 try {
 return new Date(dateStr).toLocaleDateString('es-PY', {
 day: '2-digit',
 month: 'short',
 year: 'numeric',
 });
 } catch {
 return dateStr;
 }
 };

 if (loading) {
 return (
 <div className="space-y-5 max-w-4xl">
 <Skeleton className="h-10 w-48"/>
 <Skeleton className="h-5 w-72"/>
 <div className="space-y-4 mt-4">
 {Array.from({ length: 3 }).map((_, i) => (
 <Skeleton key={i} className="h-36 rounded-xl"/>
 ))}
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-5 max-w-4xl">
 {/* Header */}
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">
 Aprobaciones
 </h1>
 <p className="mt-1 text-sm text-muted-foreground">
 Tareas pendientes de revision ({tasks.length})
 </p>
 </div>

 {/* Empty state */}
 {tasks.length === 0 && (
 <div className="flex flex-col items-center py-20 text-center">
 <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
 <CheckCircle2 className="h-8 w-8 text-success"/>
 </div>
 <p className="text-lg font-medium text-foreground">Todo al dia</p>
 <p className="mt-1 text-sm text-muted-foreground">
 No hay tareas pendientes de aprobacion.
 </p>
 </div>
 )}

 {/* Task list */}
 <div className="space-y-4">
 {tasks.map((task) => {
 const priority = task.priority
 ? priorityConfig[task.priority]
 : null;
 const isActioning = actioningId === task.id;

 return (
 <div
 key={task.id}
 className="rounded-xl border border-border bg-card p-4 sm:p-5 hover:shadow-sm transition-all"
 >
 <div className="flex items-start justify-between gap-4">
 <div className="min-w-0 flex-1">
 {/* Title row with badges */}
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="text-[15px] font-semibold text-foreground">
 {task.title}
 </h3>
 <PhaseBadge phase="testing"/>
 {priority && (
 <Badge variant={priority.variant}>
 {priority.label}
 </Badge>
 )}
 {(task.reviewAttempts ?? 0) > 0 && (
 <Badge className="bg-orange-100 text-orange-700">
 <AlertTriangle className="mr-1 h-3 w-3"/>
 Intento #{(task.reviewAttempts ?? 0) + 1}
 </Badge>
 )}
 </div>

 {/* Description */}
 {task.description && (
 <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
 {task.description}
 </p>
 )}

 {/* Metadata */}
 <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
 {task.project && (
 <span className="flex items-center gap-1">
 <FolderKanban className="h-3 w-3"/>
 {task.project.name}
 </span>
 )}
 {task.assignee && (
 <span className="flex items-center gap-1">
 <User className="h-3 w-3"/>
 {task.assignee.name}
 </span>
 )}
 {task.estimatedHours != null && (
 <span className="flex items-center gap-1">
 <Clock className="h-3 w-3"/>
 {task.estimatedHours}h estimadas
 </span>
 )}
 {task.createdAt && (
 <span className="flex items-center gap-1">
 <Clock className="h-3 w-3"/>
 {formatDate(task.createdAt)}
 </span>
 )}
 </div>
 </div>

 {/* Action buttons */}
 <div className="flex shrink-0 items-center gap-2">
 {rejectingId === task.id ? (
 <div className="flex flex-col gap-2">
 <Textarea
 placeholder="Motivo del rechazo (opcional)"
 value={rejectReason}
 onChange={(e) => setRejectReason(e.target.value)}
 className="w-64 text-sm"
 rows={2}
 />
 <div className="flex gap-2">
 <Button
 size="sm"
 variant="outline"
 className="flex-1 rounded-full"
 onClick={() => { setRejectingId(null); setRejectReason(''); }}
 >
 Cancelar
 </Button>
 <Button
 size="sm"
 className="flex-1 rounded-full bg-destructive hover:bg-destructive/90"
 onClick={() => handleReject(task.id)}
 disabled={isActioning}
 >
 Confirmar
 </Button>
 </div>
 </div>
 ) : (
 <>
 <Button
 size="sm"
 className="bg-phase-produccion text-white hover:bg-phase-produccion/90"
 onClick={() => handleApprove(task.id)}
 disabled={isActioning}
 >
 <CheckCircle2 className="mr-1.5 h-4 w-4"/>
 Aprobar
 </Button>
 <Button
 variant="outline"
 size="sm"
 className="text-destructive border-destructive/30 hover:bg-destructive/10"
 disabled={isActioning}
 onClick={() => setRejectingId(task.id)}
 >
 <XCircle className="mr-1.5 h-4 w-4"/>
 Rechazar
 </Button>
 </>
 )}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
}
