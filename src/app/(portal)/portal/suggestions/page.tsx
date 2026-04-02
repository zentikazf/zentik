'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquarePlus, Clock, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
 PENDING: { label: 'Pendiente', color: 'text-muted-foreground', bg: 'bg-muted' },
 REVIEWING: { label: 'En Revision', color: 'text-info', bg: 'bg-info/10' },
 ACCEPTED: { label: 'Aceptada', color: 'text-info', bg: 'bg-info/10/50' },
 REJECTED: { label: 'Rechazada', color: 'text-muted-foreground', bg: 'bg-muted/50' },
 IMPLEMENTED: { label: 'Implementada', color: 'text-primary', bg: 'bg-primary/10' },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
 LOW: { label: 'Baja', color: 'text-muted-foreground' },
 MEDIUM: { label: 'Media', color: 'text-primary' },
 HIGH: { label: 'Alta', color: 'text-indigo-500' },
};

interface Suggestion {
 id: string;
 projectId: string;
 title: string;
 description: string;
 priority: string;
 status: string;
 adminNotes: string | null;
 createdAt: string;
 project?: {
 id: string;
 name: string;
 };
}

export default function PortalSuggestionsPage() {
 const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
 async function load() {
 try {
 const res = await api.get('/portal/suggestions');
 const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
 setSuggestions(data);
 } catch (err) {
 toast.error('Error', 'Error al cargar las sugerencias');
 } finally {
 setLoading(false);
 }
 }
 load();
 }, []);

 if (loading) {
 return (
 <div className="mx-auto max-w-5xl space-y-6">
 <Skeleton className="h-10 w-48 rounded-xl"/>
 <div className="space-y-4">
 {Array.from({ length: 4 }).map((_, i) => (
 <Skeleton key={i} className="h-28 rounded-xl"/>
 ))}
 </div>
 </div>
 );
 }

 return (
 <div className="mx-auto max-w-5xl space-y-8 pb-4">
 <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div>
 <h1 className="text-2xl font-bold text-foreground">Mis Sugerencias</h1>
 <p className="text-sm text-muted-foreground mt-1">Historial de sugerencias y mejoras solicitadas para tus proyectos</p>
 </div>
 <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1.5">
 <MessageSquarePlus className="h-4 w-4 text-primary"/>
 <span className="text-sm font-semibold text-primary">{suggestions.length} Total</span>
 </div>
 </div>

 {suggestions.length === 0 ? (
 <div className="flex flex-col items-center justify-center rounded-xl bg-card py-20 text-center border border-border">
 <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
 <MessageSquarePlus className="h-7 w-7 text-primary"/>
 </div>
 <h3 className="text-lg font-semibold text-foreground">Aun no hay sugerencias</h3>
 <p className="mt-2 max-w-sm text-sm text-muted-foreground">
 Crea tu primera sugerencia desde la vista detallada de alguno de tus proyectos activos.
 </p>
 </div>
 ) : (
 <div className="grid gap-5 md:gap-6">
 {suggestions.map((suggestion) => {
 const statusConf = STATUS_CONFIG[suggestion.status] || STATUS_CONFIG.PENDING;
 const prioConf = PRIORITY_CONFIG[suggestion.priority] || PRIORITY_CONFIG.MEDIUM;
 
 return (
 <div
 key={suggestion.id}
 className="group relative flex flex-col sm:flex-row gap-5 sm:items-center justify-between rounded-[24px] bg-card p-6 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 border border-border hover:border-primary/20"
 >
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-3 mb-1.5">
 <Badge className={`${statusConf.bg} ${statusConf.color} border-none text-[10px] uppercase tracking-wider font-bold`}>
 {statusConf.label}
 </Badge>
 <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
 Proyecto: {suggestion.project?.name || 'Desconocido'}
 </span>
 </div>
 <h3 className="text-base font-bold text-foreground truncate">
 {suggestion.title}
 </h3>
 {suggestion.description && (
 <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
 {suggestion.description}
 </p>
 )}
 {suggestion.adminNotes && (
 <div className="mt-3 flex gap-2 rounded-xl bg-primary/10 p-3 text-sm text-primary">
 <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary"/>
 <p className="leading-relaxed"><span className="font-semibold">Nota del admin:</span> {suggestion.adminNotes}</p>
 </div>
 )}
 </div>

 <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 border-t sm:border-t-0 sm:border-l border-border pt-4 sm:pt-0 sm:pl-6 min-w-[140px]">
 <div className="text-xs font-medium flex items-center gap-1.5">
 <span className="text-muted-foreground">Prioridad:</span>
 <span className={`font-bold ${prioConf.color}`}>{prioConf.label}</span>
 </div>
 <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
 <Clock className="h-3.5 w-3.5"/>
 {new Date(suggestion.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
 </span>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}
