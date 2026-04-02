'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, Link2, Unlink } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function CalendarPage() {
 const [currentDate, setCurrentDate] = useState(new Date());
 const [events, setEvents] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);
 const [googleStatus, setGoogleStatus] = useState<any>(null);
 const [syncing, setSyncing] = useState(false);

 const year = currentDate.getFullYear();
 const month = currentDate.getMonth();
 const firstDay = new Date(year, month, 1).getDay();
 const daysInMonth = new Date(year, month + 1, 0).getDate();

 useEffect(() => {
 const load = async () => {
 setLoading(true);
 try {
 const startDate = new Date(year, month, 1).toISOString();
 const endDate = new Date(year, month + 1, 0).toISOString();
 const res = await api.get<any[]>(`/calendar/events?startDate=${startDate}&endDate=${endDate}`);
 setEvents(Array.isArray(res.data) ? res.data : []);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cargar eventos';
 toast.error('Error', message);
 } finally {
 setLoading(false);
 }
 };
 load();
 }, [year, month]);

 useEffect(() => {
 loadGoogleStatus();
 }, []);

 const loadGoogleStatus = async () => {
 try {
 const res = await api.get('/calendar/google/status');
 setGoogleStatus(res.data);
 } catch {}
 };

 const handleGoogleConnect = async () => {
 try {
 const authCode = prompt('Ingresa el código de autorización de Google:');
 if (!authCode) return;
 await api.post('/calendar/google/connect', { authCode });
 toast.success('Google Calendar conectado');
 loadGoogleStatus();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al conectar';
 toast.error('Error', message);
 }
 };

 const handleGoogleDisconnect = async () => {
 try {
 await api.delete('/calendar/google/disconnect');
 toast.success('Google Calendar desconectado');
 setGoogleStatus(null);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al desconectar';
 toast.error('Error', message);
 }
 };

 const handleGoogleSync = async () => {
 setSyncing(true);
 try {
 await api.post('/calendar/google/sync');
 toast.success('Sincronización completada');
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al sincronizar';
 toast.error('Error', message);
 } finally {
 setSyncing(false);
 }
 };

 const prev = () => setCurrentDate(new Date(year, month - 1, 1));
 const next = () => setCurrentDate(new Date(year, month + 1, 1));
 const todayBtn = () => setCurrentDate(new Date());

 const getEventsForDay = (day: number) => {
 return events.filter((e) => {
 const d = new Date(e.date || e.dueDate || e.startDate);
 return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
 });
 };

 const cells = [];
 for (let i = 0; i < firstDay; i++) cells.push(null);
 for (let d = 1; d <= daysInMonth; d++) cells.push(d);

 const isToday = (day: number) => {
 const now = new Date();
 return day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
 };

 const isConnected = googleStatus?.connected || googleStatus?.isConnected;

 return (
 <div className="space-y-6">
 {/* Header + Nav */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">Calendario</h1>
 <p className="mt-1 text-sm text-muted-foreground">Tareas con fechas, sprints y eventos</p>
 </div>
 <div className="flex items-center gap-2">
 <button onClick={prev} className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground transition-colors hover:bg-muted">
 <ChevronLeft className="h-4 w-4"/>
 </button>
 <button onClick={todayBtn} className="rounded-full bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted">
 Hoy
 </button>
 <button onClick={next} className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground transition-colors hover:bg-muted">
 <ChevronRight className="h-4 w-4"/>
 </button>
 </div>
 </div>

 {/* Google Calendar Integration */}
 <div className="rounded-xl border border-border bg-card p-5">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
 <CalendarIcon className="h-5 w-5 text-primary"/>
 </div>
 <div>
 <p className="text-[15px] font-medium text-foreground">Google Calendar</p>
 <p className="text-[13px] text-muted-foreground">
 {isConnected ? 'Conectado y sincronizando' : 'No conectado'}
 </p>
 </div>
 {isConnected && (
 <Badge className="bg-success/10 text-success">Conectado</Badge>
 )}
 </div>
 <div className="flex gap-2">
 {isConnected ? (
 <>
 <button
 onClick={handleGoogleSync}
 disabled={syncing}
 className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
 >
 <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
 {syncing ? 'Sincronizando...' : 'Sincronizar'}
 </button>
 <button
 onClick={handleGoogleDisconnect}
 className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
 >
 <Unlink className="h-3.5 w-3.5"/> Desconectar
 </button>
 </>
 ) : (
 <button
 onClick={handleGoogleConnect}
 className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
 >
 <Link2 className="h-3.5 w-3.5"/> Conectar
 </button>
 )}
 </div>
 </div>
 </div>

 {/* Calendar Grid */}
 <div className="rounded-xl border border-border bg-card p-6">
 <h2 className="mb-5 text-center text-lg font-semibold text-foreground">
 {MONTHS[month]} {year}
 </h2>

 <div className="grid grid-cols-7 gap-px">
 {DAYS.map((day) => (
 <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">{day}</div>
 ))}
 {cells.map((day, i) => (
 <div
 key={i}
 className={`min-h-[80px] rounded-lg border border-border p-1.5 ${
 day ? 'bg-card' : 'bg-muted/50'
 }`}
 >
 {day && (
 <>
 <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
 isToday(day)
 ? 'bg-primary text-white font-bold'
 : 'text-foreground'
 }`}>{day}</span>
 <div className="mt-1 space-y-0.5">
 {getEventsForDay(day).slice(0, 2).map((ev, j) => (
 <div key={j} className="truncate rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
 {ev.title || ev.name}
 </div>
 ))}
 {getEventsForDay(day).length > 2 && (
 <span className="text-[9px] text-muted-foreground">+{getEventsForDay(day).length - 2} más</span>
 )}
 </div>
 </>
 )}
 </div>
 ))}
 </div>
 </div>
 </div>
 );
}
