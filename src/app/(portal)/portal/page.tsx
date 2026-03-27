'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FolderKanban,
  MessageSquarePlus,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  Bell,
  Activity,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from '@/hooks/use-toast';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

// Datos de demostracion para el grafico con el estilo visual (AreaChart)
const mockChartData = [
  { name: 'Ene', projects: 12, tasks: 30, activity: 20 },
  { name: 'Feb', projects: 19, tasks: 45, activity: 38 },
  { name: 'Mar', projects: 15, tasks: 38, activity: 49 },
  { name: 'Abr', projects: 25, tasks: 60, activity: 72 },
  { name: 'May', projects: 22, tasks: 52, activity: 65 },
  { name: 'Jun', projects: 30, tasks: 75, activity: 90 },
];

export default function PortalDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState({
    projects: [] as any[],
    suggestions: [] as any[],
    notifications: [] as any[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [projRes, sugRes, notifRes] = await Promise.all([
          api.get('/portal/projects'),
          api.get('/portal/suggestions'),
          api.get('/notifications?limit=5').catch(() => ({ data: { data: [] } })),
        ]);
        
        setData({
          projects: Array.isArray(projRes.data) ? projRes.data : projRes.data?.data || [],
          suggestions: Array.isArray(sugRes.data) ? sugRes.data : sugRes.data?.data || [],
          notifications: notifRes.data?.data || [],
        });
      } catch (err) {
        toast.error('Error', 'No se pudieron cargar los datos del dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const pendingSuggestions = data.suggestions.filter((s: any) => s.status === 'PENDING').length;
  const unreadNotifications = data.notifications.filter((n: any) => !n.readAt).length;

  const totalTasks = data.projects.reduce((sum, p) => sum + p.visibleTasks, 0);
  const completedTasks = data.projects.reduce((sum, p) => sum + p.completedTasks, 0);
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Custom Recharts Tooltip para que se vea premium
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-xl dark:border-gray-800 dark:bg-gray-950">
          <p className="mb-2 text-xs font-bold text-gray-800 dark:text-gray-200">{label}</p>
          <div className="space-y-1 text-xs">
            <p className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span>
              <span className="text-gray-500 dark:text-gray-400">Actividad:</span>
              <span className="font-semibold text-gray-800 dark:text-white">{payload[0].value}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      {/* HEADER DE SALUDO */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Panel de Control
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Resumen de actividad y estado de todos tus servicios con Zentik.
          </p>
        </div>
      </div>

      {/* 4 KPI CARDS (SIMILARES A LA IMAGEN) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Card 1: Tone Blue (como 'Views') */}
        <div className="relative overflow-hidden rounded-[20px] bg-blue-500 p-5 shadow-lg shadow-blue-500/20 text-white">
          <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-blue-400/30 blur-2xl"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-blue-100">Proyectos Activos</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <FolderKanban className="h-4 w-4 text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold">{data.projects.length}</h3>
            <p className="mt-1 text-xs font-medium text-blue-100 flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> En curso
            </p>
          </div>
        </div>

        {/* Card 2: Dark Tone (como 'Visits') */}
        <div className="relative overflow-hidden rounded-[20px] bg-gray-900 dark:bg-gray-950 p-5 shadow-xl text-white border border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-400">Progreso Gral.</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10">
              <Activity className="h-4 w-4 text-gray-300" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold">{overallProgress}%</h3>
            <p className="mt-1 text-xs font-medium text-gray-400 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-400" /> Tareas avanzadas
            </p>
          </div>
        </div>

        {/* Card 3: Dark Tone (como 'New Users') */}
        <div className="relative overflow-hidden rounded-[20px] bg-gray-900 dark:bg-gray-950 p-5 shadow-xl text-white border border-gray-800">
           <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-400">Total Tareas Listas</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10">
              <CheckCircle2 className="h-4 w-4 text-gray-300" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold">{completedTasks}</h3>
            <p className="mt-1 text-xs font-medium text-gray-400 flex items-center gap-1">
               <span className="text-blue-400">+{completedTasks}</span> de {totalTasks}
            </p>
          </div>
        </div>

        {/* Card 4: Light Blue (como 'Active Users') */}
        <div className="relative overflow-hidden rounded-[20px] bg-blue-400 p-5 shadow-lg shadow-blue-400/20 text-white">
          <div className="absolute bottom-0 right-0 h-24 w-24 translate-x-4 translate-y-4 rounded-full bg-white/20 blur-xl"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-blue-50">Sugerencias Totales</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <MessageSquarePlus className="h-4 w-4 text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-3xl font-bold">{data.suggestions.length}</h3>
            <p className="mt-1 text-xs font-medium text-blue-50 flex items-center gap-1">
              <span className="font-bold">{pendingSuggestions}</span> pendientes
            </p>
          </div>
        </div>
      </div>

      {/* SECCION CENTRAL (GRAFICO Y ACCIONES RAPIDAS) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 rounded-[24px] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800 dark:text-white">Estado Operativo de Proyectos</h2>
            <div className="flex items-center gap-4 text-xs font-semibold text-gray-400">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span> Actividad
              </div>
            </div>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" className="dark:stroke-gray-800" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#9ca3af', fontWeight: 500 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#9ca3af', fontWeight: 500 }}
                />
                <RechartsTooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="activity" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorActivity)" 
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#2563eb' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Actions (Right Sidebar) */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white px-2">Acciones Rapidas</h2>
          
          <Link href="/portal/projects" className="group relative flex overflow-hidden rounded-[20px] bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-lg dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-blue-500/30 dark:hover:border-blue-500/30">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-50/50 transition-transform group-hover:scale-150 dark:bg-blue-900/10"></div>
            <div className="relative flex w-full items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30">
                  <FolderKanban className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Mis Proyectos</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Ver progreso y tareas</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-500 dark:text-gray-600" />
            </div>
          </Link>

          <Link href="/portal/suggestions" className="group relative flex overflow-hidden rounded-[20px] bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-lg dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-blue-500/30 dark:hover:border-blue-500/30">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-50/50 transition-transform group-hover:scale-150 dark:bg-blue-900/10"></div>
             <div className="relative flex w-full items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30">
                  <MessageSquarePlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Sugerencias</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{pendingSuggestions} pendientes</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-500 dark:text-gray-600" />
            </div>
          </Link>

          <Link href="/portal/notifications" className="group relative flex overflow-hidden rounded-[20px] bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-lg dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-blue-500/30 dark:hover:border-blue-500/30">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-50/50 transition-transform group-hover:scale-150 dark:bg-blue-900/10"></div>
             <div className="relative flex w-full items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/30">
                  <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 ring-4 ring-white dark:ring-gray-900"></span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Notificaciones</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{unreadNotifications} sin leer</p>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-blue-500 dark:text-gray-600" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
