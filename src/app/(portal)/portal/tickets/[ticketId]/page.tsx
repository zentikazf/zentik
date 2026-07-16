'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, Send, Paperclip, Ticket, CheckCircle2, Clock, AlertCircle, MessageSquare, FileText, Download, X, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useSocket } from '@/hooks/use-socket';
import { getInitials, cn } from '@/lib/utils';
import { SameTopicDialog } from '@/components/tickets/same-topic-dialog';
import { ChatImage } from '@/components/tickets/chat-image';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
 OPEN: { label: 'Abierto', color: 'bg-primary/10 text-primary' },
 IN_PROGRESS: { label: 'En Proceso', color: 'bg-warning/10 text-warning' },
 IN_REVIEW: { label: 'En Revision', color: 'bg-info/10 text-info' },
 RESOLVED: { label: 'Resuelto', color: 'bg-success/10 text-success' },
 CLOSED: { label: 'Cerrado', color: 'bg-muted text-muted-foreground' },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
 SUPPORT_REQUEST: { label: 'Soporte', color: 'bg-warning/10 text-warning ' },
 NEW_DEVELOPMENT: { label: 'Desarrollo', color: 'bg-info/10 text-info ' },
};

const PRIORITY_LABEL: Record<string, string> = {
 LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta',
};

interface TicketDetail {
 id: string;
 ticketNumber: string | null;
 title: string;
 description: string | null;
 category: string;
 status: string;
 priority: string;
 adminNotes: string | null;
 createdAt: string;
 project: { id: string; name: string } | null;
 task: { id: string; title: string; status: string } | null;
 channel: { id: string; name: string } | null;
 createdByUser: { id: string; name: string } | null;
}

interface ChatMessage {
 id: string;
 content: string;
 createdAt: string;
 senderType?: 'client' | 'team';
 user: { id: string; name: string; image: string | null };
 files?: { id: string; originalName: string; mimeType: string; url: string }[];
}

/** Adjunto pendiente de enviar (aun no subido). `preview` es un object URL para
 * imagenes, null para el resto. */
interface PendingAttachment {
 id: string;
 file: File;
 preview: string | null;
}

export default function PortalTicketDetailPage() {
 const { ticketId } = useParams<{ ticketId: string }>();
 const { user } = useAuth();
 const [ticket, setTicket] = useState<TicketDetail | null>(null);
 const [messages, setMessages] = useState<ChatMessage[]>([]);
 const [loading, setLoading] = useState(true);
 const [messageText, setMessageText] = useState('');
 const [sending, setSending] = useState(false);
 const [pending, setPending] = useState<PendingAttachment[]>([]);
 const [showSameTopic, setShowSameTopic] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const pendingRef = useRef<PendingAttachment[]>([]);
 const messagesEndRef = useRef<HTMLDivElement>(null);

 const { joinRoom, leaveRoom } = useSocket({
 'message:new': (data: any) => {
 const msg: ChatMessage = {
 id: data.id,
 content: data.content,
 createdAt: data.createdAt,
 senderType: data.senderType || 'team',
 user: data.user || { id: '', name: 'Equipo', image: null },
 files: data.files || [],
 };
 setMessages((prev) => {
 if (prev.some((m) => m.id === msg.id)) return prev;
 return [...prev, msg];
 });
 },
 });

 useEffect(() => {
 if (ticketId) loadTicket();
 }, [ticketId]);

 useEffect(() => {
 const channelId = ticket?.channel?.id;
 if (channelId) {
 joinRoom(channelId);
 return () => leaveRoom(channelId);
 }
 }, [ticket?.channel?.id]);

 useEffect(() => {
 messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
 }, [messages]);

 const loadTicket = async () => {
 try {
 const res = await api.get<any>(`/portal/tickets/${ticketId}`);
 const data = res.data;
 setTicket(data);
 if (data.channel?.id) {
 await loadMessages(data.channel.id);
 }
 } catch {
 toast.error('Error', 'No se pudo cargar el ticket');
 } finally {
 setLoading(false);
 }
 };

 const loadMessages = async (channelId: string) => {
 try {
 const res = await api.get<any>(`/channels/${channelId}/messages?limit=100`);
 const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
 setMessages(data.reverse());
 } catch {
 // Silent fail - chat may not be accessible yet
 }
 };

 // Mantiene pendingRef en sync para revocar los object URLs al desmontar.
 useEffect(() => {
 pendingRef.current = pending;
 }, [pending]);
 useEffect(() => {
 return () => {
 pendingRef.current.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
 };
 }, []);

 const addFiles = (files: File[]) => {
 const additions = files.map((file) => ({
 id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
 file,
 preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
 }));
 setPending((prev) => [...prev, ...additions]);
 };

 const removePending = (id: string) => {
 setPending((prev) => {
 const target = prev.find((p) => p.id === id);
 if (target?.preview) URL.revokeObjectURL(target.preview);
 return prev.filter((p) => p.id !== id);
 });
 };

 // Envio unificado: sube los adjuntos pendientes (si hay) y postea UN mensaje
 // con texto + fileIds. content es requerido por el backend (1..5000): si no hay
 // texto usamos el marcador 📎 (que oculta la burbuja al render).
 const handleSend = async (e: React.FormEvent) => {
 e.preventDefault();
 const content = messageText.trim();
 if ((!content && pending.length === 0) || !ticket?.channel?.id || sending) return;
 const channelId = ticket.channel.id;
 setSending(true);
 try {
 let fileIds: string[] = [];
 if (pending.length > 0) {
 const uploaded = await Promise.all(
 pending.map(async (p) => {
 const formData = new FormData();
 formData.append('file', p.file);
 const res = await api.upload<any>('/files/upload?category=ATTACHMENT', formData);
 return res.data?.id as string | undefined;
 }),
 );
 fileIds = uploaded.filter((id): id is string => Boolean(id));
 }
 await api.post<any>(`/channels/${channelId}/messages`, {
 content: content || `📎 ${pending.map((p) => p.file.name).join(', ')}`,
 ...(fileIds.length > 0 && { fileIds }),
 });
 // El mensaje llega via WebSocket broadcast (message:new)
 pending.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
 setPending([]);
 setMessageText('');
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al enviar el mensaje');
 } finally {
 setSending(false);
 }
 };

 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
 const files = Array.from(e.target.files || []);
 if (files.length > 0) addFiles(files);
 if (fileInputRef.current) fileInputRef.current.value = '';
 };

 // Paste de imagen (Ctrl+V): si el clipboard trae archivos, los agrega al preview.
 const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
 const files = Array.from(e.clipboardData?.items || [])
 .filter((it) => it.kind === 'file')
 .map((it) => it.getAsFile())
 .filter((f): f is File => Boolean(f));
 if (files.length > 0) {
 e.preventDefault();
 addFiles(files);
 }
 };

 if (loading) {
 return (
 <div className="mx-auto max-w-5xl space-y-6">
 <Skeleton className="h-8 w-40 rounded-xl"/>
 <div className="grid gap-6 lg:grid-cols-2">
 <Skeleton className="h-80 rounded-xl"/>
 <Skeleton className="h-80 rounded-xl"/>
 </div>
 </div>
 );
 }

 if (!ticket) {
 return (
 <div className="mx-auto max-w-5xl">
 <div className="flex flex-col items-center justify-center rounded-xl bg-card py-20 text-center">
 <AlertCircle className="h-12 w-12 text-muted-foreground mb-4"/>
 <p className="text-muted-foreground">Ticket no encontrado</p>
 <Link href="/portal/tickets">
 <Button variant="ghost"className="mt-4">Volver a Tickets</Button>
 </Link>
 </div>
 </div>
 );
 }

 const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
 const catConf = CATEGORY_CONFIG[ticket.category] || CATEGORY_CONFIG.SUPPORT_REQUEST;
 const isResolved = ticket.status === 'RESOLVED';

 const TASK_STATUS_LABELS: Record<string, string> = {
 BACKLOG: 'Nuevo', TODO: 'Pendiente', IN_PROGRESS: 'En Desarrollo',
 IN_REVIEW: 'En Revisión', DONE: 'Completada', CANCELLED: 'Cancelada',
 };

 return (
 <div className="mx-auto max-w-5xl space-y-6 pb-4">
 {/* Back + title — header atenuado cuando el ticket esta resuelto (read-only) */}
 <div className={cn(isResolved && 'opacity-75')}>
 <Link
 href="/portal/tickets"
 className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-3"
 >
 <ChevronLeft className="h-4 w-4"/>
 Volver a Tickets
 </Link>
 <div className="flex flex-wrap items-center gap-2">
 <Ticket className="h-5 w-5 text-primary"/>
 <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">#{ticket.ticketNumber || ticket.id.slice(-8).toUpperCase()}</span>
 <h1 className="text-xl font-bold text-foreground">{ticket.title}</h1>
 </div>
 <div className="flex items-center gap-2 mt-2">
 <Badge className={`${catConf.color} border-none text-[10px] uppercase tracking-wider font-bold`}>
 {catConf.label}
 </Badge>
 <Badge className={`${statusConf.color} border-none text-[10px] font-semibold`}>
 {statusConf.label}
 </Badge>
 <span className="text-xs text-muted-foreground">
 Criticidad: <span className="font-medium text-muted-foreground">{PRIORITY_LABEL[ticket.priority] || ticket.priority}</span>
 </span>
 </div>
 </div>

 {/* Banner full-width arriba — ticket terminal, chat read-only para el cliente.
     Realzado cuando esta resuelto (border-success/40 + shadow). Label "Resuelto". */}
 {isResolved && (
 <div className="bg-success/10 border border-success/40 shadow-lg shadow-success/20 rounded-xl p-5">
 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
 <div className="flex items-start gap-2.5">
 <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5"/>
 <div>
 <h2 className="text-sm font-semibold text-success">Ticket resuelto</h2>
 <p className="text-xs text-muted-foreground mt-0.5">
 Este ticket fue marcado como resuelto. Si tenes otra consulta, crea una nueva.
 </p>
 </div>
 </div>
 <Button
 size="sm"
 className="rounded-full shrink-0 self-start sm:self-auto"
 onClick={() => setShowSameTopic(true)}
 >
 Crear nueva consulta
 </Button>
 </div>
 </div>
 )}

 {/* Grid 2 columnas: izquierda (Descripcion + Informacion), derecha (Chat) */}
 <div className="grid gap-6 lg:grid-cols-2 items-start">
 {/* Left: Descripcion + Informacion del Ticket */}
 <div className="space-y-4">
 {/* Description */}
 <div className="rounded-xl bg-card p-5 border border-border">
 <h2 className="text-sm font-semibold text-muted-foreground mb-3">Descripcion</h2>
 {ticket.description ? (
 <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
 {ticket.description}
 </p>
 ) : (
 <p className="text-sm text-muted-foreground italic">Sin descripcion adicional</p>
 )}
 </div>

 {/* Metadata — Informacion del Ticket */}
 <div className="rounded-xl bg-card p-5 border border-border space-y-3">
 <h2 className="text-sm font-semibold text-muted-foreground">Informacion del Ticket</h2>
 <div className="space-y-2.5">
 {ticket.project && (
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">Proyecto</span>
 <span className="font-medium text-foreground">{ticket.project.name}</span>
 </div>
 )}
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">Creado</span>
 <span className="flex items-center gap-1 font-medium text-foreground">
 <Clock className="h-3.5 w-3.5"/>
 {new Date(ticket.createdAt).toLocaleDateString('es-ES', {
 day: '2-digit', month: 'long', year: 'numeric',
 })}
 </span>
 </div>
 {ticket.createdByUser && (
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">Creado por</span>
 <span className="font-medium text-foreground">{ticket.createdByUser.name}</span>
 </div>
 )}
 {ticket.task && (
 <div className="flex items-center justify-between text-sm">
 <span className="text-muted-foreground">Tarea</span>
 <span className="flex items-center gap-1.5 font-medium text-foreground">
 <CheckCircle2 className="h-3.5 w-3.5 text-success"/>
 {TASK_STATUS_LABELS[ticket.task.status] || ticket.task.status}
 </span>
 </div>
 )}
 </div>
 </div>

 {/* Admin notes */}
 {ticket.adminNotes && (
 <div className="rounded-xl bg-primary/10 p-5 border border-primary/20">
 <h2 className="text-sm font-semibold text-primary mb-2">Respuesta del equipo</h2>
 <p className="text-sm text-primary leading-relaxed">
 {ticket.adminNotes}
 </p>
 </div>
 )}
 </div>

 {/* Right: Chat con el equipo */}
 <div className="flex flex-col rounded-xl bg-card border border-border overflow-hidden"style={{ minHeight: '420px', maxHeight: '600px' }}>
 <div className="flex items-center gap-2 border-b border-border px-4 py-3">
 <MessageSquare className="h-4 w-4 text-primary"/>
 <span className="text-sm font-semibold text-foreground">Chat con el equipo</span>
 </div>

 {/* Messages — el historial queda 100% legible aunque el ticket este resuelto */}
 <div className="flex-1 overflow-y-auto p-4 space-y-3">
 {messages.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-full text-center py-8">
 <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2"/>
 <p className="text-sm text-muted-foreground">
 Ningún mensaje aun.<br />
 <span className="text-xs">Escribe para comunicarte con el equipo.</span>
 </p>
 </div>
 ) : (
 messages.map((msg) => {
 const isMe = msg.user.id === user?.id;
 return (
 <div
 key={msg.id}
 className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
 >
 <Avatar className="h-7 w-7 shrink-0">
 <AvatarImage src={msg.user.image || undefined} />
 <AvatarFallback className="text-[10px] font-bold bg-primary/15 text-primary">
 {getInitials(msg.user.name)}
 </AvatarFallback>
 </Avatar>
 <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
 {/* Hide text bubble when message is just a file attachment marker */}
 {!(msg.files?.length && msg.content.startsWith('\u{1F4CE}')) && (
 <div
 className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
 isMe
 ? 'bg-primary text-white rounded-tr-sm'
 : 'bg-secondary text-secondary-foreground rounded-tl-sm'
 }`}
 >
 {msg.content}
 </div>
 )}
 {msg.files && msg.files.length > 0 && (
 <div className="flex flex-col gap-1.5">
 {msg.files.map((f) =>
 f.mimeType?.startsWith('image/') ? (
 <ChatImage key={f.id} src={f.url} alt={f.originalName} className="max-h-60 max-w-[240px]"/>
 ) : (
 <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" download={f.originalName}
  className="flex items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-2 text-xs hover:bg-muted/50 transition-colors">
 <FileText className="h-4 w-4 text-primary shrink-0"/>
 <span className="truncate font-medium text-foreground">{f.originalName}</span>
 <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto"/>
 </a>
 ),
 )}
 </div>
 )}
 <span className="text-[10px] text-muted-foreground px-1">
 {new Date(msg.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>
 </div>
 );
 })
 )}
 <div ref={messagesEndRef} />
 </div>

 {/* Input */}
 <div className="border-t border-border p-3">
 {ticket.channel ? (
 /* Composer read-only "todo gris" cuando el ticket esta resuelto:
    opacity-60 + pointer-events-none envuelve SOLO la zona del composer
    (preview + input + enviar + adjuntar), ademas del disabled que ya tiene.
    El historial de mensajes de arriba queda 100% legible. */
 <div className={cn(isResolved && 'opacity-60 pointer-events-none')}>
 {/* Preview de adjuntos pendientes (imagenes con thumbnail, resto como chip) */}
 {pending.length > 0 && (
 <div className={cn('flex flex-wrap gap-2 mb-2', sending && 'opacity-60 pointer-events-none')}>
 {pending.map((p) => (
 <div key={p.id} className="relative">
 {p.preview ? (
 // eslint-disable-next-line @next/next/no-img-element
 <img src={p.preview} alt={p.file.name} className="h-16 w-16 rounded-lg border border-border object-cover"/>
 ) : (
 <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted px-1">
 <Paperclip className="h-4 w-4 text-muted-foreground"/>
 <span className="w-full truncate text-center text-[9px] text-muted-foreground">{p.file.name}</span>
 </div>
 )}
 <button type="button" onClick={() => removePending(p.id)} aria-label="Quitar adjunto" className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow hover:opacity-90">
 <X className="h-3 w-3"/>
 </button>
 </div>
 ))}
 </div>
 )}
 <form onSubmit={handleSend} className="flex items-center gap-2">
 <button type="button" onClick={() => fileInputRef.current?.click()} disabled={sending || isResolved} className="shrink-0 rounded-full h-9 w-9 flex items-center justify-center border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-50">
 <Paperclip className="h-4 w-4"/>
 </button>
 <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.xlsx,.csv,.txt" />
 <input
 type="text"
 value={messageText}
 onChange={(e) => setMessageText(e.target.value)}
 onPaste={handlePaste}
 placeholder={isResolved ? 'Ticket resuelto — chat de solo lectura' : 'Escribe un mensaje o pega una imagen...'}
 disabled={sending || isResolved}
 className="flex-1 rounded-full border border-border bg-muted px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
 />
 <Button
 type="submit"
 size="sm"
 disabled={(!messageText.trim() && pending.length === 0) || sending || isResolved}
 className="rounded-full h-9 w-9 p-0 shrink-0"
 >
 {sending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
 </Button>
 </form>
 </div>
 ) : (
 <p className="text-center text-xs text-muted-foreground py-1">Canal de chat no disponible</p>
 )}
 </div>
 </div>
 </div>

 <SameTopicDialog
 open={showSameTopic}
 onOpenChange={setShowSameTopic}
 ticketId={ticket.id}
 />
 </div>
 );
}
