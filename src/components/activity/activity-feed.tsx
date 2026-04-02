'use client';

import { useState, useEffect } from 'react';
import { Clock, ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { formatRelative, getInitials } from '@/lib/utils';

interface AuditEntry {
 id: string;
 userId?: string;
 action: string;
 resource: string;
 resourceId?: string;
 oldData?: Record<string, any> | null;
 newData?: Record<string, any> | null;
 createdAt: string;
 user?: { id: string; name: string; image?: string | null };
}

const actionLabels: Record<string, string> = {
 create: 'creó',
 created: 'creó',
 update: 'actualizó',
 updated: 'actualizó',
 delete: 'eliminó',
 deleted: 'eliminó',
 complete: 'completó',
 completed: 'completó',
 assign: 'asignó',
 assigned: 'asignó',
 unassign: 'desasignó',
 unassigned: 'desasignó',
 move: 'movió',
 moved: 'movió',
 start: 'inició',
 started: 'inició',
 comment: 'comentó en',
 archive: 'archivó',
 archived: 'archivó',
 'task.approval.approved': 'aprobó',
 'task.approval.rejected': 'rechazó',
 'task.created': 'creó',
 'task.updated': 'actualizó',
 'task.deleted': 'eliminó',
 'task.assigned': 'asignó',
 'task.status.changed': 'cambió el estado de',
};

const resourceLabels: Record<string, string> = {
 task: 'una tarea',
 project: 'el proyecto',
 sprint: 'un sprint',
 board: 'el tablero',
 column: 'una columna',
 member: 'un miembro',
 role: 'un rol',
 file: 'un archivo',
 invoice: 'una factura',
 time_entry: 'un registro de tiempo',
};

function getActionText(action: string, resource: string): string {
 // Try exact match first (for compound actions like 'task.approval.rejected')
 const exactMatch = actionLabels[action.toLowerCase()];
 if (exactMatch) {
 const resourceText = resourceLabels[resource.toLowerCase()] || resource;
 return `${exactMatch} ${resourceText}`;
 }
 // Fallback: try last segment of dot-notation
 const lastSegment = action.split('.').pop() || action;
 const actionText = actionLabels[lastSegment.toLowerCase()] || action;
 const resourceText = resourceLabels[resource.toLowerCase()] || resource;
 return `${actionText} ${resourceText}`;
}

function getChangeSummary(oldData: Record<string, any> | null | undefined, newData: Record<string, any> | null | undefined): string[] {
 if (!oldData || !newData) return [];
 const changes: string[] = [];
 const fieldLabels: Record<string, string> = {
 status: 'Estado',
 priority: 'Prioridad',
 title: 'Título',
 name: 'Nombre',
 description: 'Descripción',
 dueDate: 'Fecha límite',
 assigneeId: 'Asignado',
 };

 for (const key of Object.keys(newData)) {
 if (oldData[key] !== undefined && oldData[key] !== newData[key]) {
 const label = fieldLabels[key] || key;
 changes.push(`${label}: ${oldData[key]} → ${newData[key]}`);
 }
 }
 return changes.slice(0, 3);
}

interface ActivityFeedProps {
 endpoint: string;
 emptyMessage?: string;
 maxItems?: number;
}

export function ActivityFeed({
 endpoint,
 emptyMessage = 'No hay actividad reciente',
 maxItems = 10,
}: ActivityFeedProps) {
 const [entries, setEntries] = useState<AuditEntry[]>([]);
 const [loading, setLoading] = useState(true);
 const [page, setPage] = useState(1);
 const [hasMore, setHasMore] = useState(false);
 const [loadingMore, setLoadingMore] = useState(false);

 useEffect(() => {
 const load = async () => {
 setLoading(true);
 try {
 const res = await api.get<any>(`${endpoint}?page=1&limit=${maxItems}`);
 const data = res.data;
 const items = Array.isArray(data) ? data : data?.data || [];
 setEntries(items);
 const total = data?.total || data?.meta?.total || 0;
 setHasMore(items.length < total);
 } catch {
 // silent
 } finally {
 setLoading(false);
 }
 };
 load();
 }, [endpoint, maxItems]);

 const loadMore = async () => {
 setLoadingMore(true);
 const nextPage = page + 1;
 try {
 const res = await api.get<any>(`${endpoint}?page=${nextPage}&limit=${maxItems}`);
 const data = res.data;
 const items = Array.isArray(data) ? data : data?.data || [];
 setEntries((prev) => [...prev, ...items]);
 setPage(nextPage);
 const total = data?.total || data?.meta?.total || 0;
 setHasMore(entries.length + items.length < total);
 } catch {
 // silent
 } finally {
 setLoadingMore(false);
 }
 };

 if (loading) {
 return (
 <div className="space-y-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="flex items-start gap-3">
 <Skeleton className="h-8 w-8 shrink-0 rounded-full"/>
 <div className="flex-1 space-y-1.5">
 <Skeleton className="h-3.5 w-3/4"/>
 <Skeleton className="h-3 w-1/3"/>
 </div>
 </div>
 ))}
 </div>
 );
 }

 if (entries.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center py-8 text-center">
 <Clock className="mb-2 h-8 w-8 text-muted-foreground/40"/>
 <p className="text-sm text-muted-foreground">{emptyMessage}</p>
 </div>
 );
 }

 return (
 <div className="relative">
 {/* Timeline line */}
 <div className="absolute left-4 top-0 bottom-0 w-px bg-border"/>

 <div className="space-y-0">
 {entries.map((entry) => {
 const changes = getChangeSummary(entry.oldData, entry.newData);

 return (
 <div key={entry.id} className="relative flex items-start gap-3 py-3 pl-1">
 {/* Timeline dot */}
 <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center">
 <div className="h-2.5 w-2.5 rounded-full border-2 border-primary bg-background"/>
 </div>

 {/* Content */}
 <div className="min-w-0 flex-1 pt-0.5">
 <div className="flex items-center gap-2">
 <Avatar className="h-5 w-5">
 <AvatarFallback className="text-[9px]">
 {getInitials(entry.user?.name || '?')}
 </AvatarFallback>
 </Avatar>
 <p className="text-sm">
 <span className="font-medium">{entry.user?.name || 'Sistema'}</span>
 {' '}
 <span className="text-muted-foreground">
 {getActionText(entry.action, entry.resource)}
 </span>
 </p>
 </div>

 {/* Rejection reason */}
 {entry.action === 'task.approval.rejected' && entry.newData?.reason && (
 <div className="mt-1.5 ml-7 rounded-md bg-destructive/10/30 border border-red-100 px-2.5 py-1.5">
 <p className="text-xs text-destructive">{String(entry.newData.reason)}</p>
 </div>
 )}

 {/* Change details */}
 {changes.length > 0 && (
 <div className="mt-1.5 ml-7 space-y-0.5">
 {changes.map((change, i) => (
 <p key={i} className="text-xs text-muted-foreground font-mono">
 {change}
 </p>
 ))}
 </div>
 )}
 </div>

 {/* Time */}
 <span className="shrink-0 pt-1 text-[11px] text-muted-foreground/70">
 {formatRelative(entry.createdAt)}
 </span>
 </div>
 );
 })}
 </div>

 {/* Load more */}
 {hasMore && (
 <div className="mt-2 flex justify-center">
 <Button
 variant="ghost"
 size="sm"
 onClick={loadMore}
 disabled={loadingMore}
 className="text-xs"
 >
 <ChevronDown className="mr-1 h-3 w-3"/>
 {loadingMore ? 'Cargando...' : 'Cargar más'}
 </Button>
 </div>
 )}
 </div>
 );
}
