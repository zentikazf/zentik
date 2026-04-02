'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
 AlertCircle,
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
 await api.post(`/organizations/${orgId}/approvals/${taskId}/approve`);
 toast.success('Tarea aprobada', 'La tarea ha sido aprobada exitosamente');
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
 await api.post(`/organizations/${orgId}/approvals/${taskId}/reject`);
 toast.success('Tarea rechazada', 'La tarea ha sido rechazada');
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
 <div className="flex items-center gap-2 shrink-0">
 <Button
 variant="outline"
 size="sm"
 className="text-destructive border-destructive/30 hover:bg-destructive/10"
 disabled={isActioning}
 onClick={() => handleReject(task.id)}
 >
 <XCircle className="mr-1.5 h-4 w-4"/>
 Rechazar
 </Button>
 <Button
 size="sm"
 className="bg-phase-produccion text-white hover:bg-phase-produccion/90"
 disabled={isActioning}
 onClick={() => handleApprove(task.id)}
 >
 <CheckCircle2 className="mr-1.5 h-4 w-4"/>
 Aprobar
 </Button>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
}
