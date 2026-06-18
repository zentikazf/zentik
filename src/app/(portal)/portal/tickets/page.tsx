'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ticket, Plus, Clock, ChevronRight, AlertCircle, Info, CircleDot, Search, MessageSquare, User } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { TicketsPagination } from '@/components/tickets/tickets-pagination';
import { STATUS_BADGE, STATUS_DOT, STATUS_LABEL } from '@/components/tickets/ticket-status-machine';
import type { TicketStatus } from '@/types/ticket.types';

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
 SUPPORT_REQUEST: { label: 'Soporte', color: 'bg-warning/10 text-warning' },
 NEW_DEVELOPMENT: { label: 'Desarrollo', color: 'bg-info/10 text-info' },
 NEW_PROJECT: { label: 'Nuevo Proyecto', color: 'bg-primary/10 text-primary' },
};

// Tabs del portal estilo admin: dot + contador. SIN tab "Cerrados" (colapsa
// en Resueltos — feature #12). Las etiquetas reusan STATUS_LABEL salvo el
// plural de "Todos".
type StatusTab = 'all' | 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'RESOLVED';

const tabConfig: { value: StatusTab; label: string; dotColor: string }[] = [
 { value: 'all', label: 'Todos', dotColor: '' },
 { value: 'OPEN', label: 'Abiertos', dotColor: STATUS_DOT.OPEN },
 { value: 'IN_PROGRESS', label: 'En Proceso', dotColor: STATUS_DOT.IN_PROGRESS },
 { value: 'IN_REVIEW', label: 'En Revision', dotColor: STATUS_DOT.IN_REVIEW },
 { value: 'RESOLVED', label: 'Resueltos', dotColor: STATUS_DOT.RESOLVED },
];

interface TicketItem {
 id: string;
 ticketNumber: string | null;
 title: string;
 description: string | null;
 category: string;
 status: string;
 priority: string;
 createdAt: string;
 project?: { id: string; name: string };
 task?: { id: string; status: string } | null;
 channel?: { id: string; _count?: { messages: number } } | null;
 createdByUser?: { id: string; name: string } | null;
}

interface ProjectOption {
 id: string;
 name: string;
}

interface DynamicCategory {
 id: string;
 name: string;
 description?: string;
}

interface BusinessHours {
 start: string;
 end: string;
 days: string[];
 timezone: string;
}

const PAGE_SIZE = 10;

const EMPTY_FORM = {
 projectId: '',
 title: '',
 description: '',
 category: '',
 priority: 'MEDIUM',
 projectName: '',
 projectDescription: '',
 relatedTicketId: '',
};

export default function PortalTicketsPage() {
 const { user } = useAuth();
 const router = useRouter();
 const pathname = usePathname();
 const searchParams = useSearchParams();
 // `tickets` = set COMPLETO del cliente (el endpoint devuelve todos). El
 // filtrado (tab/search/proyecto/onlyMine), los contadores y la paginacion
 // se hacen 100% client-side — volumen bajo por cliente (feature #12, opcion B).
 const [tickets, setTickets] = useState<TicketItem[]>([]);
 const [page, setPage] = useState(1);
 const [projects, setProjects] = useState<ProjectOption[]>([]);
 const [dynamicCategories, setDynamicCategories] = useState<DynamicCategory[]>([]);
 const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
 const [loading, setLoading] = useState(true);
 const [activeTab, setActiveTab] = useState<StatusTab>('all');
 const [search, setSearch] = useState('');
 const [filterProject, setFilterProject] = useState('');
 const [onlyMine, setOnlyMine] = useState(false);
 const [showCreate, setShowCreate] = useState(false);
 const [creating, setCreating] = useState(false);
 const [attachFile, setAttachFile] = useState<File | null>(null);
 const [form, setForm] = useState({ ...EMPTY_FORM });

 // Carga inicial: trae TODOS los tickets del cliente una sola vez.
 useEffect(() => {
 loadData();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, []);

 // Reset a pagina 1 cuando cambia cualquier filtro client-side (tab, busqueda,
 // proyecto, "Mis tickets"). Sin esto, al filtrar podriamos quedar en una
 // pagina vacia (p.ej. estabas en pag 3 y el filtro deja solo 8 resultados).
 useEffect(() => {
 setPage(1);
 }, [activeTab, search, filterProject, onlyMine]);

 // Flujo "Crear nueva consulta" desde un ticket RESOLVED: el modal "¿mismo tema?"
 // navega aca con ?related=<id>&same=1|0. Pre-rellenamos el form y abrimos el
 // modal de creacion; si same=1 traemos title/description del ticket relacionado.
 // Limpiamos los query params al consumirlos para que un reload no re-dispare esto.
 useEffect(() => {
 const relatedTicketId = searchParams.get('related');
 if (!relatedTicketId) return;
 const sameTopic = searchParams.get('same') === '1';

 const prefillFromRelated = async () => {
 // category SUPPORT_REQUEST porque el flujo arranca desde un ticket de soporte
 // del portal; el cliente puede ajustar el tipo antes de enviar.
 setForm({ ...EMPTY_FORM, relatedTicketId, category: 'SUPPORT_REQUEST' });

 if (sameTopic) {
 try {
 const res = await api.get<any>(`/portal/tickets/${relatedTicketId}`);
 const related = res.data;
 if (related) {
 setForm((prev) => ({
 ...prev,
 title: related.title || '',
 description: related.description || '',
 projectId: related.project?.id || '',
 }));
 }
 } catch {
 // Si no se puede traer el ticket relacionado, abrimos el form vacio igual
 // (relatedTicketId queda seteado para preservar la trazabilidad).
 toast.error('Aviso', 'No se pudo precargar el ticket anterior. Completa los datos manualmente.');
 }
 }

 setShowCreate(true);
 // Limpiar los query params consumidos (evita re-disparo en reload).
 router.replace(pathname);
 };

 prefillFromRelated();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [searchParams]);

 const loadData = async () => {
 try {
 const [ticketsRes, projectsRes, catRes, bhRes] = await Promise.all([
 api.get<any>('/portal/tickets'),
 api.get<any>('/portal/projects'),
 api.get<any>('/portal/ticket-categories').catch(() => ({ data: [] })),
 api.get<any>('/portal/business-hours').catch(() => ({ data: null })),
 ]);
 // El endpoint devuelve { data, meta: { total } } con TODOS los tickets del
 // cliente. Defensivo ante array legacy por si el backend aun no esta desplegado.
 const body = ticketsRes.data;
 const list: TicketItem[] = Array.isArray(body) ? body : body?.data || [];
 setTickets(list);
 setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : projectsRes.data?.data || []);
 const cats = Array.isArray(catRes.data) ? catRes.data : catRes.data?.data || [];
 setDynamicCategories(cats);
 setBusinessHours(bhRes.data || null);
 } catch {
 toast.error('Error', 'Error al cargar los tickets');
 } finally {
 setLoading(false);
 }
 };

 // Cambio de pagina 100% client-side: solo mueve el offset del slice.
 const handlePageChange = (target: number) => {
 setPage(target);
 window.scrollTo({ top: 0, behavior: 'smooth' });
 };

 const handleCreate = async (e: React.FormEvent) => {
 e.preventDefault();

 if (form.category === 'NEW_PROJECT') {
 if (!form.projectName.trim()) {
 toast.error('Error', 'El nombre del proyecto es requerido');
 return;
 }
 setCreating(true);
 try {
 await api.post<any>('/portal/project-requests', {
 name: form.projectName.trim(),
 description: form.projectDescription.trim() || undefined,
 });
 toast.success('Solicitud enviada', 'Tu solicitud de nuevo proyecto fue enviada al equipo');
 setShowCreate(false);
 setForm({ ...EMPTY_FORM });
 setPage(1);
 await loadData();
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al enviar la solicitud');
 } finally {
 setCreating(false);
 }
 return;
 }

 if (form.category === 'SUPPORT_REQUEST' && dynamicCategories.length > 0) {
 toast.error('Error', 'Selecciona una categoria de soporte');
 return;
 }

 if (!form.projectId || !form.title.trim() || !form.category) {
 toast.error('Error', 'Completa todos los campos requeridos');
 return;
 }

 setCreating(true);
 try {
 const res = await api.post<any>(`/portal/projects/${form.projectId}/tickets`, {
 title: form.title.trim(),
 description: form.description.trim() || undefined,
 category: form.category,
 priority: form.priority,
 relatedTicketId: form.relatedTicketId || undefined,
 });

 // Upload optional attachment to the ticket channel
 if (attachFile && res.data?.channel?.id) {
 const fd = new FormData();
 fd.append('file', attachFile);
 const uploadRes = await api.upload<any>('/files/upload?category=ATTACHMENT', fd).catch(() => null);
 const fileId = uploadRes?.data?.id;
 await api.post(`/channels/${res.data.channel.id}/messages`, {
 content: `📎 ${attachFile.name}`,
 ...(fileId && { fileIds: [fileId] }),
 }).catch(() => {});
 }

 const ticketNum = res.data?.ticketNumber || res.data?.id?.slice(-8).toUpperCase();
 toast.success('Ticket creado', `Tu ticket #${ticketNum} fue enviado al equipo`);
 setShowCreate(false);
 setAttachFile(null);
 setForm({ ...EMPTY_FORM });
 setPage(1);
 await loadData();
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al crear el ticket');
 } finally {
 setCreating(false);
 }
 };

 // Filtros NO-tab (search + proyecto + "Mis tickets") sobre el set COMPLETO.
 // Base para los contadores de tabs Y para la lista visible — asi los counts
 // y el listado siempre cuadran entre si.
 const baseFiltered = useMemo(() => {
 const q = search.toLowerCase();
 return tickets.filter((t) => {
 const matchesSearch = !q || t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || (t.ticketNumber || '').toLowerCase().includes(q);
 const matchesProject = !filterProject || t.project?.id === filterProject;
 const matchesMine = !onlyMine || t.createdByUser?.id === user?.id;
 return matchesSearch && matchesProject && matchesMine;
 });
 }, [tickets, search, filterProject, onlyMine, user?.id]);

 // Contadores de tabs EXACTOS: count sobre el set completo ya filtrado por los
 // OTROS filtros (no por la tab). Reflejan todos los tickets del cliente, no
 // una pagina.
 const counts = useMemo(
 () => ({
 all: baseFiltered.length,
 OPEN: baseFiltered.filter((t) => t.status === 'OPEN').length,
 IN_PROGRESS: baseFiltered.filter((t) => t.status === 'IN_PROGRESS').length,
 IN_REVIEW: baseFiltered.filter((t) => t.status === 'IN_REVIEW').length,
 RESOLVED: baseFiltered.filter((t) => t.status === 'RESOLVED').length,
 }),
 [baseFiltered],
 );

 const getFilteredTickets = (tab: StatusTab) =>
 tab === 'all' ? baseFiltered : baseFiltered.filter((t) => t.status === tab);

 const renderTicketCard = (ticket: TicketItem) => {
 const status = ticket.status as TicketStatus;
 const statusLabel = STATUS_LABEL[status] || STATUS_LABEL.OPEN;
 const statusBadge = STATUS_BADGE[status] || STATUS_BADGE.OPEN;
 const statusDot = STATUS_DOT[status] || STATUS_DOT.OPEN;
 const catConf = CATEGORY_CONFIG[ticket.category] || CATEGORY_CONFIG.SUPPORT_REQUEST;

 return (
 <Link key={ticket.id} href={`/portal/tickets/${ticket.id}`}>
 <div className="group rounded-xl bg-card p-3 sm:p-4 transition-all hover:shadow-md border border-border hover:border-primary/30 active:scale-[0.99]">
 <div className="flex items-start gap-2.5 sm:gap-3">
 {/* Status dot — reusa STATUS_DOT del status-machine */}
 <div className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', statusDot)} />

 <div className="flex-1 min-w-0">
 {/* Title row */}
 <div className="flex items-start justify-between gap-2">
 <div className="min-w-0 flex-1">
 <span className="text-[10px] font-mono text-muted-foreground/50">#{ticket.ticketNumber || ticket.id.slice(-8).toUpperCase()}</span>
 <h3 className="text-[13px] sm:text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 sm:truncate leading-snug mt-0.5">{ticket.title}</h3>
 </div>
 <Badge className={cn(statusBadge, 'text-[10px] font-semibold shrink-0 whitespace-nowrap')}>
 {statusLabel}
 </Badge>
 </div>

 {/* Tags + meta */}
 <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 flex-wrap">
 <Badge className={cn(catConf.color, 'border-none text-[9px] sm:text-[10px] uppercase tracking-wider font-bold px-1.5 py-0')}>
 {catConf.label}
 </Badge>
 {ticket.project && (
 <span className="text-[10px] sm:text-[11px] text-primary font-medium truncate max-w-[120px] sm:max-w-none">{ticket.project.name}</span>
 )}
 {ticket.createdByUser && (
 <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground">
 <User className="h-3 w-3"/>{ticket.createdByUser.name}
 </span>
 )}
 <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground ml-auto">
 <Clock className="h-3 w-3"/>
 {new Date(ticket.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
 </span>
 {ticket.channel?._count?.messages !== undefined && ticket.channel._count.messages > 0 && (
 <span className="flex items-center gap-1 text-[10px] sm:text-[11px] text-muted-foreground">
 <MessageSquare className="h-3 w-3"/> {ticket.channel._count.messages}
 </span>
 )}
 </div>
 </div>

 <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0 mt-1.5 hidden sm:block"/>
 </div>
 </div>
 </Link>
 );
 };

 const renderTicketList = (tab: StatusTab) => {
 const filtered = getFilteredTickets(tab);
 if (filtered.length === 0) {
 return (
 <div className="flex flex-col items-center py-12 sm:py-16 text-center px-4">
 <Ticket className="mb-3 h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/50"/>
 <p className="text-xs sm:text-sm text-muted-foreground">
 {search || filterProject || onlyMine
 ? 'No se encontraron tickets con esos filtros'
 : tab === 'all' ? 'No hay tickets aun' : `No hay tickets ${tabConfig.find((t) => t.value === tab)?.label.toLowerCase()}`}
 </p>
 </div>
 );
 }
 // Paginacion 100% client-side sobre el array ya filtrado.
 const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
 const safePage = Math.min(page, totalPages);
 const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
 return (
 <div className="space-y-2">
 {pageItems.map(renderTicketCard)}
 {/* Paginacion numerada client-side: refleja el set FILTRADO (feature #12) */}
 <TicketsPagination
 page={safePage}
 totalPages={totalPages}
 total={filtered.length}
 limit={PAGE_SIZE}
 onPageChange={handlePageChange}
 />
 </div>
 );
 };

 if (loading) {
 return (
 <div className="mx-auto max-w-5xl space-y-5 px-4 sm:px-0">
 <Skeleton className="h-8 sm:h-10 w-40 sm:w-48 rounded-xl"/>
 <Skeleton className="h-10 w-full rounded-lg"/>
 <Skeleton className="h-9 w-full rounded-lg"/>
 <div className="space-y-2">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-20 sm:h-24 rounded-xl"/>
 ))}
 </div>
 </div>
 );
 }

 return (
 <div className="mx-auto max-w-5xl space-y-5 px-4 sm:px-0 pb-4">
 {/* Header */}
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <h1 className="text-xl sm:text-2xl font-bold text-foreground">Mis Tickets</h1>
 <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
 Seguimiento de solicitudes de soporte y desarrollo
 </p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 {counts.OPEN > 0 && (
 <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
 <CircleDot className="h-3 w-3"/> {counts.OPEN} abiertos
 </div>
 )}
 <Dialog open={showCreate} onOpenChange={setShowCreate}>
 <DialogTrigger asChild>
 <Button size="sm" className="rounded-full h-9 px-3 sm:px-4">
 <Plus className="h-4 w-4 sm:mr-2"/> <span className="hidden sm:inline">Nuevo Ticket</span>
 </Button>
 </DialogTrigger>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle>Crear Ticket</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleCreate} className="space-y-4 pt-2">
 <div className="space-y-2">
 <Label className="text-muted-foreground">Tipo de solicitud</Label>
 <Select
 value={form.category.startsWith('dynamic:') ? 'SUPPORT_REQUEST' : form.category}
 onValueChange={(v) => setForm({ ...form, category: v })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Selecciona el tipo"/>
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="SUPPORT_REQUEST">Soporte / Error</SelectItem>
 <SelectItem value="NEW_PROJECT">Nuevo Proyecto</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {(form.category === 'SUPPORT_REQUEST' || form.category.startsWith('dynamic:')) && dynamicCategories.length > 0 && (
 <div className="space-y-2">
 <Label className="text-muted-foreground">Categoria</Label>
 <Select
 value={form.category.startsWith('dynamic:') ? form.category : ''}
 onValueChange={(v) => setForm({ ...form, category: v })}
 >
 <SelectTrigger>
 <SelectValue placeholder="Selecciona una categoria"/>
 </SelectTrigger>
 <SelectContent>
 {dynamicCategories.map((dc) => (
 <SelectItem key={dc.id} value={`dynamic:${dc.id}`}>{dc.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}

 {form.category === 'NEW_PROJECT' ? (
 <>
 <div className="space-y-2">
 <Label className="text-muted-foreground">Nombre del proyecto</Label>
 <Input
 value={form.projectName}
 onChange={(e) => setForm({ ...form, projectName: e.target.value })}
 placeholder="Nombre del nuevo proyecto"
 required
 />
 </div>
 <div className="space-y-2">
 <Label className="text-muted-foreground">Descripcion del proyecto</Label>
 <Textarea
 value={form.projectDescription}
 onChange={(e) => setForm({ ...form, projectDescription: e.target.value })}
 placeholder="Describe que necesitas en este proyecto..."
 rows={4}
 />
 </div>
 </>
 ) : form.category && form.category !== 'NEW_PROJECT' ? (
 /* Proyecto + Titulo + Descripcion: se renderizan tambien para
    SUPPORT_REQUEST (y categorias dynamic:) — fix pre-fill del #11
    (feature #12 T11). Antes el guard excluia SUPPORT_REQUEST y el
    pre-llenado de "Crear nueva consulta / Si" no se veia. */
 <>
 <div className="space-y-2">
 <Label className="text-muted-foreground">Proyecto</Label>
 <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
 <SelectTrigger>
 <SelectValue placeholder="Selecciona un proyecto"/>
 </SelectTrigger>
 <SelectContent>
 {projects.map((p) => (
 <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-muted-foreground">Titulo</Label>
 <Input
 value={form.title}
 onChange={(e) => setForm({ ...form, title: e.target.value })}
 placeholder="Describe brevemente tu solicitud"
 required
 />
 </div>
 <div className="space-y-2">
 <Label className="text-muted-foreground">Descripcion detallada</Label>
 <Textarea
 value={form.description}
 onChange={(e) => setForm({ ...form, description: e.target.value })}
 placeholder="Explica con mas detalle el problema o funcionalidad que necesitas..."
 rows={4}
 />
 </div>
 </>
 ) : null}

 {form.category && form.category !== 'NEW_PROJECT' && (
 <div className="space-y-2">
 <Label className="text-muted-foreground">Archivo adjunto <span className="text-muted-foreground/50">(opcional)</span></Label>
 <div className="flex items-center gap-2">
 <Input
 type="file"
 className="text-xs"
 onChange={(e) => setAttachFile(e.target.files?.[0] || null)}
 />
 {attachFile && (
 <Button type="button" variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => setAttachFile(null)}>
 Quitar
 </Button>
 )}
 </div>
 {attachFile && (
 <p className="text-[10px] text-muted-foreground">Se adjuntara al chat del ticket despues de crearlo.</p>
 )}
 </div>
 )}

 {form.category && (
 <Button type="submit" className="w-full rounded-full" disabled={creating}>
 {creating ? 'Enviando...' : form.category === 'NEW_PROJECT' ? 'Solicitar Proyecto' : 'Enviar Ticket'}
 </Button>
 )}

 {businessHours && (
 <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
 <Info className="h-3.5 w-3.5 mt-0.5 shrink-0"/>
 <span>
 Horario de atencion: {businessHours.days.join(', ')} de {businessHours.start} a {businessHours.end} ({businessHours.timezone}).
 Los tickets fuera de horario seran atendidos en el siguiente dia habil.
 </span>
 </div>
 )}
 </form>
 </DialogContent>
 </Dialog>
 </div>
 </div>

 {/* Tabs + search */}
 <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusTab)}>
 <div className="space-y-3">
 {/* Scrollable tabs — estilo admin: dot + contador */}
 <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scrollbar-none">
 <TabsList className="w-max sm:w-auto inline-flex">
 {tabConfig.map((tab) => (
 <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-[11px] sm:text-xs px-2.5 sm:px-3">
 {tab.dotColor && <div className={cn('h-1.5 w-1.5 rounded-full', tab.dotColor)} />}
 <span className="whitespace-nowrap">{tab.label}</span>
 <span className="ml-0.5 text-[10px] opacity-60">({counts[tab.value]})</span>
 </TabsTrigger>
 ))}
 </TabsList>
 </div>

 {/* Search + filtros secundarios */}
 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
 <div className="relative flex-1">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
 <Input placeholder="Buscar tickets..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)}/>
 </div>
 {projects.length > 1 && (
 <Select value={filterProject || 'all'} onValueChange={(v) => setFilterProject(v === 'all' ? '' : v)}>
 <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs">
 <SelectValue placeholder="Proyecto" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todos los proyectos</SelectItem>
 {projects.map((p) => (
 <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 )}
 {/* "Mis tickets" como filtro SECUNDARIO (no protagonista) */}
 <Button
 variant={onlyMine ? 'secondary' : 'ghost'}
 size="sm"
 className="h-9 text-xs gap-1.5 shrink-0"
 onClick={() => setOnlyMine(!onlyMine)}
 >
 <User className="h-3.5 w-3.5"/>
 Mis tickets
 </Button>
 </div>
 </div>

 {tabConfig.map((tab) => (
 <TabsContent key={tab.value} value={tab.value}>
 {renderTicketList(tab.value)}
 </TabsContent>
 ))}
 </Tabs>

 {/* Info box when no projects */}
 {projects.length === 0 && tickets.length === 0 && (
 <div className="flex items-start gap-3 rounded-[16px] bg-primary/10 p-4">
 <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5"/>
 <p className="text-sm text-primary">
 No tienes proyectos activos. Contacta con tu equipo para que te asignen un proyecto antes de crear tickets.
 </p>
 </div>
 )}
 </div>
 );
}
