'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, FolderKanban } from 'lucide-react';
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
  const [form, setForm] = useState({ name: '', description: '', clientId: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

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
      });
      toast.success('Proyecto creado', `El proyecto "${result.data.name}" se creó exitosamente`);
      setShowCreate(false);
      setForm({ name: '', description: '', clientId: '' });
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

  const statusColors: Record<string, string> = {
    DEFINITION: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
    DEVELOPMENT: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400',
    PRODUCTION: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    ON_HOLD: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
    COMPLETED: 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  };

  const statusLabels: Record<string, string> = {
    DEFINITION: 'Definición',
    DEVELOPMENT: 'Desarrollo',
    PRODUCTION: 'Producción',
    ON_HOLD: 'En Pausa',
    COMPLETED: 'Completado',
  };

  if (loading || !orgId) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-full max-w-sm rounded-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-[25px]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Proyectos</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Gestiona y organiza tus proyectos</p>
        </div>
        <Dialog open={showCreate} onOpenChange={(open) => {
          setShowCreate(open);
          if (!open) {
            setFormErrors({});
          }
        }}>
          <DialogTrigger asChild>
            <Button className="rounded-full"><Plus className="mr-2 h-4 w-4" /> Nuevo Proyecto</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Proyecto</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-500 dark:text-gray-400">Nombre del proyecto</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mi nuevo proyecto" />
                {formErrors.name && <p className="text-sm text-red-600 dark:text-red-400">{formErrors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-gray-500 dark:text-gray-400">Descripción</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe brevemente el proyecto..." />
                {formErrors.description && <p className="text-sm text-red-600 dark:text-red-400">{formErrors.description}</p>}
              </div>
              {clients.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-gray-500 dark:text-gray-400">Cliente</Label>
                  <Select value={form.clientId || 'none'} onValueChange={(v) => setForm({ ...form, clientId: v })}>
                    <SelectTrigger><SelectValue placeholder="Sin cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin cliente</SelectItem>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full rounded-full" disabled={creating}>
                {creating ? 'Creando...' : 'Crear Proyecto'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input placeholder="Buscar proyectos..." className="rounded-full bg-white pl-9 dark:bg-gray-900" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[25px] bg-white py-16 dark:bg-gray-900">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
            <FolderKanban className="h-7 w-7 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-[15px] font-medium text-gray-800 dark:text-white">No se encontraron proyectos</p>
          <p className="mt-1 text-sm text-gray-400">Crea tu primer proyecto para comenzar</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="rounded-[25px] bg-white p-5 transition-shadow hover:shadow-md dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between">
                  <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">{project.slug}</Badge>
                  <Badge className={statusColors[project.status] || 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}>
                    {statusLabels[project.status] || project.status}
                  </Badge>
                </div>
                <h3 className="text-[15px] font-semibold text-gray-800 dark:text-white">{project.name}</h3>
                {project.client?.name && (
                  <p className="text-[12px] text-blue-500 dark:text-blue-400">{project.client.name}</p>
                )}
                <p className="mt-1 line-clamp-2 text-[13px] text-gray-400">
                  {project.description || 'Sin descripción'}
                </p>
                <div className="mt-4 flex items-center justify-between text-[13px] text-gray-400">
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
