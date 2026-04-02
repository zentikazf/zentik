'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Plus, Play, CheckCircle2, Calendar, Zap } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { createSprintSchema } from '@/lib/validations';
import { formatDate } from '@/lib/utils';

const statusBadgeColors: Record<string, string> = {
 PLANNING: 'bg-muted text-muted-foreground',
 ACTIVE: 'bg-success/10 text-success',
 COMPLETED: 'bg-primary/10 text-primary',
};

export default function SprintsPage() {
 const { projectId } = useParams<{ projectId: string }>();
 const [sprints, setSprints] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [showCreate, setShowCreate] = useState(false);
 const [form, setForm] = useState({ name: '', startDate: '', endDate: '', goal: '' });
 const [formErrors, setFormErrors] = useState<Record<string, string>>({});

 useEffect(() => {
 loadSprints();
 }, [projectId]);

 const loadSprints = async () => {
 try {
 const res = await api.get(`/projects/${projectId}/sprints`);
 setSprints(Array.isArray(res.data) ? res.data : res.data?.data || []);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cargar los sprints';
 toast.error('Error', message);
 } finally {
 setLoading(false);
 }
 };

 const handleCreate = async (e: React.FormEvent) => {
 e.preventDefault();
 setFormErrors({});

 const validation = createSprintSchema.safeParse(form);
 if (!validation.success) {
 const errors: Record<string, string> = {};
 validation.error.errors.forEach((err) => {
 const field = err.path[0] as string;
 errors[field] = err.message;
 });
 setFormErrors(errors);
 return;
 }

 try {
 await api.post(`/projects/${projectId}/sprints`, validation.data);
 toast.success('Sprint creado', 'El sprint se creó correctamente');
 setShowCreate(false);
 setForm({ name: '', startDate: '', endDate: '', goal: '' });
 setFormErrors({});
 loadSprints();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al crear el sprint';
 toast.error('Error', message);
 }
 };

 const handleStartSprint = async (sprintId: string) => {
 try {
 await api.post(`/sprints/${sprintId}/start`);
 toast.success('Sprint iniciado', 'El sprint se inició correctamente');
 loadSprints();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al iniciar el sprint';
 toast.error('Error', message);
 }
 };

 const handleCompleteSprint = async (sprintId: string) => {
 try {
 await api.post(`/sprints/${sprintId}/complete`);
 toast.success('Sprint completado', 'El sprint se completó correctamente');
 loadSprints();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al completar el sprint';
 toast.error('Error', message);
 }
 };

 if (loading) {
 return (
 <div className="space-y-4">
 {Array.from({ length: 3 }).map((_, i) => (
 <Skeleton key={i} className="h-40 rounded-xl"/>
 ))}
 </div>
 );
 }

 return (
 <div className="space-y-7">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">Sprints</h1>
 <p className="mt-1 text-sm text-muted-foreground">Planifica y gestiona los sprints del proyecto</p>
 </div>
 <Dialog open={showCreate} onOpenChange={setShowCreate}>
 <DialogTrigger asChild>
 <Button size="sm"className="rounded-full"><Plus className="mr-2 h-4 w-4"/> Nuevo Sprint</Button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader><DialogTitle>Crear Sprint</DialogTitle></DialogHeader>
 <form onSubmit={handleCreate} className="space-y-4">
 <div>
 <Label>Nombre</Label>
 <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
 {formErrors.name && <p className="mt-1 text-xs text-destructive">{formErrors.name}</p>}
 </div>
 <div className="grid grid-cols-2 gap-4">
 <div>
 <Label>Fecha Inicio</Label>
 <Input type="date"value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
 {formErrors.startDate && <p className="mt-1 text-xs text-destructive">{formErrors.startDate}</p>}
 </div>
 <div>
 <Label>Fecha Fin</Label>
 <Input type="date"value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
 {formErrors.endDate && <p className="mt-1 text-xs text-destructive">{formErrors.endDate}</p>}
 </div>
 </div>
 <div>
 <Label>Objetivo</Label>
 <Input value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
 {formErrors.goal && <p className="mt-1 text-xs text-destructive">{formErrors.goal}</p>}
 </div>
 <Button type="submit"className="w-full rounded-full">Crear Sprint</Button>
 </form>
 </DialogContent>
 </Dialog>
 </div>

 {sprints.length === 0 ? (
 <div className="flex flex-col items-center rounded-xl bg-card py-16 text-center">
 <Zap className="mb-3 h-10 w-10 text-muted-foreground/50"/>
 <p className="text-muted-foreground">No hay sprints aún</p>
 </div>
 ) : (
 <div className="space-y-4">
 {sprints.map((sprint) => (
 <div key={sprint.id} className="rounded-xl border border-border bg-card p-6">
 <div className="flex items-start justify-between">
 <div>
 <div className="flex items-center gap-2">
 <h3 className="text-[15px] font-semibold text-foreground">{sprint.name}</h3>
 <Badge className={statusBadgeColors[sprint.status] || statusBadgeColors.PLANNING}>{sprint.status}</Badge>
 </div>
 {sprint.goal && <p className="mt-1 text-sm text-muted-foreground">{sprint.goal}</p>}
 <div className="mt-2 flex items-center gap-4 text-[13px] text-muted-foreground">
 <span className="flex items-center gap-1"><Calendar className="h-3 w-3"/>{formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}</span>
 <span>{sprint._count?.tasks || sprint.tasks?.length || 0} tareas</span>
 </div>
 </div>
 <div className="flex gap-2">
 {sprint.status === 'PLANNING' && (
 <Button size="sm"variant="outline"className="rounded-full"onClick={() => handleStartSprint(sprint.id)}>
 <Play className="mr-1 h-3 w-3"/> Iniciar
 </Button>
 )}
 {sprint.status === 'ACTIVE' && (
 <Button size="sm"variant="outline"className="rounded-full"onClick={() => handleCompleteSprint(sprint.id)}>
 <CheckCircle2 className="mr-1 h-3 w-3"/> Completar
 </Button>
 )}
 </div>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 );
}
