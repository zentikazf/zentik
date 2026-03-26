'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { LabelManager } from '@/components/labels/label-manager';
import { useProject } from '@/providers/project-provider';

const PROJECT_STATUSES = [
  { value: 'DEFINITION', label: 'Definición' },
  { value: 'DEVELOPMENT', label: 'Desarrollo' },
  { value: 'PRODUCTION', label: 'Producción' },
  { value: 'ON_HOLD', label: 'En Pausa' },
  { value: 'COMPLETED', label: 'Completado' },
];

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const { refetch } = useProject();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', status: '' });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/projects/${projectId}`);
        setProject(res.data);
        setForm({ name: res.data.name, description: res.data.description || '', status: res.data.status || 'DEFINITION' });
      } catch (err) {
        const message = err instanceof ApiError ? err.message : 'Error al cargar proyecto';
        toast.error('Error', message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [projectId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/projects/${projectId}`, form);
      refetch();
      toast.success('Proyecto actualizado');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al guardar proyecto';
      toast.error('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar este proyecto? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete(`/projects/${projectId}`);
      toast.success('Proyecto eliminado');
      router.push('/projects');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al eliminar proyecto';
      toast.error('Error', message);
    }
  };

  if (loading) return <Skeleton className="h-64 rounded-[25px]" />;

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <div>
        <h1 className="text-[22px] font-semibold text-gray-800 dark:text-white">Configuración del Proyecto</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Actualiza los datos de tu proyecto</p>
      </div>

      <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
            <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Información General</h2>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-500 dark:text-gray-400">Nombre del Proyecto</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          {project?.slug && (
            <div className="space-y-2">
              <Label className="text-gray-500 dark:text-gray-400">Slug</Label>
              <Input value={project.slug} disabled className="max-w-48 bg-gray-50 dark:bg-gray-800" />
              <p className="text-xs text-gray-400">El slug se genera automáticamente y no se puede cambiar</p>
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-gray-500 dark:text-gray-400">Descripción</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-500 dark:text-gray-400">Estado del Proyecto</Label>
            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={saving} className="rounded-full">{saving ? 'Guardando...' : 'Guardar Cambios'}</Button>
        </form>
      </div>

      {/* Labels */}
      <div className="rounded-[25px] bg-white p-6 dark:bg-gray-900">
        <LabelManager />
      </div>

      <div className="rounded-[25px] border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-gray-900">
        <h2 className="mb-2 text-lg font-semibold text-red-600 dark:text-red-400">Zona de Peligro</h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Una vez eliminado el proyecto, no hay vuelta atrás.</p>
        <Button variant="destructive" className="rounded-full" onClick={handleDelete}>
          <Trash2 className="mr-2 h-4 w-4" /> Eliminar Proyecto
        </Button>
      </div>
    </div>
  );
}
