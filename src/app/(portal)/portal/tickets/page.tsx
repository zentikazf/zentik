'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Ticket, Plus, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  OPEN:        { label: 'Abierto',      color: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400' },
  IN_PROGRESS: { label: 'En Proceso',   color: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400' },
  RESOLVED:    { label: 'Resuelto',     color: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400' },
  CLOSED:      { label: 'Cerrado',      color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  SUPPORT_REQUEST: { label: 'Soporte',     color: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400' },
  NEW_DEVELOPMENT: { label: 'Desarrollo',  color: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400' },
};

interface TicketItem {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  project?: { id: string; name: string };
  task?: { id: string; status: string } | null;
}

interface ProjectOption {
  id: string;
  name: string;
}

export default function PortalTicketsPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    projectId: '',
    title: '',
    description: '',
    category: '',
    priority: 'MEDIUM',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [ticketsRes, projectsRes] = await Promise.all([
        api.get<any>('/portal/tickets'),
        api.get<any>('/portal/projects'),
      ]);
      setTickets(Array.isArray(ticketsRes.data) ? ticketsRes.data : ticketsRes.data?.data || []);
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : projectsRes.data?.data || []);
    } catch {
      toast.error('Error', 'Error al cargar los tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.projectId || !form.title.trim() || !form.category) {
      toast.error('Error', 'Completa todos los campos requeridos');
      return;
    }

    setCreating(true);
    try {
      await api.post<any>(`/portal/projects/${form.projectId}/tickets`, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        priority: form.priority,
      });
      toast.success('Ticket creado', 'Tu ticket fue enviado al equipo');
      setShowCreate(false);
      setForm({ projectId: '', title: '', description: '', category: '', priority: 'MEDIUM' });
      await loadData();
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al crear el ticket');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-[20px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-4">
      {/* Header */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Mis Tickets</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Seguimiento de solicitudes de soporte y desarrollo
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 dark:bg-blue-950/50">
            <Ticket className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              {tickets.length} Total
            </span>
          </div>
          {projects.length > 0 && (
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button className="rounded-full">
                  <Plus className="mr-2 h-4 w-4" /> Nuevo Ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Crear Ticket</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label className="text-gray-500 dark:text-gray-400">Proyecto</Label>
                    <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un proyecto" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-500 dark:text-gray-400">Tipo de solicitud</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SUPPORT_REQUEST">Soporte / Error</SelectItem>
                        <SelectItem value="NEW_DEVELOPMENT">Nueva Funcionalidad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-500 dark:text-gray-400">Titulo</Label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Describe brevemente tu solicitud"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-500 dark:text-gray-400">Descripcion detallada</Label>
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Explica con mas detalle el problema o funcionalidad que necesitas..."
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-500 dark:text-gray-400">Prioridad</Label>
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
                  <Button type="submit" className="w-full rounded-full" disabled={creating}>
                    {creating ? 'Enviando...' : 'Enviar Ticket'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Empty state */}
      {tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] bg-white py-20 text-center dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
            <Ticket className="h-7 w-7 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Sin tickets aun</h3>
          <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Crea tu primer ticket para reportar un problema o solicitar una nueva funcionalidad.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
            const catConf = CATEGORY_CONFIG[ticket.category] || CATEGORY_CONFIG.SUPPORT_REQUEST;

            return (
              <Link key={ticket.id} href={`/portal/tickets/${ticket.id}`}>
                <div className="group flex items-center gap-4 rounded-[20px] bg-white p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800">
                  {/* Status indicator */}
                  <div className={`h-2 w-2 rounded-full shrink-0 ${
                    ticket.status === 'OPEN' ? 'bg-blue-500' :
                    ticket.status === 'IN_PROGRESS' ? 'bg-yellow-500' :
                    ticket.status === 'RESOLVED' ? 'bg-green-500' : 'bg-gray-400'
                  }`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${catConf.color} border-none text-[10px] uppercase tracking-wider font-bold`}>
                        {catConf.label}
                      </Badge>
                      <Badge className={`${statusConf.color} border-none text-[10px] font-semibold`}>
                        {statusConf.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{ticket.title}</p>
                    {ticket.project && (
                      <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">{ticket.project.name}</p>
                    )}
                  </div>

                  {/* Date + arrow */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {new Date(ticket.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Info box when no projects */}
      {projects.length === 0 && tickets.length === 0 && (
        <div className="flex items-start gap-3 rounded-[16px] bg-blue-50 p-4 dark:bg-blue-950/30">
          <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            No tienes proyectos activos. Contacta con tu equipo para que te asignen un proyecto antes de crear tickets.
          </p>
        </div>
      )}
    </div>
  );
}
