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
 OPEN: { label: 'Abierto', color: 'bg-primary/10 text-primary' },
 IN_PROGRESS: { label: 'En Proceso', color: 'bg-warning/10 text-warning' },
 RESOLVED: { label: 'Resuelto', color: 'bg-success/10 text-success' },
 CLOSED: { label: 'Cerrado', color: 'bg-muted text-muted-foreground' },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
 SUPPORT_REQUEST: { label: 'Soporte', color: 'bg-warning/10 text-warning ' },
 NEW_DEVELOPMENT: { label: 'Desarrollo', color: 'bg-info/10 text-info ' },
 NEW_PROJECT: { label: 'Nuevo Proyecto', color: 'bg-primary/10 text-primary ' },
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
 projectName: '',
 projectDescription: '',
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
 setForm({ projectId: '', title: '', description: '', category: '', priority: 'MEDIUM', projectName: '', projectDescription: '' });
 await loadData();
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al enviar la solicitud');
 } finally {
 setCreating(false);
 }
 return;
 }

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
 setForm({ projectId: '', title: '', description: '', category: '', priority: 'MEDIUM', projectName: '', projectDescription: '' });
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
 <Skeleton className="h-10 w-48 rounded-xl"/>
 <div className="space-y-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-24 rounded-xl"/>
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
 <h1 className="text-2xl font-bold text-foreground">Mis Tickets</h1>
 <p className="text-sm text-muted-foreground mt-1">
 Seguimiento de solicitudes de soporte y desarrollo
 </p>
 </div>
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1.5">
 <Ticket className="h-4 w-4 text-primary"/>
 <span className="text-sm font-semibold text-primary">
 {tickets.length} Total
 </span>
 </div>
 <Dialog open={showCreate} onOpenChange={setShowCreate}>
 <DialogTrigger asChild>
 <Button className="rounded-full">
 <Plus className="mr-2 h-4 w-4"/> Nuevo Ticket
 </Button>
 </DialogTrigger>
 <DialogContent className="sm:max-w-md">
 <DialogHeader>
 <DialogTitle>Crear Ticket</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleCreate} className="space-y-4 pt-2">
 <div className="space-y-2">
 <Label className="text-muted-foreground">Tipo de solicitud</Label>
 <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
 <SelectTrigger>
 <SelectValue placeholder="Selecciona el tipo"/>
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="SUPPORT_REQUEST">Soporte / Error</SelectItem>
 <SelectItem value="NEW_PROJECT">Nuevo Proyecto</SelectItem>
 </SelectContent>
 </Select>
 </div>

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
 <Label className="text-muted-foreground">Descripción del proyecto</Label>
 <Textarea
 value={form.projectDescription}
 onChange={(e) => setForm({ ...form, projectDescription: e.target.value })}
 placeholder="Describe qué necesitas en este proyecto..."
 rows={4}
 />
 </div>
 </>
 ) : form.category ? (
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
 <div className="space-y-2">
 <Label className="text-muted-foreground">Prioridad</Label>
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
 </>
 ) : null}

 {form.category && (
 <Button type="submit" className="w-full rounded-full" disabled={creating}>
 {creating ? 'Enviando...' : form.category === 'NEW_PROJECT' ? 'Solicitar Proyecto' : 'Enviar Ticket'}
 </Button>
 )}
 </form>
 </DialogContent>
 </Dialog>
 </div>
 </div>

 {/* Empty state */}
 {tickets.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-xl bg-card py-20 text-center border border-border">
 <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
 <Ticket className="h-7 w-7 text-primary"/>
 </div>
 <h3 className="text-lg font-semibold text-foreground">Sin tickets aun</h3>
 <p className="mt-2 max-w-sm text-sm text-muted-foreground">
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
 <div className="group flex items-center gap-4 rounded-xl bg-card p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 border border-border hover:border-primary/30 ">
 {/* Status indicator */}
 <div className={`h-2 w-2 rounded-full shrink-0 ${
 ticket.status === 'OPEN' ? 'bg-primary' :
 ticket.status === 'IN_PROGRESS' ? 'bg-warning' :
 ticket.status === 'RESOLVED' ? 'bg-success' : 'bg-muted-foreground'
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
 <p className="text-sm font-semibold text-foreground truncate">{ticket.title}</p>
 {ticket.project && (
 <p className="text-xs text-primary mt-0.5">{ticket.project.name}</p>
 )}
 </div>

 {/* Date + arrow */}
 <div className="flex items-center gap-3 shrink-0">
 <span className="flex items-center gap-1 text-xs text-muted-foreground">
 <Clock className="h-3 w-3"/>
 {new Date(ticket.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
 </span>
 <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors"/>
 </div>
 </div>
 </Link>
 );
 })}
 </div>
 )}

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
