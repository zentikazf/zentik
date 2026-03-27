'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderKanban, MessageSquarePlus, Clock, CheckCircle2, ArrowRight } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DEFINITION: { label: 'Definicion', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950' },
  DEVELOPMENT: { label: 'Desarrollo', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950' },
  PRODUCTION: { label: 'Produccion', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950' },
  ON_HOLD: { label: 'En Pausa', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950' },
  COMPLETED: { label: 'Completado', color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
};

interface PortalProject {
  id: string;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  suggestionsCount: number;
  visibleTasks: number;
  completedTasks: number;
  progress: number;
}

export default function PortalProjectsPage() {
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/portal/projects');
        const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setProjects(data);
      } catch (err) {
        toast.error('Error', 'Error al cargar los proyectos');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-[20px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Mis Proyectos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestiona y visualiza el progreso de tus proyectos activos</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 dark:bg-blue-950/50">
          <FolderKanban className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{projects.length} Total</span>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[20px] bg-white py-20 text-center dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
            <FolderKanban className="h-7 w-7 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Sin proyectos</h3>
          <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Aun no tienes proyectos asignados. El equipo se pondra en contacto pronto.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const config = STATUS_CONFIG[project.status] || STATUS_CONFIG.DEFINITION;
            return (
              <Link
                key={project.id}
                href={`/portal/projects/${project.id}`}
                className="group flex flex-col justify-between relative rounded-[20px] bg-white p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 hover:-translate-y-1 dark:bg-gray-900 border border-gray-100 dark:border-gray-800"
              >
                <div>
                  <div className="mb-4 flex justify-between items-start gap-4">
                    <h3 className="text-lg font-bold leading-tight text-gray-800 group-hover:text-blue-600 transition-colors dark:text-white dark:group-hover:text-blue-400">
                      {project.name}
                    </h3>
                    <Badge className={`${config.bg} ${config.color} border-none text-[10px] uppercase tracking-wider font-bold shrink-0`}>
                      {config.label}
                    </Badge>
                  </div>

                  <div className="mb-6 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Progreso General</span>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{project.progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-1000 ease-out"
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs mt-4 pt-4 border-t border-gray-50 dark:border-gray-800">
                  <span className="flex items-center gap-1.5 text-gray-500">
                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{project.completedTasks}</span>/{project.visibleTasks}
                  </span>
                  {project.suggestionsCount > 0 && (
                    <span className="flex items-center gap-1.5 text-gray-500">
                      <MessageSquarePlus className="h-4 w-4 text-blue-500" />
                      <span className="font-semibold text-gray-700 dark:text-gray-300">{project.suggestionsCount}</span>
                    </span>
                  )}
                  {project.endDate && (
                    <span className="flex items-center gap-1.5 text-gray-500 ml-auto">
                      <Clock className="h-4 w-4 text-gray-400" />
                      {new Date(project.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
