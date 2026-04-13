'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, Paperclip, Clock, User, Tag, AlertCircle } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useSocket } from '@/hooks/use-socket';
import { cn, getInitials } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
 OPEN: 'Abierto',
 IN_PROGRESS: 'En progreso',
 RESOLVED: 'Resuelto',
 CLOSED: 'Cerrado',
};

const CATEGORY_LABELS: Record<string, string> = {
 SUPPORT_REQUEST: 'Soporte',
 NEW_DEVELOPMENT: 'Desarrollo',
};

const PRIORITY_LABELS: Record<string, string> = {
 LOW: 'Baja',
 MEDIUM: 'Media',
 HIGH: 'Alta',
};

interface TicketDetail {
 id: string;
 title: string;
 description: string | null;
 category: string;
 status: string;
 priority: string;
 adminNotes: string | null;
 createdAt: string;
 client: { id: string; name: string; email?: string } | null;
 project: { id: string; name: string; slug?: string } | null;
 task: { id: string; title: string; status: string; priority?: string } | null;
 channel: { id: string; name: string; _count?: { messages: number } } | null;
}

interface ChatFile {
 id: string;
 name: string;
 originalName: string;
 mimeType: string;
 size: number;
 key: string;
 url: string;
}

interface ChatMessage {
 id: string;
 content: string;
 createdAt: string;
 senderType?: 'client' | 'team';
 user: { id: string; name: string; image: string | null };
 files?: ChatFile[];
}

export default function TicketDetailPage() {
 const { ticketId } = useParams<{ ticketId: string }>();
 const router = useRouter();
 const { user } = useAuth();
 const [ticket, setTicket] = useState<TicketDetail | null>(null);
 const [messages, setMessages] = useState<ChatMessage[]>([]);
 const [loading, setLoading] = useState(true);
 const [newMessage, setNewMessage] = useState('');
 const [sending, setSending] = useState(false);
 const [status, setStatus] = useState('');
 const [adminNotes, setAdminNotes] = useState('');
 const [savingNotes, setSavingNotes] = useState(false);
 const [changingStatus, setChangingStatus] = useState(false);
 const [uploading, setUploading] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);
 const scrollRef = useRef<HTMLDivElement>(null);

 const { joinRoom, leaveRoom } = useSocket({
 'message:new': (data: any) => {
 const msg: ChatMessage = {
 id: data.id,
 content: data.content,
 createdAt: data.createdAt,
 senderType: data.senderType || 'team',
 user: data.user || { id: '', name: 'Sistema', image: null },
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
 if (scrollRef.current) {
 const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
 if (el) el.scrollTop = el.scrollHeight;
 }
 }, [messages]);

 const loadTicket = async () => {
 try {
 const res = await api.get<any>(`/tickets/${ticketId}`);
 setTicket(res.data);
 setStatus(res.data.status);
 setAdminNotes(res.data.adminNotes || '');
 if (res.data.channel?.id) {
 await loadMessages(res.data.channel.id);
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
 // Silent — chat may not be accessible yet
 }
 };

 const handleSend = useCallback(async () => {
 if (!newMessage.trim() || !ticket?.channel?.id) return;

 setSending(true);
 const content = newMessage.trim();
 setNewMessage('');

 try {
 await api.post<any>(`/channels/${ticket.channel.id}/messages`, { content });
 // Message will arrive via WebSocket broadcast (message:new)
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al enviar el mensaje');
 setNewMessage(content);
 } finally {
 setSending(false);
 }
 }, [newMessage, ticket?.channel?.id]);

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file || !ticket?.channel?.id) return;
 setUploading(true);
 try {
 const formData = new FormData();
 formData.append('file', file);
 const uploadRes = await api.upload<any>('/files/upload?category=ATTACHMENT', formData);
 const fileUrl = uploadRes.data?.url || uploadRes.data?.key || file.name;
 await api.post<any>(`/channels/${ticket.channel.id}/messages`, {
 content: `📎 ${file.name}`,
 });
 // Message will arrive via WebSocket broadcast (message:new)
 toast.success('Archivo enviado', file.name);
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al subir archivo');
 } finally {
 setUploading(false);
 if (fileInputRef.current) fileInputRef.current.value = '';
 }
 };

 const handleStatusChange = async (newStatus: string) => {
 if (newStatus === status || changingStatus) return;
 setChangingStatus(true);
 const prevStatus = status;
 setStatus(newStatus);

 try {
 await api.patch(`/tickets/${ticketId}`, { status: newStatus });
 toast.success('Estado actualizado', `Ticket cambiado a ${STATUS_LABELS[newStatus] || newStatus}`);
 } catch (err) {
 setStatus(prevStatus);
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al cambiar el estado');
 } finally {
 setChangingStatus(false);
 }
 };

 const handleSaveNotes = async () => {
 if (savingNotes) return;
 setSavingNotes(true);
 try {
 await api.patch(`/tickets/${ticketId}`, { adminNotes });
 toast.success('Notas guardadas', 'Las notas del admin se actualizaron');
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al guardar las notas');
 } finally {
 setSavingNotes(false);
 }
 };

 if (loading) {
 return (
 <div className="space-y-4">
 <Skeleton className="h-8 w-40 rounded-xl"/>
 <div className="flex gap-4">
 <Skeleton className="flex-1 h-[500px] rounded-xl"/>
 <Skeleton className="w-72 h-[500px] rounded-xl"/>
 </div>
 </div>
 );
 }

 if (!ticket) {
 return (
 <div className="text-center py-16">
 <p className="text-muted-foreground">Ticket no encontrado.</p>
 <Button variant="outline" onClick={() => router.push('/tickets')} className="mt-4">
 <ArrowLeft className="h-4 w-4 mr-2"/> Volver
 </Button>
 </div>
 );
 }

 return (
 <div className="h-full flex flex-col max-w-5xl">
 <Button variant="ghost" size="sm" onClick={() => router.push('/tickets')} className="self-start mb-4">
 <ArrowLeft className="h-4 w-4 mr-1"/> Tickets
 </Button>

 <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0" style={{ maxHeight: 'calc(100vh - 120px)' }}>
 {/* Conversation panel */}
 <div className="flex-1 flex flex-col rounded-xl border border-border bg-card min-h-0">
 <div className="px-4 py-3 border-b border-border">
 <div className="flex items-start justify-between gap-3">
 <div>
 <div className="flex items-center gap-2">
 <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">#{ticket.id.slice(-8).toUpperCase()}</span>
 <h1 className="text-base font-semibold text-foreground">{ticket.title}</h1>
 </div>
 <p className="text-xs text-muted-foreground mt-0.5">
 {ticket.client?.name || 'Sin cliente'} · {new Date(ticket.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}
 </p>
 </div>
 <span className={cn(
 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium shrink-0',
 status === 'OPEN' ? 'bg-destructive/10 text-destructive' :
 status === 'IN_PROGRESS' ? 'bg-warning/10 text-warning' :
 status === 'RESOLVED' ? 'bg-success/10 text-success' :
 'bg-muted text-muted-foreground',
 )}>
 {STATUS_LABELS[status] || status}
 </span>
 </div>
 </div>

 <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
 <div className="p-4 space-y-4">
 {messages.map((msg) => {
 const isTeam = msg.senderType !== 'client';
 const isMyMessage = msg.user.id === user?.id;
 const operatorLabel = isMyMessage ? 'Tú' : msg.user.name;
 return (
 <div
 key={msg.id}
 className={cn(
 'flex gap-2.5 max-w-[85%]',
 isTeam ? 'ml-auto flex-row-reverse' : '',
 )}
 >
 <div className={cn(
 'h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
 isTeam ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
 )}>
 {getInitials(msg.user.name)}
 </div>
 <div className={cn('flex flex-col gap-1', isTeam ? 'items-end' : 'items-start')}>
 <div className={cn(
 'rounded-2xl px-3 py-2 text-sm leading-relaxed',
 isTeam
 ? 'bg-primary text-primary-foreground rounded-tr-sm'
 : 'bg-secondary text-secondary-foreground rounded-tl-sm',
 )}>
 {msg.content}
 </div>
 {msg.files && msg.files.length > 0 && (
 <div className="flex flex-col gap-1 mt-1">
 {msg.files.map((f) => (
 <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
 <Paperclip className="h-3 w-3" />{f.originalName}
 </a>
 ))}
 </div>
 )}
 <span className="text-[10px] text-muted-foreground px-1">
 {isTeam && <span className="font-medium mr-1">{operatorLabel}</span>}
 {new Date(msg.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
 </span>
 </div>
 </div>
 );
 })}
 {messages.length === 0 && (
 <div className="text-center py-12 text-sm text-muted-foreground">No hay mensajes aun.</div>
 )}
 </div>
 </ScrollArea>

 <div className="p-3 border-t border-border">
 {ticket.channel ? (
 <div className="flex gap-2">
 <Textarea
 value={newMessage}
 onChange={(e) => setNewMessage(e.target.value)}
 placeholder="Escribe un mensaje..."
 className="min-h-[44px] max-h-32 resize-none"
 rows={1}
 onKeyDown={(e) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 handleSend();
 }
 }}
 />
 <div className="flex flex-col gap-1">
 <Button size="sm" onClick={handleSend} disabled={!newMessage.trim() || sending}>
 <Send className="h-4 w-4"/>
 </Button>
 <Button size="sm" variant="outline" className="text-muted-foreground" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
 <Paperclip className="h-4 w-4"/>
 </Button>
 <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.xlsx,.csv,.txt" />
 </div>
 </div>
 ) : (
 <p className="text-center text-xs text-muted-foreground py-1">Canal de chat no disponible</p>
 )}
 </div>
 </div>

 {/* Sidebar */}
 <div className="w-full lg:w-72 space-y-3 shrink-0 overflow-y-auto">
 {/* Details card */}
 <div className="rounded-xl border border-border bg-card p-4 space-y-3">
 <h3 className="text-sm font-semibold text-foreground">Detalles</h3>
 <div className="space-y-2.5 text-sm">
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground flex items-center gap-1.5"><Tag className="h-3.5 w-3.5"/> Tipo</span>
 <span className="font-medium text-foreground">{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5"/> Prioridad</span>
 <span className={cn(
 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
 ticket.priority === 'HIGH' ? 'bg-destructive/10 text-destructive' :
 ticket.priority === 'MEDIUM' ? 'bg-warning/10 text-warning' :
 'bg-muted text-muted-foreground',
 )}>
 {PRIORITY_LABELS[ticket.priority] || ticket.priority}
 </span>
 </div>
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground flex items-center gap-1.5"><User className="h-3.5 w-3.5"/> Cliente</span>
 <span className="font-medium text-foreground">{ticket.client?.name || '-'}</span>
 </div>
 {ticket.project && (
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground flex items-center gap-1.5"><Tag className="h-3.5 w-3.5"/> Proyecto</span>
 <span className="font-medium text-primary">{ticket.project.name}</span>
 </div>
 )}
 <div className="flex items-center justify-between">
 <span className="text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5"/> Creado</span>
 <span className="text-foreground">{new Date(ticket.createdAt).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
 </div>
 </div>
 </div>

 {/* Status change */}
 <div className="rounded-xl border border-border bg-card p-4 space-y-3">
 <h3 className="text-sm font-semibold text-foreground">Cambiar estado</h3>
 <div className="grid grid-cols-1 gap-1.5">
 {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const).map((s) => (
 <button
 key={s}
 onClick={() => handleStatusChange(s)}
 disabled={changingStatus}
 className={cn(
 'text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors border',
 status === s
 ? 'bg-primary text-primary-foreground border-primary'
 : 'bg-card text-muted-foreground border-border hover:bg-muted',
 )}
 >
 {STATUS_LABELS[s]}
 </button>
 ))}
 </div>
 </div>

 {/* Admin notes */}
 <div className="rounded-xl border border-border bg-card p-4 space-y-2">
 <h3 className="text-sm font-semibold text-foreground">Notas del admin</h3>
 <Textarea
 value={adminNotes}
 onChange={(e) => setAdminNotes(e.target.value)}
 placeholder="Notas internas sobre este ticket..."
 rows={3}
 className="text-sm"
 />
 <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={savingNotes} className="w-full">
 {savingNotes ? 'Guardando...' : 'Guardar notas'}
 </Button>
 </div>

 {/* Description */}
 {ticket.description && (
 <div className="rounded-xl border border-border bg-card p-4 space-y-2">
 <h3 className="text-sm font-semibold text-foreground">Descripcion</h3>
 <p className="text-sm text-muted-foreground leading-relaxed">{ticket.description}</p>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}
