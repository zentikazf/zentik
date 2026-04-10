'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, Send, Paperclip, Ticket, CheckCircle2, Clock, AlertCircle, MessageSquare } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useSocket } from '@/hooks/use-socket';
import { getInitials } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
 OPEN: { label: 'Abierto', color: 'bg-primary/10 text-primary' },
 IN_PROGRESS: { label: 'En Proceso', color: 'bg-warning/10 text-warning' },
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
}

interface ChatMessage {
 id: string;
 content: string;
 createdAt: string;
 senderType?: 'client' | 'team';
 user: { id: string; name: string; image: string | null };
 files?: { id: string; originalName: string; mimeType: string; url: string }[];
}

export default function PortalTicketDetailPage() {
 const { ticketId } = useParams<{ ticketId: string }>();
 const { user } = useAuth();
 const [ticket, setTicket] = useState<TicketDetail | null>(null);
 const [messages, setMessages] = useState<ChatMessage[]>([]);
 const [loading, setLoading] = useState(true);
 const [messageText, setMessageText] = useState('');
 const [sending, setSending] = useState(false);
 const [uploading, setUploading] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);
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
 setMessages((prev) => [...prev, msg]);
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

 const handleSend = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!messageText.trim() || !ticket?.channel?.id) return;

 setSending(true);
 const content = messageText.trim();
 setMessageText('');

 try {
 const res = await api.post<any>(`/channels/${ticket.channel.id}/messages`, { content });
 setMessages((prev) => [...prev, res.data]);
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al enviar el mensaje');
 setMessageText(content);
 } finally {
 setSending(false);
 }
 };

 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file || !ticket?.channel?.id) return;
 setUploading(true);
 try {
 const formData = new FormData();
 formData.append('file', file);
 await api.post<any>('/files/upload?category=ATTACHMENT', formData, {
 headers: { 'Content-Type': 'multipart/form-data' },
 });
 const msgRes = await api.post<any>(`/channels/${ticket.channel.id}/messages`, {
 content: `📎 ${file.name}`,
 });
 setMessages((prev) => [...prev, msgRes.data]);
 toast.success('Archivo enviado', file.name);
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al subir archivo');
 } finally {
 setUploading(false);
 if (fileInputRef.current) fileInputRef.current.value = '';
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

 const TASK_STATUS_LABELS: Record<string, string> = {
 BACKLOG: 'Nuevo', TODO: 'Pendiente', IN_PROGRESS: 'En Desarrollo',
 IN_REVIEW: 'En Revisión', DONE: 'Completada', CANCELLED: 'Cancelada',
 };

 return (
 <div className="mx-auto max-w-5xl space-y-6 pb-4">
 {/* Back + title */}
 <div>
 <Link
 href="/portal/tickets"
 className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-3"
 >
 <ChevronLeft className="h-4 w-4"/>
 Volver a Tickets
 </Link>
 <div className="flex flex-wrap items-center gap-2">
 <Ticket className="h-5 w-5 text-primary"/>
 <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">#{ticket.id.slice(-8).toUpperCase()}</span>
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
 Prioridad: <span className="font-medium text-muted-foreground">{PRIORITY_LABEL[ticket.priority] || ticket.priority}</span>
 </span>
 </div>
 </div>

 <div className="grid gap-6 lg:grid-cols-2">
 {/* Left: Ticket info */}
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

 {/* Metadata */}
 <div className="rounded-xl bg-card p-5 border border-border space-y-3">
 <h2 className="text-sm font-semibold text-muted-foreground">Informacion</h2>
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

 {/* Right: Chat */}
 <div className="flex flex-col rounded-xl bg-card border border-border overflow-hidden"style={{ minHeight: '420px', maxHeight: '600px' }}>
 <div className="flex items-center gap-2 border-b border-border px-4 py-3">
 <MessageSquare className="h-4 w-4 text-primary"/>
 <span className="text-sm font-semibold text-foreground">Chat con el equipo</span>
 </div>

 {/* Messages */}
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
 <div
 className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
 isMe
 ? 'bg-primary text-white rounded-tr-sm'
 : 'bg-secondary text-secondary-foreground rounded-tl-sm'
 }`}
 >
 {msg.content}
 </div>
 {msg.files && msg.files.length > 0 && (
 <div className="flex flex-col gap-1 mt-1">
 {msg.files.map((f) => (
 <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
 {f.originalName}
 </a>
 ))}
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
 <form onSubmit={handleSend} className="flex items-center gap-2">
 <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="shrink-0 rounded-full h-9 w-9 flex items-center justify-center border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors disabled:opacity-50">
 <Paperclip className="h-4 w-4"/>
 </button>
 <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.xlsx,.csv,.txt" />
 <input
 type="text"
 value={messageText}
 onChange={(e) => setMessageText(e.target.value)}
 placeholder="Escribe un mensaje..."
 disabled={sending}
 className="flex-1 rounded-full border border-border bg-muted px-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
 />
 <Button
 type="submit"
 size="sm"
 disabled={!messageText.trim() || sending}
 className="rounded-full h-9 w-9 p-0 shrink-0"
 >
 <Send className="h-4 w-4"/>
 </Button>
 </form>
 ) : (
 <p className="text-center text-xs text-muted-foreground py-1">Canal de chat no disponible</p>
 )}
 </div>
 </div>
 </div>
 </div>
 );
}
