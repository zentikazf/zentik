'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import {
 Plus,
 Search,
 AlertCircle,
 TicketIcon,
 Calendar,
 User,
} from 'lucide-react';

interface Ticket {
 id: string;
 title: string;
 description?: string;
 status: 'abierto' | 'en_progreso' | 'resuelto';
 priority: 'alta' | 'media' | 'baja';
 client?: { id: string; name: string };
 assignee?: { id: string; name: string };
 createdAt: string;
}

type StatusFilter = 'all' | 'abierto' | 'en_progreso' | 'resuelto';

const statusFilters: { value: StatusFilter; label: string }[] = [
 { value: 'all', label: 'Todos' },
 { value: 'abierto', label: 'Abierto' },
 { value: 'en_progreso', label: 'En progreso' },
 { value: 'resuelto', label: 'Resuelto' },
];

const statusConfig: Record<string, { label: string; className: string }> = {
 abierto: {
 label: 'Abierto',
 className: 'bg-destructive/10 text-destructive border-transparent',
 },
 en_progreso: {
 label: 'En progreso',
 className: 'bg-warning/10 text-warning border-transparent',
 },
 resuelto: {
 label: 'Resuelto',
 className: 'bg-success/10 text-success border-transparent',
 },
};

const priorityConfig: Record<string, { label: string; className: string }> = {
 alta: { label: 'Alta', className: 'text-destructive' },
 media: { label: 'Media', className: 'text-warning' },
 baja: { label: 'Baja', className: 'text-muted-foreground' },
};

export default function TicketsPage() {
 const { orgId } = useOrg();
 const [tickets, setTickets] = useState<Ticket[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

 useEffect(() => {
 if (orgId) loadTickets();
 }, [orgId]);

 const loadTickets = async () => {
 if (!orgId) return;
 try {
 const res = await api.get(`/organizations/${orgId}/tickets`);
 const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
 setTickets(list);
 } catch (err) {
 if (err instanceof ApiError && err.statusCode === 404) {
 // Endpoint may not exist yet, show empty state
 setTickets([]);
 } else {
 const message =
 err instanceof ApiError ? err.message : 'Error al cargar tickets';
 toast.error('Error', message);
 }
 } finally {
 setLoading(false);
 }
 };

 const filtered = tickets.filter((t) => {
 const matchesSearch =
 t.title.toLowerCase().includes(search.toLowerCase()) ||
 (t.client?.name || '').toLowerCase().includes(search.toLowerCase());
 const matchesStatus =
 statusFilter === 'all' || t.status === statusFilter;
 return matchesSearch && matchesStatus;
 });

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
 <div className="space-y-4">
 <Skeleton className="h-10 w-64"/>
 <Skeleton className="h-5 w-80"/>
 <div className="flex gap-2 mt-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-9 w-24 rounded-full"/>
 ))}
 </div>
 <div className="space-y-3 mt-4">
 {Array.from({ length: 5 }).map((_, i) => (
 <Skeleton key={i} className="h-24 rounded-xl"/>
 ))}
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-4">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">
 Tickets de soporte
 </h1>
 <p className="mt-1 text-sm text-muted-foreground">
 Gestion de solicitudes y soporte
 </p>
 </div>
 <Button>
 <Plus className="mr-2 h-4 w-4"/> Nuevo ticket
 </Button>
 </div>

 {/* Status filter pills */}
 <div className="flex flex-wrap items-center gap-2">
 {statusFilters.map((sf) => (
 <button
 key={sf.value}
 onClick={() => setStatusFilter(sf.value)}
 className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
 statusFilter === sf.value
 ? 'bg-primary text-primary-foreground border-primary'
 : 'bg-card text-muted-foreground border-border hover:bg-muted'
 }`}
 >
 {sf.label}
 {sf.value !== 'all' && (
 <span className="ml-1.5 text-xs opacity-70">
 {tickets.filter((t) => t.status === sf.value).length}
 </span>
 )}
 </button>
 ))}
 </div>

 {/* Search */}
 <div className="relative max-w-sm">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
 <Input
 placeholder="Buscar tickets..."
 className="pl-9"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 />
 </div>

 {/* Ticket list */}
 <div className="space-y-3">
 {filtered.map((ticket) => {
 const status = statusConfig[ticket.status] || statusConfig.abierto;
 const priority =
 priorityConfig[ticket.priority] || priorityConfig.media;

 return (
 <div
 key={ticket.id}
 className="rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow cursor-pointer"
 >
 <div className="flex items-start justify-between gap-4">
 <div className="min-w-0 flex-1">
 <div className="flex items-center gap-2 flex-wrap">
 <h3 className="text-[15px] font-semibold text-foreground truncate">
 {ticket.title}
 </h3>
 <Badge
 className={status.className}
 >
 {status.label}
 </Badge>
 </div>

 {ticket.description && (
 <p className="mt-1 text-sm text-muted-foreground line-clamp-1">
 {ticket.description}
 </p>
 )}

 <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
 {ticket.client && (
 <span className="flex items-center gap-1">
 <User className="h-3 w-3"/>
 {ticket.client.name}
 </span>
 )}
 <span className="flex items-center gap-1">
 <AlertCircle className={`h-3 w-3 ${priority.className}`} />
 <span className={priority.className}>
 {priority.label}
 </span>
 </span>
 {ticket.createdAt && (
 <span className="flex items-center gap-1">
 <Calendar className="h-3 w-3"/>
 {formatDate(ticket.createdAt)}
 </span>
 )}
 {ticket.assignee && (
 <span className="flex items-center gap-1">
 <User className="h-3 w-3"/>
 {ticket.assignee.name}
 </span>
 )}
 </div>
 </div>
 </div>
 </div>
 );
 })}
 </div>

 {/* Empty state */}
 {filtered.length === 0 && (
 <div className="flex flex-col items-center py-16 text-center">
 <TicketIcon className="mb-3 h-10 w-10 text-muted-foreground/50"/>
 <p className="text-muted-foreground">
 {search || statusFilter !== 'all'
 ? 'No se encontraron tickets con esos filtros'
 : 'No hay tickets de soporte aun'}
 </p>
 </div>
 )}
 </div>
 );
}
