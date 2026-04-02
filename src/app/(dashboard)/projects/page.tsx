'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, FolderKanban, Columns3, List } from 'lucide-react';
import { PhaseBadge } from '@/components/ui/phase-badge';
import { ProjectKanban } from '@/components/project/project-kanban';
import { api, ApiError } from '@/lib/api-client';
import { useOrg } from '@/providers/org-provider';
import { toast } from '@/hooks/use-toast';
import { createProjectSchema } from '@/lib/validations';
import { formatRelative } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProjectsPage() {
 const { orgId } = useOrg();
 const router = useRouter();
 const [projects, setProjects] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState('');
 const [showCreate, setShowCreate] = useState(false);
 const [creating, setCreating] = useState(false);
 const [form, setForm] = useState({ name: '', description: '', clientId: '', hourlyRate: '', estimatedHours: '' });
 const [formErrors, setFormErrors] = useState<Record<string, string>>({});
 const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
 const [view, setView] = useState<'list' | 'kanban'>('list');

 useEffect(() => {
 if (orgId) {
 loadProjects();
 api.get(`/organizations/${orgId}/clients?limit=200`).then((res) => {
 const list = res.data?.data || (Array.isArray(res.data) ? res.data : []);
 setClients(list);
 }).catch(() => {});
 }
 }, [orgId]);

 const loadProjects = async () => {
 if (!orgId) return;
 try {
 const res = await api.get<any>(`/organizations/${orgId}/projects`);
 setProjects(Array.isArray(res.data) ? res.data : res.data?.data || []);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cargar proyectos';
 toast.error('Error', message);
 } finally {
 setLoading(false);
 }
 };

 const handleCreate = async (e: React.FormEvent) => {
 e.preventDefault();
 setFormErrors({});

 const result = createProjectSchema.safeParse(form);
 if (!result.success) {
 const errors: Record<string, string> = {};
 result.error.issues.forEach((issue) => {
 const field = issue.path[0] as string;
 if (!errors[field]) {
 errors[field] = issue.message;
 }
 });
 setFormErrors(errors);
 return;
 }

 if (!orgId) return;

 setCreating(true);
 try {
 const res = await api.post<any>(`/organizations/${orgId}/projects`, {
 name: result.data.name,
 description: result.data.description,
 ...(form.clientId && form.clientId !== 'none' && { clientId: form.clientId }),
 ...(form.hourlyRate && { hourlyRate: Number(form.hourlyRate) }),
 ...(form.estimatedHours && { estimatedHours: Number(form.estimatedHours) }),
 });
 toast.success('Proyecto creado', `El proyecto"${result.data.name}"se creó exitosamente`);
 setShowCreate(false);
 setForm({ name: '', description: '', clientId: '', hourlyRate: '', estimatedHours: '' });
 setFormErrors({});
 router.push(`/projects/${res.data.id}`);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al crear el proyecto';
 toast.error('Error', message);
 } finally {
 setCreating(false);
 }
 };

 const filtered = projects.filter((p) =>
 p.name.toLowerCase().includes(search.toLowerCase()),
 );

 const statusLabels: Record<string, string> = {
 DISCOVERY: 'Descubrimiento',
 PLANNING: 'Planificacion',
 DEVELOPMENT: 'Desarrollo',
 TESTING: 'Testing',
 DEPLOY: 'Deploy',
 SUPPORT: 'Soporte',
 ON_HOLD: 'En Pausa',
 COMPLETED: 'Completado',
 };

 if (loading || !orgId) {
 return (
 <div className="space-y-4 max-w-7xl">
 <Skeleton className="h-10 w-full max-w-sm rounded-xl"/>
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl"/>)}
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-4 max-w-7xl">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">Proyectos</h1>
 <p className="mt-1 text-sm text-muted-foreground">Gestiona y organiza tus proyectos</p>
 </div>
 <Dialog open={showCreate} onOpenChange={(open) => {
 setShowCreate(open);
 if (!open) {
 setFormErrors({});
 }
 }}>
 <DialogTrigger asChild>
 <div className="flex items-center gap-2">
 <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
 <button
 onClick={() => setView('list')}
 className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
 view === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 <List className="h-3.5 w-3.5"/>
 </button>
 <button
 onClick={() => setView('kanban')}
 className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
 view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
 }`}
 >
 <Columns3 className="h-3.5 w-3.5"/>
 </button>
 </div>
 <Button><Plus className="mr-2 h-4 w-4"/> Nuevo Proyecto</Button>
 </div>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Crear Proyecto</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleCreate} className="space-y-4">
 <div className="space-y-2">
 <Label className="text-muted-foreground">Nombre del proyecto</Label>
 <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mi nuevo proyecto"/>
 {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
 </div>
 <div className="space-y-2">
 <Label className="text-muted-foreground">Descripcion</Label>
 <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe brevemente el proyecto..."/>
 {formErrors.description && <p className="text-sm text-destructive">{formErrors.description}</p>}
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label className="text-muted-foreground">Horas estimadas</Label>
 <Input type="number"value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} placeholder="Ej: 120"min={0} />
 </div>
 <div className="space-y-2">
 <Label className="text-muted-foreground">Precio/hora (&#8370;)</Label>
 <Input type="number"value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} placeholder="Ej: 150000"min={0} />
 </div>
 </div>
 {clients.length > 0 && (
 <div className="space-y-2">
 <Label className="text-muted-foreground">Cliente</Label>
 <Select value={form.clientId || 'none'} onValueChange={(v) => setForm({ ...form, clientId: v })}>
 <SelectTrigger><SelectValue placeholder="Sin cliente"/></SelectTrigger>
 <SelectContent>
 <SelectItem value="none">Sin cliente</SelectItem>
 {clients.map((c) => (
 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 )}
 <Button type="submit"className="w-full"disabled={creating}>
 {creating ? 'Creando...' : 'Crear Proyecto'}
 </Button>
 </form>
 </DialogContent>
 </Dialog>
 </div>

 <div className="relative max-w-sm">
 <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
 <Input placeholder="Buscar proyectos..."className="pl-9 h-9"value={search} onChange={(e) => setSearch(e.target.value)} />
 </div>

 {view === 'kanban' ? (
 <ProjectKanban projects={filtered} onProjectMoved={loadProjects} />
 ) : filtered.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16">
 <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
 <FolderKanban className="h-7 w-7 text-primary"/>
 </div>
 <p className="text-[15px] font-medium text-foreground">No se encontraron proyectos</p>
 <p className="mt-1 text-sm text-muted-foreground">Crea tu primer proyecto para comenzar</p>
 </div>
 ) : (
 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
 {filtered.map((project) => (
 <Link key={project.id} href={`/projects/${project.id}`}>
 <div className="rounded-xl border border-border bg-card p-5 hover:bg-muted/30 transition-colors cursor-pointer">
 <div className="mb-3 flex items-center justify-between">
 <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{project.slug}</span>
 <PhaseBadge phase={project.status} label={statusLabels[project.status] || project.status} />
 </div>
 <h3 className="text-[15px] font-semibold text-foreground">{project.name}</h3>
 {project.client?.name && (
 <p className="text-[12px] text-primary">{project.client.name}</p>
 )}
 <p className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
 {project.description || 'Sin descripcion'}
 </p>
 <div className="mt-4 flex items-center justify-between text-[13px] text-muted-foreground">
 <span>{project._count?.tasks || 0} tareas</span>
 <span>{formatRelative(project.updatedAt)}</span>
 </div>
 </div>
 </Link>
 ))}
 </div>
 )}
 </div>
 );
}
