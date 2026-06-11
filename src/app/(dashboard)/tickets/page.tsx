'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  Filter,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  TicketIcon,
  Wifi,
  WifiOff,
  Eye,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ticketService } from '@/services/ticket.service';
import { useTicketsSocket } from '@/hooks/use-tickets-socket';
import { TicketSidePanel } from '@/components/tickets/ticket-side-panel';
import { STATUS_BADGE, STATUS_LABEL, KANBAN_STATUS_LABEL } from '@/components/tickets/ticket-status-machine';
import type { TicketListItem, TicketStats, TicketStatus } from '@/types/ticket.types';

type StatusTab = 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'RESOLVED' | 'all';

interface CategoryConfig {
  id: string;
  name: string;
  criticality: 'HIGH' | 'MEDIUM' | 'LOW';
}

const tabConfig: { value: StatusTab; label: string; icon: React.ElementType; dotColor: string }[] = [
  { value: 'OPEN', label: 'Abierto', icon: CircleDot, dotColor: 'bg-destructive' },
  { value: 'IN_PROGRESS', label: 'En progreso', icon: Loader2, dotColor: 'bg-warning' },
  { value: 'IN_REVIEW', label: 'En revision', icon: Eye, dotColor: 'bg-info' },
  { value: 'RESOLVED', label: 'Resuelto', icon: CheckCircle2, dotColor: 'bg-success' },
];

const categoryLabelMap: Record<string, string> = {
  SUPPORT_REQUEST: 'Soporte',
  NEW_DEVELOPMENT: 'Desarrollo',
};

const criticalityConfig: Record<string, { label: string; className: string; bg: string }> = {
  HIGH: { label: 'Alta', className: 'text-destructive', bg: 'bg-destructive/10 text-destructive' },
  MEDIUM: { label: 'Media', className: 'text-warning', bg: 'bg-warning/10 text-warning' },
  LOW: { label: 'Baja', className: 'text-muted-foreground', bg: 'bg-muted text-muted-foreground' },
};

const PAGE_LIMIT = 20;
const POLL_INTERVAL_MS = 60000;

export default function TicketsPage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Vista por defecto: Abiertos (NO Todos)
  // Legacy: si la URL trae status=CLOSED (URL vieja o cookie antigua),
  // degradar a OPEN. CLOSED ya no es un estado válido en UI (feature #10).
  const rawInitialTab = searchParams.get('status') as StatusTab | 'CLOSED' | null;
  const initialTab: StatusTab =
    rawInitialTab && rawInitialTab !== 'CLOSED' && rawInitialTab !== null
      ? (rawInitialTab as StatusTab)
      : 'OPEN';
  const initialTicketParam = searchParams.get('ticket');
  const initialPanelOpen = searchParams.get('panel') === 'open';

  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<StatusTab>(initialTab);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string; portalEnabled?: boolean }[]>([]);
  const [clientProjects, setClientProjects] = useState<{ id: string; name: string }[]>([]);
  const [categoryConfigs, setCategoryConfigs] = useState<CategoryConfig[]>([]);

  // Panel lateral
  const [panelTicketId, setPanelTicketId] = useState<string | null>(initialTicketParam);
  const [panelOpen, setPanelOpen] = useState(initialPanelOpen && !!initialTicketParam);

  const [form, setForm] = useState({
    clientId: '',
    projectId: '',
    title: '',
    description: '',
    category: '',
    priority: 'MEDIUM',
    categoryConfigId: '',
  });

  // ─── Sync URL ↔ state (tab + ticket abierto) ────────────────
  const syncUrl = useCallback(
    (next: { status?: StatusTab; ticket?: string | null; panel?: 'open' | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.status !== undefined) {
        if (next.status === 'OPEN') params.delete('status'); // default → no param
        else params.set('status', next.status);
      }
      if (next.ticket !== undefined) {
        if (next.ticket) params.set('ticket', next.ticket);
        else params.delete('ticket');
      }
      if (next.panel !== undefined) {
        if (next.panel) params.set('panel', next.panel);
        else params.delete('panel');
      }
      router.replace(`/tickets${params.toString() ? `?${params}` : ''}`, { scroll: false });
    },
    [router, searchParams],
  );

  // ─── Loaders ────────────────────────────────────────────────
  const buildQuery = useCallback(
    (cursor?: string) => ({
      ...(activeTab !== 'all' && { status: activeTab as TicketStatus }),
      ...(filterClient && { clientId: filterClient }),
      ...(search && { search }),
      cursor,
      limit: PAGE_LIMIT,
    }),
    [activeTab, filterClient, search],
  );

  const loadTickets = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await ticketService.list(orgId, buildQuery());
      setTickets(res.data.data);
      setNextCursor(res.data.meta.nextCursor);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        setTickets([]);
        setNextCursor(null);
      } else {
        toast.error('Error', err instanceof ApiError ? err.message : 'Error al cargar tickets');
      }
    } finally {
      setLoading(false);
    }
  }, [orgId, buildQuery]);

  const loadStats = useCallback(async () => {
    if (!orgId) return;
    try {
      const res = await ticketService.stats(orgId);
      setStats(res.data);
    } catch {
      // silent — los contadores son secundarios
    }
  }, [orgId]);

  const loadMore = useCallback(async () => {
    if (!orgId || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await ticketService.list(orgId, buildQuery(nextCursor));
      setTickets((prev) => [...prev, ...res.data.data]);
      setNextCursor(res.data.meta.nextCursor);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al cargar mas');
    } finally {
      setLoadingMore(false);
    }
  }, [orgId, nextCursor, loadingMore, buildQuery]);

  // ─── Effects: carga inicial + cuando cambia tab/filtro/search ─
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    loadTickets();
  }, [orgId, activeTab, filterClient, loadTickets]);

  // Debounced search
  useEffect(() => {
    if (!orgId) return;
    const handler = setTimeout(() => {
      setLoading(true);
      loadTickets();
    }, 300);
    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (!orgId) return;
    loadStats();
    api
      .get(`/organizations/${orgId}/clients?limit=200`)
      .then((res) => {
        const list = (res.data as any)?.data || (Array.isArray(res.data) ? res.data : []);
        setClients(list);
      })
      .catch(() => {});
    api
      .get(`/organizations/${orgId}/ticket-categories`)
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
        setCategoryConfigs(list.filter((c: any) => c.isActive !== false));
      })
      .catch(() => {});
  }, [orgId, loadStats]);

  useEffect(() => {
    if (form.clientId && form.clientId !== 'none') {
      api
        .get(`/organizations/${orgId}/projects?clientId=${form.clientId}`)
        .then((res) => {
          const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
          setClientProjects(list);
        })
        .catch(() => setClientProjects([]));
    } else {
      setClientProjects([]);
    }
  }, [form.clientId, orgId]);

  // ─── WebSocket: refrescar cuando llegan eventos ──────────────
  const { status: wsStatus, shouldFallbackPoll } = useTicketsSocket(orgId, {
    'ticket:updated': () => {
      loadTickets();
      loadStats();
    },
    'ticket:created': () => {
      loadTickets();
      loadStats();
    },
    'ticket:closed': () => {
      loadTickets();
      loadStats();
    },
    'ticket:assigned': () => {
      loadTickets();
    },
  });

  // Fallback polling si WS lleva >30s caido
  useEffect(() => {
    if (!shouldFallbackPoll || !orgId) return;
    const interval = setInterval(() => {
      loadTickets();
      loadStats();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [shouldFallbackPoll, orgId, loadTickets, loadStats]);

  // ─── Handlers ───────────────────────────────────────────────
  const handleTabChange = (v: string) => {
    const next = v as StatusTab;
    setActiveTab(next);
    syncUrl({ status: next });
  };

  const openPanel = (ticketId: string) => {
    setPanelTicketId(ticketId);
    setPanelOpen(true);
    syncUrl({ ticket: ticketId, panel: 'open' });
  };

  const closePanel = (open: boolean) => {
    setPanelOpen(open);
    if (!open) {
      syncUrl({ ticket: null, panel: null });
      setPanelTicketId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !form.clientId || !form.projectId || !form.title.trim() || !form.category) {
      toast.error('Error', 'Completa todos los campos requeridos');
      return;
    }
    setCreating(true);
    try {
      const res = await ticketService.create(orgId, {
        clientId: form.clientId,
        projectId: form.projectId,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        priority: form.priority,
        ...(form.categoryConfigId && { categoryConfigId: form.categoryConfigId }),
      });
      const ticketNum = res.data.ticketNumber || res.data.id?.slice(-8).toUpperCase();
      toast.success('Ticket creado', `Ticket #${ticketNum} creado exitosamente`);
      setShowCreate(false);
      setForm({
        clientId: '',
        projectId: '',
        title: '',
        description: '',
        category: '',
        priority: 'MEDIUM',
        categoryConfigId: '',
      });
      await loadTickets();
      await loadStats();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al crear el ticket');
    } finally {
      setCreating(false);
    }
  };

  const counts = useMemo(() => {
    return {
      OPEN: stats?.OPEN ?? 0,
      IN_PROGRESS: stats?.IN_PROGRESS ?? 0,
      IN_REVIEW: stats?.IN_REVIEW ?? 0,
      RESOLVED: stats?.RESOLVED ?? 0,
      all: stats?.TOTAL ?? 0,
    };
  }, [stats]);

  const hasActiveFilters = filterPriority !== null || filterCategory !== null || filterClient !== null;

  // Filtros client-side adicionales sobre la lista paginada
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesPriority = !filterPriority || t.priority === filterPriority;
      const matchesCategory = !filterCategory || t.category === filterCategory;
      return matchesPriority && matchesCategory;
    });
  }, [tickets, filterPriority, filterCategory]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
    } catch {
      return dateStr;
    }
  };

  const isSlaBreached = (t: TicketListItem) => t.slaResponseBreached || t.slaResolutionBreached;

  const renderTicketCard = (ticket: TicketListItem) => {
    const status = STATUS_BADGE[ticket.status];
    const catLabel = ticket.categoryConfig?.name || categoryLabelMap[ticket.category] || ticket.category;
    const crit = ticket.criticality || ticket.categoryConfig?.criticality || ticket.priority;
    const critStyle = criticalityConfig[crit] || criticalityConfig.MEDIUM;
    const breached = isSlaBreached(ticket);
    const kanbanStatus = ticket.task?.boardColumn?.mappedStatus;
    const kanbanLabel = kanbanStatus ? KANBAN_STATUS_LABEL[kanbanStatus] : null;
    const assignee = ticket.task?.assignments?.[0]?.user;

    return (
      <button
        key={ticket.id}
        onClick={() => openPanel(ticket.id)}
        className="w-full text-left"
      >
        <div
          className={cn(
            'group rounded-xl border bg-card p-4 hover:shadow-md transition-all cursor-pointer',
            breached ? 'border-destructive/50 hover:border-destructive/70' : 'border-border hover:border-primary/30',
            panelTicketId === ticket.id && 'ring-2 ring-primary/40',
          )}
        >
          <div className="flex items-start gap-3">
            <div className={cn('mt-1 h-2 w-2 rounded-full shrink-0', critStyle.bg.split(' ')[0])} />

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono text-muted-foreground/60">
                      #{ticket.ticketNumber || ticket.id.slice(-8).toUpperCase()}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {ticket.title}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {breached && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
                      title="SLA vencido"
                    >
                      <ShieldAlert className="h-3 w-3" /> SLA
                    </span>
                  )}
                  <Badge className={cn(status, 'text-[10px]')}>{STATUS_LABEL[ticket.status]}</Badge>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {catLabel}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                    critStyle.bg,
                  )}
                >
                  <AlertTriangle className="h-2.5 w-2.5" /> {critStyle.label}
                </span>
                {kanbanLabel && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-medium text-info"
                    title="Estado en Kanban"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-info" />
                    Kanban: {kanbanLabel}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground">{ticket.client?.name || 'Sin cliente'}</span>
              </div>

              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDate(ticket.createdAt)}
                </span>
                {assignee && (
                  <span className="text-foreground/80">{assignee.name}</span>
                )}
                {ticket.channel?._count?.messages !== undefined && ticket.channel._count.messages > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {ticket.channel._count.messages}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </button>
    );
  };

  if (loading && tickets.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-80" />
        <Skeleton className="h-10 w-full max-w-lg rounded-lg mt-4" />
        <div className="space-y-3 mt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
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
          <p className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
            Gestion de solicitudes y soporte
            {wsStatus === 'connected' && (
              <span className="inline-flex items-center gap-1 text-success text-xs">
                <Wifi className="h-3 w-3" /> En vivo
              </span>
            )}
            {wsStatus === 'disconnected' && (
              <span
                className="inline-flex items-center gap-1 text-warning text-xs"
                title={shouldFallbackPoll ? 'Actualizando cada 60s' : 'Reconectando...'}
              >
                <WifiOff className="h-3 w-3" />
                {shouldFallbackPoll ? 'Modo respaldo' : 'Reconectando...'}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {counts.OPEN > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <CircleDot className="h-3 w-3" /> {counts.OPEN} abiertos
            </div>
          )}
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nuevo ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nuevo ticket</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Titulo</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Describe brevemente la solicitud"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Descripcion</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Detalla el problema o funcionalidad..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Cliente</Label>
                    <Select
                      value={form.clientId || 'none'}
                      onValueChange={(v) => setForm({ ...form, clientId: v === 'none' ? '' : v, projectId: '' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Seleccionar...</SelectItem>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Proyecto</Label>
                    <Select
                      value={form.projectId || 'none'}
                      onValueChange={(v) => setForm({ ...form, projectId: v === 'none' ? '' : v })}
                      disabled={!form.clientId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar proyecto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Seleccionar...</SelectItem>
                        {clientProjects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Tipo</Label>
                    <Select
                      value={form.category || 'none'}
                      onValueChange={(v) => setForm({ ...form, category: v === 'none' ? '' : v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                    <Select
                      value={form.categoryConfigId || 'none'}
                      onValueChange={(v) =>
                        setForm({ ...form, categoryConfigId: v === 'none' ? '' : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sin categoria SLA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin categoria SLA</SelectItem>
                        {categoryConfigs.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} —{' '}
                            <span className={cn('text-xs', criticalityConfig[c.criticality]?.className)}>
                              {criticalityConfig[c.criticality]?.label}
                            </span>
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
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <TabsList className="w-full sm:w-auto overflow-x-auto">
            {tabConfig.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-xs">
                {tab.dotColor && <div className={cn('h-1.5 w-1.5 rounded-full', tab.dotColor)} />}
                {tab.label}
                <span className="ml-0.5 text-[10px] opacity-60">({counts[tab.value as keyof typeof counts]})</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex items-center gap-2 sm:ml-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn('gap-1 h-9 shrink-0', hasActiveFilters && 'border-primary text-primary')}
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Filtros</span>
                  {hasActiveFilters && (
                    <span className="rounded-full bg-primary text-primary-foreground w-4 h-4 text-[10px] flex items-center justify-center">
                      {(filterPriority ? 1 : 0) + (filterCategory ? 1 : 0) + (filterClient ? 1 : 0)}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Criticidad</DropdownMenuLabel>
                {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
                  <DropdownMenuCheckboxItem
                    key={p}
                    checked={filterPriority === p}
                    onCheckedChange={(checked) => setFilterPriority(checked ? p : null)}
                  >
                    {criticalityConfig[p]?.label || p}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Tipo</DropdownMenuLabel>
                {(['SUPPORT_REQUEST', 'NEW_DEVELOPMENT'] as const).map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t}
                    checked={filterCategory === t}
                    onCheckedChange={(checked) => setFilterCategory(checked ? t : null)}
                  >
                    {categoryLabelMap[t] || t}
                  </DropdownMenuCheckboxItem>
                ))}
                {clients.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Cliente</DropdownMenuLabel>
                    {clients.slice(0, 10).map((c) => (
                      <DropdownMenuCheckboxItem
                        key={c.id}
                        checked={filterClient === c.id}
                        onCheckedChange={(checked) => setFilterClient(checked ? c.id : null)}
                      >
                        {c.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </>
                )}
                {hasActiveFilters && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={false}
                      onCheckedChange={() => {
                        setFilterPriority(null);
                        setFilterCategory(null);
                        setFilterClient(null);
                      }}
                    >
                      Limpiar filtros
                    </DropdownMenuCheckboxItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Menu "Mas" — para acceder a Todos (admin only feel) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 gap-1">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Vistas adicionales</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleTabChange('all')}>
                  Ver todos los tickets
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Banner para tab "Todos" */}
        {activeTab === 'all' && (
          <div className="mt-3 rounded-md bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning">
            Vista completa — incluye tickets de todos los estados (cerrados y resueltos antiguos también).
          </div>
        )}

        {/* Lista */}
        <div className="mt-4">
          {filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <TicketIcon className="mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {search || hasActiveFilters
                  ? 'No se encontraron tickets con esos filtros'
                  : activeTab === 'all'
                  ? 'No hay tickets de soporte aun'
                  : `No hay tickets ${tabConfig.find((t) => t.value === activeTab)?.label.toLowerCase() ?? ''}`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTickets.map(renderTicketCard)}
              {nextCursor && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Cargando...
                      </>
                    ) : (
                      `Cargar más`
                    )}
                  </Button>
                </div>
              )}
              <p className="text-center text-[11px] text-muted-foreground pt-2">
                Mostrando {filteredTickets.length} de {counts[activeTab as keyof typeof counts] ?? counts.all}
              </p>
            </div>
          )}
        </div>
      </Tabs>

      {/* Panel lateral */}
      <TicketSidePanel
        ticketId={panelTicketId}
        open={panelOpen}
        onOpenChange={closePanel}
        onTicketUpdated={() => {
          loadTickets();
          loadStats();
        }}
      />
    </div>
  );
}
