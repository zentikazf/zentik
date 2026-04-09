'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import {
 Plus,
 Search,
 AlertCircle,
 TicketIcon,
 Clock,
 MessageSquare,
 Filter,
 ShieldAlert,
 AlertTriangle,
} from 'lucide-react';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuLabel,
 DropdownMenuSeparator,
 DropdownMenuCheckboxItem,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface CategoryConfig {
 id: string;
 name: string;
 criticality: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface Ticket {
 id: string;
 title: string;
 description?: string;
 status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
 category: string;
 priority: string;
 criticality?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
 slaResponseBreached?: boolean;
 slaResolutionBreached?: boolean;
 responseDeadline?: string | null;
 resolutionDeadline?: string | null;
 client?: { id: string; name: string; email?: string };
 project?: { id: string; name: string; slug?: string };
 task?: { id: string; title: string; status: string } | null;
 channel?: { id: string; name: string; _count?: { messages: number } } | null;
 categoryConfig?: { id: string; name: string; criticality: string } | null;
 createdByUser?: { id: string; name: string } | null;
 createdAt: string;
}

type StatusFilter = 'all' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

const statusFilters: { value: StatusFilter; label: string }[] = [
 { value: 'all', label: 'Todos' },
 { value: 'OPEN', label: 'Abierto' },
 { value: 'IN_PROGRESS', label: 'En progreso' },
 { value: 'RESOLVED', label: 'Resuelto' },
 { value: 'CLOSED', label: 'Cerrado' },
];

const statusConfig: Record<string, { label: string; className: string }> = {
 OPEN: { label: 'Abierto', className: 'bg-destructive/10 text-destructive border-transparent' },
 IN_PROGRESS: { label: 'En progreso', className: 'bg-warning/10 text-warning border-transparent' },
 RESOLVED: { label: 'Resuelto', className: 'bg-success/10 text-success border-transparent' },
 CLOSED: { label: 'Cerrado', className: 'bg-muted text-muted-foreground border-transparent' },
};

const categoryLabelMap: Record<string, string> = {
 SUPPORT_REQUEST: 'Soporte',
 NEW_DEVELOPMENT: 'Desarrollo',
};

const priorityConfig: Record<string, { label: string; className: string }> = {
 HIGH: { label: 'Alta', className: 'text-destructive' },
 MEDIUM: { label: 'Media', className: 'text-warning' },
 LOW: { label: 'Baja', className: 'text-muted-foreground' },
};

const criticalityConfig: Record<string, { label: string; className: string }> = {
 HIGH: { label: 'Alta', className: 'bg-destructive/10 text-destructive' },
 MEDIUM: { label: 'Media', className: 'bg-warning/10 text-warning' },
 LOW: { label: 'Baja', className: 'bg-muted text-muted-foreground' },
};

export default function TicketsPage() {
 const { orgId } = useOrg();
 const [tickets, setTickets] = useState<Ticket[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState('');
 const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
 const [filterPriority, setFilterPriority] = useState<string | null>(null);
 const [filterCategory, setFilterCategory] = useState<string | null>(null);
 const [filterClient, setFilterClient] = useState<string | null>(null);
 const [showCreate, setShowCreate] = useState(false);
 const [creating, setCreating] = useState(false);
 const [clients, setClients] = useState<{ id: string; name: string; portalEnabled?: boolean }[]>([]);
 const [clientProjects, setClientProjects] = useState<{ id: string; name: string }[]>([]);
 const [categoryConfigs, setCategoryConfigs] = useState<CategoryConfig[]>([]);
 const [form, setForm] = useState({
 clientId: '',
 projectId: '',
 title: '',
 description: '',
 category: '',
 priority: 'MEDIUM',
 categoryConfigId: '',
 });

 useEffect(() => {
 if (orgId) {
 loadTickets();
 api.get(`/organizations/${orgId}/clients?limit=200`).then((res) => {
 const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
 setClients(list);
 }).catch(() => {});
 api.get(`/organizations/${orgId}/ticket-categories`).then((res) => {
 const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
 setCategoryConfigs(list.filter((c: any) => c.isActive !== false));
 }).catch(() => {});
 }
 }, [orgId]);

 useEffect(() => {
 if (form.clientId && form.clientId !== 'none') {
 api.get(`/organizations/${orgId}/projects?clientId=${form.clientId}`).then((res) => {
 const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
 setClientProjects(list);
 }).catch(() => setClientProjects([]));
 } else {
 setClientProjects([]);
 }
 }, [form.clientId, orgId]);

 const loadTickets = async () => {
 if (!orgId) return;
 try {
 const res = await api.get(`/organizations/${orgId}/tickets`);
 const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
 setTickets(list);
 } catch (err) {
 if (err instanceof ApiError && err.statusCode === 404) {
 setTickets([]);
 } else {
 const message = err instanceof ApiError ? err.message : 'Error al cargar tickets';
 toast.error('Error', message);
 }
 } finally {
 setLoading(false);
 }
 };

 const handleCreate = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!form.clientId || !form.projectId || !form.title.trim() || !form.category) {
 toast.error('Error', 'Completa todos los campos requeridos');
 return;
 }

 setCreating(true);
 try {
 await api.post(`/organizations/${orgId}/tickets`, {
 clientId: form.clientId,
 projectId: form.projectId,
 title: form.title.trim(),
 description: form.description.trim() || undefined,
 category: form.category,
 priority: form.priority,
 ...(form.categoryConfigId && { categoryConfigId: form.categoryConfigId }),
 });
 toast.success('Ticket creado', 'El ticket fue creado exitosamente');
 setShowCreate(false);
 setForm({ clientId: '', projectId: '', title: '', description: '', category: '', priority: 'MEDIUM', categoryConfigId: '' });
 await loadTickets();
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al crear el ticket');
 } finally {
 setCreating(false);
 }
 };

 const filtered = tickets.filter((t) => {
 const q = search.toLowerCase();
 const matchesSearch =
 t.title.toLowerCase().includes(q) ||
 t.id.toLowerCase().includes(q) ||
 (t.client?.name || '').toLowerCase().includes(q);
 const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
 const matchesPriority = !filterPriority || t.priority === filterPriority;
 const matchesCategory = !filterCategory || t.category === filterCategory;
 const matchesClient = !filterClient || t.client?.id === filterClient;
 return matchesSearch && matchesStatus && matchesPriority && matchesCategory && matchesClient;
 });

 const counts = {
 all: tickets.length,
 OPEN: tickets.filter((t) => t.status === 'OPEN').length,
 IN_PROGRESS: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
 RESOLVED: tickets.filter((t) => t.status === 'RESOLVED').length,
 CLOSED: tickets.filter((t) => t.status === 'CLOSED').length,
 };

 const hasActiveFilters = filterPriority !== null || filterCategory !== null || filterClient !== null;

 const formatDate = (dateStr: string) => {
 try {
 return new Date(dateStr).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
 } catch {
 return dateStr;
 }
 };

 const isSlaBreached = (t: Ticket) => t.slaResponseBreached || t.slaResolutionBreached;

 const getSlaLabel = (t: Ticket) => {
 if (t.slaResponseBreached && t.slaResolutionBreached) return 'SLA Vencido (respuesta + resolución)';
 if (t.slaResponseBreached) return 'SLA Respuesta vencido';
 if (t.slaResolutionBreached) return 'SLA Resolución vencido';
 return '';
 };

 if (loading) {
 return (
 <div className="space-y-4">
 <Skeleton className="h-10 w-64"/>
 <Skeleton className="h-5 w-80"/>
 <div className="flex gap-2 mt-4">
 {Array.from({ length: 5 }).map((_, i) => (
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
 <div className="space-y-6">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
 <div>
 <h1 className="text-xl sm:text-[22px] font-semibold text-foreground">Tickets de soporte</h1>
 <p className="mt-1 text-sm text-muted-foreground">Gestion de solicitudes y soporte</p>
 </div>
 <Dialog open={showCreate} onOpenChange={setShowCreate}>
 <DialogTrigger asChild>
 <Button><Plus className="mr-2 h-4 w-4"/> Nuevo ticket</Button>
 </DialogTrigger>
 <DialogContent className="sm:max-w-lg">
 <DialogHeader>
 <DialogTitle>Nuevo ticket</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleCreate} className="space-y-4">
 <div className="space-y-2">
 <Label className="text-muted-foreground">Titulo</Label>
 <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Describe brevemente la solicitud" required/>
 </div>
 <div className="space-y-2">
 <Label className="text-muted-foreground">Descripcion</Label>
 <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detalla el problema o funcionalidad..." rows={3}/>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label className="text-muted-foreground">Cliente</Label>
 <Select value={form.clientId || 'none'} onValueChange={(v) => setForm({ ...form, clientId: v === 'none' ? '' : v, projectId: '' })}>
 <SelectTrigger><SelectValue placeholder="Seleccionar cliente"/></SelectTrigger>
 <SelectContent>
 <SelectItem value="none">Seleccionar...</SelectItem>
 {clients.map((c) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-muted-foreground">Proyecto</Label>
 <Select value={form.projectId || 'none'} onValueChange={(v) => setForm({ ...form, projectId: v === 'none' ? '' : v })} disabled={!form.clientId}>
 <SelectTrigger><SelectValue placeholder="Seleccionar proyecto"/></SelectTrigger>
 <SelectContent>
 <SelectItem value="none">Seleccionar...</SelectItem>
 {clientProjects.map((p) => (
 <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-muted-foreground">Tipo</Label>
 <Select value={form.category || 'none'} onValueChange={(v) => setForm({ ...form, category: v === 'none' ? '' : v })}>
 <SelectTrigger><SelectValue placeholder="Seleccionar tipo"/></SelectTrigger>
 <SelectContent>
 <SelectItem value="none">Seleccionar...</SelectItem>
 <SelectItem value="SUPPORT_REQUEST">Soporte / Error</SelectItem>
 <SelectItem value="NEW_DEVELOPMENT">Nueva Funcionalidad</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-muted-foreground">Prioridad</Label>
 <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
 <SelectTrigger><SelectValue/></SelectTrigger>
 <SelectContent>
 <SelectItem value="LOW">Baja</SelectItem>
 <SelectItem value="MEDIUM">Media</SelectItem>
 <SelectItem value="HIGH">Alta</SelectItem>
 </SelectContent>
 </Select>
 </div>
 </div>
 {categoryConfigs.length > 0 && (
 <div className="space-y-2">
 <Label className="text-muted-foreground">Categoría SLA</Label>
 <Select value={form.categoryConfigId || 'none'} onValueChange={(v) => setForm({ ...form, categoryConfigId: v === 'none' ? '' : v })}>
 <SelectTrigger><SelectValue placeholder="Sin categoría SLA"/></SelectTrigger>
 <SelectContent>
 <SelectItem value="none">Sin categoría SLA</SelectItem>
 {categoryConfigs.map((c) => (
 <SelectItem key={c.id} value={c.id}>
 {c.name} — <span className={cn('text-xs', criticalityConfig[c.criticality]?.className)}>{criticalityConfig[c.criticality]?.label}</span>
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 <Button type="submit" className="w-full" disabled={creating}>
 {creating ? 'Creando...' : 'Crear ticket'}
 </Button>
 </form>
 </DialogContent>
 </Dialog>
 </div>

 {/* Search + Filters */}
 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative max-w-sm flex-1">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
 <Input placeholder="Buscar por titulo, ID o cliente..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)}/>
 </div>
 <div className="flex items-center gap-1.5 flex-wrap">
 {statusFilters.map((sf) => (
 <button
 key={sf.value}
 onClick={() => setStatusFilter(sf.value)}
 className={cn(
 'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
 statusFilter === sf.value
 ? 'bg-primary text-primary-foreground border-primary'
 : 'bg-card text-muted-foreground border-border hover:bg-muted',
 )}
 >
 {sf.label} ({counts[sf.value]})
 </button>
 ))}

 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" size="sm" className={cn('gap-1', hasActiveFilters && 'border-primary text-primary')}>
 <Filter className="h-3.5 w-3.5"/>
 Filtros
 {hasActiveFilters && <span className="ml-1 rounded-full bg-primary text-primary-foreground w-4 h-4 text-[10px] flex items-center justify-center">{(filterPriority ? 1 : 0) + (filterCategory ? 1 : 0) + (filterClient ? 1 : 0)}</span>}
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56">
 <DropdownMenuLabel>Prioridad</DropdownMenuLabel>
 {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
 <DropdownMenuCheckboxItem key={p} checked={filterPriority === p} onCheckedChange={(checked) => setFilterPriority(checked ? p : null)}>
 {priorityConfig[p]?.label || p}
 </DropdownMenuCheckboxItem>
 ))}
 <DropdownMenuSeparator/>
 <DropdownMenuLabel>Tipo</DropdownMenuLabel>
 {(['SUPPORT_REQUEST', 'NEW_DEVELOPMENT'] as const).map((t) => (
 <DropdownMenuCheckboxItem key={t} checked={filterCategory === t} onCheckedChange={(checked) => setFilterCategory(checked ? t : null)}>
 {categoryLabelMap[t] || t}
 </DropdownMenuCheckboxItem>
 ))}
 {clients.length > 0 && (
 <>
 <DropdownMenuSeparator/>
 <DropdownMenuLabel>Cliente</DropdownMenuLabel>
 {clients.map((c) => (
 <DropdownMenuCheckboxItem key={c.id} checked={filterClient === c.id} onCheckedChange={(checked) => setFilterClient(checked ? c.id : null)}>
 {c.name}
 </DropdownMenuCheckboxItem>
 ))}
 </>
 )}
 {hasActiveFilters && (
 <>
 <DropdownMenuSeparator/>
 <DropdownMenuCheckboxItem checked={false} onCheckedChange={() => { setFilterPriority(null); setFilterCategory(null); setFilterClient(null); }}>
 Limpiar filtros
 </DropdownMenuCheckboxItem>
 </>
 )}
 </DropdownMenuContent>
 </DropdownMenu>
 </div>
 </div>

 {/* Ticket list */}
 <div className="space-y-2">
 {filtered.map((ticket) => {
 const status = statusConfig[ticket.status] || statusConfig.OPEN;
 const priority = priorityConfig[ticket.priority] || priorityConfig.MEDIUM;
 const catLabel = ticket.categoryConfig?.name || categoryLabelMap[ticket.category] || ticket.category;
 const crit = ticket.criticality || ticket.categoryConfig?.criticality;
 const critStyle = crit ? criticalityConfig[crit] : null;
 const breached = isSlaBreached(ticket);

 return (
 <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
 <div className={cn(
 'rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow cursor-pointer flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4',
 breached ? 'border-destructive/50' : 'border-border',
 )}>
 <AlertCircle className={cn('h-5 w-5 shrink-0 hidden sm:block mt-0.5', priority.className)}/>
 <div className="flex-1 min-w-0">
 <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
 <div>
 <div className="flex items-center gap-2">
 <h3 className="text-sm font-medium text-foreground">{ticket.title}</h3>
 {breached && (
 <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive" title={getSlaLabel(ticket)}>
 <ShieldAlert className="h-3 w-3" /> SLA Vencido
 </span>
 )}
 </div>
 <div className="flex items-center gap-2 mt-1 flex-wrap">
 <span className="text-[10px] font-mono text-muted-foreground/60">{ticket.id.slice(-8)}</span>
 <span className="text-xs text-muted-foreground">{ticket.client?.name || 'Sin cliente'}</span>
 <Badge className={status.className}>{status.label}</Badge>
 <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
 {catLabel}
 </span>
 {critStyle && (
 <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', critStyle.className)}>
 <AlertTriangle className="h-2.5 w-2.5" /> {critStyle.label}
 </span>
 )}
 </div>
 </div>
 <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
 {ticket.channel?._count?.messages !== undefined && (
 <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3"/> {ticket.channel._count.messages}</span>
 )}
 <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {formatDate(ticket.createdAt)}</span>
 </div>
 </div>
 {ticket.project && (
 <p className="text-xs text-primary mt-1">{ticket.project.name}</p>
 )}
 </div>
 </div>
 </Link>
 );
 })}
 </div>

 {/* Empty state */}
 {filtered.length === 0 && (
 <div className="flex flex-col items-center py-16 text-center">
 <TicketIcon className="mb-3 h-10 w-10 text-muted-foreground/50"/>
 <p className="text-muted-foreground">
 {search || statusFilter !== 'all' || hasActiveFilters
 ? 'No se encontraron tickets con esos filtros'
 : 'No hay tickets de soporte aun'}
 </p>
 </div>
 )}
 </div>
 );
}
