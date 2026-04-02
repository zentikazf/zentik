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

 const totalTasks = data.projects.reduce((sum, p) => sum + p.visibleTasks, 0);
 const completedTasks = data.projects.reduce((sum, p) => sum + p.completedTasks, 0);
 const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
 
 // Custom Recharts Tooltip para que se vea premium
 const CustomTooltip = ({ active, payload, label }: any) => {
 if (active && payload && payload.length) {
 return (
 <div className="rounded-xl border border-border bg-card p-3 shadow-xl">
 <p className="mb-2 text-xs font-bold text-foreground">{label}</p>
 <div className="space-y-1 text-xs">
 <p className="flex items-center gap-2">
 <span className="h-2 w-2 rounded-full bg-primary"></span>
 <span className="text-muted-foreground">Actividad:</span>
 <span className="font-semibold text-foreground">{payload[0].value}</span>
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
 <Skeleton className="h-10 w-48 rounded-xl"/>
 <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-28 rounded-2xl"/>
 ))}
 </div>
 <Skeleton className="h-[400px] w-full rounded-3xl"/>
 </div>
 );
 }

 return (
 <div className="mx-auto max-w-6xl space-y-8 pb-4">
 {/* HEADER DE SALUDO */}
 <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
 <div>
 <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
 Panel de Control
 </h1>
 <p className="mt-1 text-sm text-muted-foreground">
 Resumen de actividad y estado de todos tus servicios con Zentik.
 </p>
 </div>
 </div>

 {/* 4 KPI CARDS (SIMILARES A LA IMAGEN) */}
 <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
 {/* Card 1: Tone Blue (como 'Views') */}
 <div className="group relative overflow-hidden rounded-xl bg-primary p-5 shadow-lg shadow-blue-500/20 text-white transition-all hover:shadow-blue-500/40 hover:-translate-y-1">
 <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-primary/30 blur-2xl transition-transform duration-500 group-hover:scale-110"></div>
 <div className="flex items-center justify-between mb-4">
 <span className="text-sm font-medium text-primary-foreground">Proyectos Activos</span>
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card/20 backdrop-blur-sm transition-colors group-hover:bg-card/30">
 <FolderKanban className="h-4 w-4 text-white"/>
 </div>
 </div>
 <div>
 <h3 className="text-3xl font-bold">{data.projects.length}</h3>
 <p className="mt-1 text-xs font-medium text-primary-foreground flex items-center gap-1">
 <TrendingUp className="h-3 w-3"/> En curso
 </p>
 </div>
 </div>

 {/* Card 2: Dark Tone (como 'Visits') */}
 <div className="group relative overflow-hidden rounded-xl bg-foreground p-5 shadow-xl text-white border border-border transition-all hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 hover:border-primary/30">
 <div className="flex items-center justify-between mb-4">
 <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-muted-foreground/50">Progreso Gral.</span>
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card/5 border border-white/10 transition-colors group-hover:bg-primary/20 group-hover:border-primary/50">
 <Activity className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors"/>
 </div>
 </div>
 <div>
 <h3 className="text-3xl font-bold">{overallProgress}%</h3>
 <p className="mt-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
 <TrendingUp className="h-3 w-3 text-cyan-400"/> Tareas avanzadas
 </p>
 </div>
 </div>

 {/* Card 3: Dark Tone (como 'New Users') */}
 <div className="group relative overflow-hidden rounded-xl bg-foreground p-5 shadow-xl text-white border border-border transition-all hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1 hover:border-primary/30">
 <div className="flex items-center justify-between mb-4">
 <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-muted-foreground/50">Total Tareas Listas</span>
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card/5 border border-white/10 transition-colors group-hover:bg-primary/20 group-hover:border-primary/50">
 <CheckCircle2 className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors"/>
 </div>
 </div>
 <div>
 <h3 className="text-3xl font-bold">{completedTasks}</h3>
 <p className="mt-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
 <span className="text-primary">+{completedTasks}</span> de {totalTasks}
 </p>
 </div>
 </div>

 {/* Card 4: Hours Remaining */}
 <div className={`group relative overflow-hidden rounded-xl p-5 shadow-lg text-white transition-all hover:-translate-y-1 ${
 data.hours && data.hours.availableHours > 0
 ? 'bg-success/100 shadow-emerald-500/20 hover:shadow-emerald-500/40'
 : 'bg-warning/100 shadow-orange-500/20 hover:shadow-orange-500/40'
 }`}>
 <div className="absolute bottom-0 right-0 h-24 w-24 translate-x-4 translate-y-4 rounded-full bg-card/20 blur-xl transition-transform duration-500 group-hover:scale-125"></div>
 <div className="flex items-center justify-between mb-4">
 <span className="text-sm font-medium text-white/80">Horas Disponibles</span>
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card/20 backdrop-blur-sm transition-colors group-hover:bg-card/30">
 <Clock className="h-4 w-4 text-white"/>
 </div>
 </div>
 <div>
 <h3 className="text-3xl font-bold">{data.hours ? data.hours.availableHours.toFixed(0) : 0}h</h3>
 <p className="mt-1 text-xs font-medium text-white/80 flex items-center gap-1">
 de <span className="font-bold">{data.hours?.contractedHours ?? 0}h</span> contratadas
 </p>
 </div>
 </div>
 </div>

 {/* SECCION CENTRAL (GRAFICO Y ACCIONES RAPIDAS) */}
 <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
 {/* Main Chart Area */}
 <div className="lg:col-span-2 rounded-[24px] bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border">
 <div className="mb-6 flex items-center justify-between">
 <h2 className="text-lg font-bold text-foreground">Estado Operativo de Proyectos</h2>
 <div className="flex items-center gap-4 text-xs font-semibold text-muted-foreground">
 <div className="flex items-center gap-1.5">
 <span className="h-2 w-2 rounded-full bg-primary"></span> Actividad
 </div>
 </div>
 </div>
 <div className="h-[280px] w-full">
 <ResponsiveContainer width="100%"height="100%">
 <AreaChart data={mockChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
 <defs>
 <linearGradient id="colorActivity"x1="0"y1="0"x2="0"y2="1">
 <stop offset="5%"stopColor="#3b82f6"stopOpacity={0.3} />
 <stop offset="95%"stopColor="#3b82f6"stopOpacity={0} />
 </linearGradient>
 </defs>
 <CartesianGrid strokeDasharray="3 3"vertical={false} stroke="#e5e7eb"className="stroke-border"/>
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
 <div className="flex flex-col gap-5">
 <h2 className="text-lg font-bold text-foreground px-2 mb-1">Acciones Rapidas</h2>
 
 <Link href="/portal/projects"className="group relative flex overflow-hidden rounded-xl bg-card p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-xl hover:-translate-y-1 border border-border hover:border-primary/30">
 <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 transition-transform group-hover:scale-150 /10"></div>
 <div className="relative flex w-full items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
 <FolderKanban className="h-5 w-5 text-primary"/>
 </div>
 <div>
 <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">Mis Proyectos</h3>
 <p className="text-xs text-muted-foreground mt-0.5">Ver progreso y tareas</p>
 </div>
 </div>
 <ArrowRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary"/>
 </div>
 </Link>

 <Link href="/portal/tickets"className="group relative flex overflow-hidden rounded-xl bg-card p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-xl hover:-translate-y-1 border border-border hover:border-primary/30">
 <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 transition-transform group-hover:scale-150 /10"></div>
 <div className="relative flex w-full items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
 <Ticket className="h-5 w-5 text-primary"/>
 </div>
 <div>
 <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">Tickets</h3>
 <p className="text-xs text-muted-foreground mt-0.5">{openTickets} abiertos</p>
 </div>
 </div>
 <ArrowRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary"/>
 </div>
 </Link>

 <Link href="/portal/notifications"className="group relative flex overflow-hidden rounded-xl bg-card p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all hover:shadow-xl hover:-translate-y-1 border border-border hover:border-primary/30">
 <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/10 transition-transform group-hover:scale-150 /10"></div>
 <div className="relative flex w-full items-center justify-between">
 <div className="flex items-center gap-4">
 <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
 <Bell className="h-5 w-5 text-primary"/>
 {unreadNotifications > 0 && (
 <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-destructive ring-4 ring-background"></span>
 )}
 </div>
 <div>
 <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">Notificaciones</h3>
 <p className="text-xs text-muted-foreground mt-0.5">{unreadNotifications} sin leer</p>
 </div>
 </div>
 <ArrowRight className="h-5 w-5 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary"/>
 </div>
 </Link>
 </div>
 </div>
 </div>
 );
}
