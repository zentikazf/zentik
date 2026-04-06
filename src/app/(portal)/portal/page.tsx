'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import {
 FolderKanban,
 Ticket,
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

export default function PortalDashboard() {
 const { user } = useAuth();
 const [data, setData] = useState({
  projects: [] as any[],
  tickets: [] as any[],
  notifications: [] as any[],
  hours: null as any,
 });
 const [loading, setLoading] = useState(true);

 useEffect(() => {
  async function load() {
   try {
    const [projRes, ticketRes, notifRes, hoursRes] = await Promise.all([
     api.get('/portal/projects'),
     api.get('/portal/tickets'),
     api.get('/notifications?limit=5').catch(() => ({ data: { data: [] } })),
     api.get('/portal/hours').catch(() => ({ data: null })),
    ]);

    setData({
     projects: Array.isArray(projRes.data) ? projRes.data : projRes.data?.data || [],
     tickets: Array.isArray(ticketRes.data) ? ticketRes.data : ticketRes.data?.data || [],
     notifications: notifRes.data?.data || [],
     hours: hoursRes.data,
    });
   } catch (err) {
    toast.error('Error', 'No se pudieron cargar los datos del dashboard');
   } finally {
    setLoading(false);
   }
  }
  load();
 }, []);

 const openTickets = data.tickets.filter((t: any) => t.status === 'OPEN').length;
 const unreadNotifications = data.notifications.filter((n: any) => !n.readAt).length;

 const totalTasks = data.projects.reduce((sum: number, p: any) => sum + p.visibleTasks, 0);
 const completedTasks = data.projects.reduce((sum: number, p: any) => sum + p.completedTasks, 0);
 const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

 if (loading) {
  return (
   <div className="mx-auto max-w-6xl space-y-6">
    <Skeleton className="h-10 w-48 rounded-xl"/>
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
     {Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={i} className="h-28 rounded-xl"/>
     ))}
    </div>
    <div className="grid gap-4 md:grid-cols-3">
     {Array.from({ length: 3 }).map((_, i) => (
      <Skeleton key={i} className="h-24 rounded-xl"/>
     ))}
    </div>
   </div>
  );
 }

 return (
  <div className="mx-auto max-w-6xl space-y-8 pb-4">
   {/* Header */}
   <div>
    <h1 className="text-2xl font-bold text-foreground">
     Panel de Control
    </h1>
    <p className="mt-1 text-sm text-muted-foreground">
     Resumen de actividad y estado de tus servicios.
    </p>
   </div>

   {/* 4 KPI Cards */}
   <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
    {/* Card 1: Proyectos Activos */}
    <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/30">
     <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-medium text-muted-foreground">Proyectos Activos</span>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
       <FolderKanban className="h-4 w-4 text-primary"/>
      </div>
     </div>
     <h3 className="text-3xl font-bold text-foreground">{data.projects.length}</h3>
     <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
      <TrendingUp className="h-3 w-3 text-primary"/> En curso
     </p>
    </div>

    {/* Card 2: Progreso General */}
    <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/30">
     <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-medium text-muted-foreground">Progreso General</span>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
       <Activity className="h-4 w-4 text-primary"/>
      </div>
     </div>
     <h3 className="text-3xl font-bold text-foreground">{overallProgress}%</h3>
     <p className="mt-1 text-xs text-muted-foreground">Tareas avanzadas</p>
    </div>

    {/* Card 3: Total Tareas Listas */}
    <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/30">
     <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-medium text-muted-foreground">Tareas Listas</span>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
       <CheckCircle2 className="h-4 w-4 text-primary"/>
      </div>
     </div>
     <h3 className="text-3xl font-bold text-foreground">{completedTasks}</h3>
     <p className="mt-1 text-xs text-muted-foreground">
      de {totalTasks} totales
     </p>
    </div>

    {/* Card 4: Horas Disponibles */}
    <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-muted/30">
     <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-medium text-muted-foreground">Horas Disponibles</span>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
       <Clock className="h-4 w-4 text-primary"/>
      </div>
     </div>
     <h3 className="text-3xl font-bold text-foreground">{data.hours ? data.hours.availableHours.toFixed(0) : 0}h</h3>
     <p className="mt-1 text-xs text-muted-foreground">
      de {data.hours?.contractedHours ?? 0}h contratadas
     </p>
    </div>
   </div>

   {/* Quick Actions */}
   <div>
    <h2 className="text-lg font-semibold text-foreground mb-4">Acciones Rapidas</h2>
    <div className="grid gap-4 md:grid-cols-3">
     <Link href="/portal/projects" className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:bg-muted/30 hover:border-primary/30">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
       <FolderKanban className="h-5 w-5 text-primary"/>
      </div>
      <div className="flex-1 min-w-0">
       <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Mis Proyectos</h3>
       <p className="text-xs text-muted-foreground mt-0.5">Ver progreso y tareas</p>
      </div>
      <ArrowRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary shrink-0"/>
     </Link>

     <Link href="/portal/tickets" className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:bg-muted/30 hover:border-primary/30">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
       <Ticket className="h-5 w-5 text-primary"/>
      </div>
      <div className="flex-1 min-w-0">
       <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Tickets</h3>
       <p className="text-xs text-muted-foreground mt-0.5">{openTickets} abiertos</p>
      </div>
      <ArrowRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary shrink-0"/>
     </Link>

     <Link href="/portal/notifications" className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-all hover:bg-muted/30 hover:border-primary/30">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
       <Bell className="h-5 w-5 text-primary"/>
       {unreadNotifications > 0 && (
        <span className="absolute -top-1 -right-1 h-4 min-w-4 flex items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
         {unreadNotifications}
        </span>
       )}
      </div>
      <div className="flex-1 min-w-0">
       <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">Notificaciones</h3>
       <p className="text-xs text-muted-foreground mt-0.5">{unreadNotifications} sin leer</p>
      </div>
      <ArrowRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary shrink-0"/>
     </Link>
    </div>
   </div>
  </div>
 );
}
