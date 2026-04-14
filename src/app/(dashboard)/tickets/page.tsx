'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
 CircleDot,
 Loader2,
 CheckCircle2,
 XCircle,
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
 ticketNumber: string | null;
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

type StatusTab = 'all' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

const tabConfig: { value: StatusTab; label: string; icon: React.ElementType; dotColor: string }[] = [
 { value: 'all', label: 'Todos', icon: TicketIcon, dotColor: '' },
 { value: 'OPEN', label: 'Abiertos', icon: CircleDot, dotColor: 'bg-destructive' },
 { value: 'IN_PROGRESS', label: 'En progreso', icon: Loader2, dotColor: 'bg-warning' },
 { value: 'RESOLVED', label: 'Resueltos', icon: CheckCircle2, dotColor: 'bg-success' },
 { value: 'CLOSED', label: 'Cerrados', icon: XCircle, dotColor: 'bg-muted-foreground' },
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

const criticalityConfig: Record<string, { label: string; className: string; bg: string }> = {
 HIGH: { label: 'Alta', className: 'text-destructive', bg: 'bg-destructive/10 text-destructive' },
 MEDIUM: { label: 'Media', className: 'text-warning', bg: 'bg-warning/10 text-warning' },
 LOW: { label: 'Baja', className: 'text-muted-foreground', bg: 'bg-muted text-muted-foreground' },
};

export default function TicketsPage() {
 const { orgId } = useOrg();
 const [tickets, setTickets] = useState<Ticket[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState('');
 const [activeTab, setActiveTab] = useState<StatusTab>('all');
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
 const res = await api.post<any>(`/organizations/${orgId}/tickets`, {
 clientId: form.clientId,
 projectId: form.projectId,
 title: form.title.trim(),
 description: form.description.trim() || undefined,
 category: form.category,
 priority: form.priority,
 ...(form.categoryConfigId && { categoryConfigId: form.categoryConfigId }),
 });
 const ticketNum = res.data?.ticketNumber || res.data?.id?.slice(-8).toUpperCase();
 toast.success('Ticket creado', `Ticket #${ticketNum} creado exitosamente`);
 setShowCreate(false);
 setForm({ clientId: '', projectId: '', title: '', description: '', category: '', priority: 'MEDIUM', categoryConfigId: '' });
 await loadTickets();
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al crear el ticket');
 } finally {
 setCreating(false);
 }
 };

 const counts = {
 all: tickets.length,
 OPEN: tickets.filter((t) => t.status === 'OPEN').length,
 IN_PROGRESS: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
 RESOLVED: tickets.filter((t) => t.status === 'RESOLVED').length,
 CLOSED: tickets.filter((t) => t.status === 'CLOSED').length,
 };

 const hasActiveFilters = filterPriority !== null || filterCategory !== null || filterClient !== null;

 const getFilteredTickets = (tab: StatusTab) => {
 return tickets.filter((t) => {
 const q = search.toLowerCase();
 const matchesSearch =
 t.title.toLowerCase().includes(q) ||
 t.id.toLowerCase().includes(q) ||
 (t.ticketNumber || '').toLowerCase().includes(q) ||
 (t.client?.name || '').toLowerCase().includes(q);
 const matchesStatus = tab === 'all' || t.status === tab;
 const matchesPriority = !filterPriority || t.priority === filterPriority;
 const matchesCategory = !filterCategory || t.category === filterCategory;
 const matchesClient = !filterClient || t.client?.id === filterClient;
 return matchesSearch && matchesStatus && matchesPriority && matchesCategory && matchesClient;
 });
 };

 const formatDate = (dateStr: string) => {
 try {
 return new Date(dateStr).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
 } catch {
 return dateStr;
 }
 };

 const isSlaBreached = (t: Ticket) => t.slaResponseBreached || t.slaResolutionBreached;

 const getSlaLabel = (t: Ticket) => {
 if (t.slaResponseBreached && t.slaResolutionBreached) return 'SLA Vencido (respuesta + resolucion)';
 if (t.slaResponseBreached) return 'SLA Respuesta vencido';
 if (t.slaResolutionBreached) return 'SLA Resolucion vencido';
 return '';
 };

 const renderTicketCard = (ticket: Ticket) => {
 const status = statusConfig[ticket.status] || statusConfig.OPEN;
 const catLabel = ticket.categoryConfig?.name || categoryLabelMap[ticket.category] || ticket.category;
 const crit = ticket.criticality || ticket.categoryConfig?.criticality || ticket.priority;
 const critStyle = criticalityConfig[crit] || criticalityConfig.MEDIUM;
 const breached = isSlaBreached(ticket);

 return (
 <Link key={ticket.id} href={`/tickets/${ticket.id}`}>
 <div className={cn(
 'group rounded-xl border bg-card p-4 hover:shadow-md transition-all cursor-pointer',
 breached ? 'border-destructive/50 hover:border-destructive/70' : 'border-border hover:border-primary/30',
 )}>
 <div className="flex items-start gap-3">
 {/* Criticality indicator */}
 <div className={cn('mt-1 h-2 w-2 rounded-full shrink-0', critStyle.bg.split(' ')[0])} />

 <div className="flex-1 min-w-0">
 {/* Title row */}
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <div className="flex items-center gap-2 flex-wrap">
 <span className="text-[10px] font-mono text-muted-foreground/50">#{ticket.ticketNumber || ticket.id.slice(-8).toUpperCase()}</span>
 <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{ticket.title}</h3>
 </div>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 {breached && (
 <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive" title={getSlaLabel(ticket)}>
 <ShieldAlert className="h-3 w-3" /> SLA
 </span>
 )}
 <Badge className={cn(status.className, 'text-[10px]')}>{status.label}</Badge>
 </div>
 </div>

 {/* Meta row */}
 <div className="flex items-center gap-2 mt-2 flex-wrap">
 <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
 {catLabel}
 </span>
 <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', critStyle.bg)}>
 <AlertTriangle className="h-2.5 w-2.5" /> Criticidad: {critStyle.label}
 </span>
 <span className="text-[11px] text-muted-foreground">{ticket.client?.name || 'Sin cliente'}</span>
 {ticket.project && (
 <span className="text-[11px] text-primary">{ticket.project.name}</span>
 )}
 </div>

 {/* Footer row */}
 <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
 <span className="flex items-center gap-1"><Clock className="h-3 w-3"/> {formatDate(ticket.createdAt)}</span>
 {ticket.createdByUser && (
 <span className="text-[11px] text-muted-foreground">por {ticket.createdByUser.name}</span>
 )}
 {ticket.channel?._count?.messages !== undefined && ticket.channel._count.messages > 0 && (
 <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3"/> {ticket.channel._count.messages}</span>
 )}
 </div>
 </div>
 </div>
 </div>
 </Link>
 );
 };

 const renderTicketList = (tab: StatusTab) => {
 const list = getFilteredTickets(tab);
 if (list.length === 0) {
 return (
 <div className="flex flex-col items-center py-16 text-center">
 <TicketIcon className="mb-3 h-10 w-10 text-muted-foreground/50"/>
 <p className="text-sm text-muted-foreground">
 {search || hasActiveFilters
 ? 'No se encontraron tickets con esos filtros'
 : tab === 'all' ? 'No hay tickets de soporte aun' : `No hay tickets ${tabConfig.find((t) => t.value === tab)?.label.toLowerCase()}`}
 </p>
 </div>
 );
 }
 return <div className="space-y-2">{list.map(renderTicketCard)}</div>;
 };

 if (loading) {
 return (
 <div className="space-y-4">
 <Skeleton className="h-10 w-64"/>
 <Skeleton className="h-5 w-80"/>
 <Skeleton className="h-10 w-full max-w-lg rounded-lg mt-4"/>
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
 <div className="flex items-center gap-3">
 {/* Summary badges */}
 {counts.OPEN > 0 && (
 <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
 <CircleDot className="h-3 w-3"/> {counts.OPEN} abiertos
 </div>
 )}
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
 <Label className="text-muted-foreground">Criticidad</Label>
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
 <Label className="text-muted-foreground">Categoria SLA</Label>
 <Select value={form.categoryConfigId || 'none'} onValueChange={(v) => setForm({ ...form, categoryConfigId: v === 'none' ? '' : v })}>
 <SelectTrigger><SelectValue placeholder="Sin categoria SLA"/></SelectTrigger>
 <SelectContent>
 <SelectItem value="none">Sin categoria SLA</SelectItem>
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
 </div>

 {/* Tabs + search */}
 <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusTab)}>
 <div className="flex flex-col sm:flex-row sm:items-center gap-3">
 <TabsList className="w-full sm:w-auto">
 {tabConfig.map((tab) => (
 <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-xs">
 {tab.dotColor && <div className={cn('h-1.5 w-1.5 rounded-full', tab.dotColor)} />}
 {tab.label}
 <span className="ml-0.5 text-[10px] opacity-60">({counts[tab.value]})</span>
 </TabsTrigger>
 ))}
 </TabsList>

 <div className="flex items-center gap-2 sm:ml-auto">
 <div className="relative flex-1 sm:w-64">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
 <Input placeholder="Buscar..." className="pl-9 h-9" value={search} onChange={(e) => setSearch(e.target.value)}/>
 </div>
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button variant="outline" size="sm" className={cn('gap-1 h-9 shrink-0', hasActiveFilters && 'border-primary text-primary')}>
 <Filter className="h-3.5 w-3.5"/>
 <span className="hidden sm:inline">Filtros</span>
 {hasActiveFilters && <span className="rounded-full bg-primary text-primary-foreground w-4 h-4 text-[10px] flex items-center justify-center">{(filterPriority ? 1 : 0) + (filterCategory ? 1 : 0) + (filterClient ? 1 : 0)}</span>}
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" className="w-56">
 <DropdownMenuLabel>Criticidad</DropdownMenuLabel>
 {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
 <DropdownMenuCheckboxItem key={p} checked={filterPriority === p} onCheckedChange={(checked) => setFilterPriority(checked ? p : null)}>
 {criticalityConfig[p]?.label || p}
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

 {tabConfig.map((tab) => (
 <TabsContent key={tab.value} value={tab.value}>
 {renderTicketList(tab.value)}
 </TabsContent>
 ))}
 </Tabs>
 </div>
 );
}
