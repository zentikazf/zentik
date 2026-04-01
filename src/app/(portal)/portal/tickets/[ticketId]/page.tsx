'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, Send, Ticket, CheckCircle2, Clock, AlertCircle, MessageSquare } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { getInitials } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  OPEN:        { label: 'Abierto',    color: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400' },
  IN_PROGRESS: { label: 'En Proceso', color: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400' },
  RESOLVED:    { label: 'Resuelto',   color: 'bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400' },
  CLOSED:      { label: 'Cerrado',    color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  SUPPORT_REQUEST: { label: 'Soporte',    color: 'bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400' },
  NEW_DEVELOPMENT: { label: 'Desarrollo', color: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400' },
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
  user: { id: string; name: string; image: string | null };
}

export default function PortalTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ticketId) loadTicket();
  }, [ticketId]);

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

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton className="h-8 w-40 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-[20px]" />
          <Skeleton className="h-80 rounded-[20px]" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center justify-center rounded-[20px] bg-white py-20 text-center dark:bg-gray-900">
          <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Ticket no encontrado</p>
          <Link href="/portal/tickets">
            <Button variant="ghost" className="mt-4">Volver a Tickets</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.OPEN;
  const catConf = CATEGORY_CONFIG[ticket.category] || CATEGORY_CONFIG.SUPPORT_REQUEST;

  const TASK_STATUS_LABELS: Record<string, string> = {
    BACKLOG: 'Pendiente', TODO: 'Por hacer', IN_PROGRESS: 'En progreso',
    IN_REVIEW: 'En revision', DONE: 'Completado', CANCELLED: 'Cancelado',
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-4">
      {/* Back + title */}
      <div>
        <Link
          href="/portal/tickets"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a Tickets
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Ticket className="h-5 w-5 text-blue-500" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">{ticket.title}</h1>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge className={`${catConf.color} border-none text-[10px] uppercase tracking-wider font-bold`}>
            {catConf.label}
          </Badge>
          <Badge className={`${statusConf.color} border-none text-[10px] font-semibold`}>
            {statusConf.label}
          </Badge>
          <span className="text-xs text-gray-400">
            Prioridad: <span className="font-medium text-gray-600 dark:text-gray-300">{PRIORITY_LABEL[ticket.priority] || ticket.priority}</span>
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Ticket info */}
        <div className="space-y-4">
          {/* Description */}
          <div className="rounded-[20px] bg-white p-5 dark:bg-gray-900 border border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">Descripcion</h2>
            {ticket.description ? (
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap">
                {ticket.description}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">Sin descripcion adicional</p>
            )}
          </div>

          {/* Metadata */}
          <div className="rounded-[20px] bg-white p-5 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 space-y-3">
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300">Informacion</h2>
            <div className="space-y-2.5">
              {ticket.project && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Proyecto</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{ticket.project.name}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Creado</span>
                <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(ticket.createdAt).toLocaleDateString('es-ES', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                </span>
              </div>
              {ticket.task && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Tarea</span>
                  <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    {TASK_STATUS_LABELS[ticket.task.status] || ticket.task.status}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Admin notes */}
          {ticket.adminNotes && (
            <div className="rounded-[20px] bg-blue-50 p-5 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
              <h2 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">Respuesta del equipo</h2>
              <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                {ticket.adminNotes}
              </p>
            </div>
          )}
        </div>

        {/* Right: Chat */}
        <div className="flex flex-col rounded-[20px] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden" style={{ minHeight: '420px', maxHeight: '600px' }}>
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
            <MessageSquare className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Chat con el equipo</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <MessageSquare className="h-8 w-8 text-gray-300 dark:text-gray-600 mb-2" />
                <p className="text-sm text-gray-400">
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
                      <AvatarFallback className="text-[10px] font-bold bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                        {getInitials(msg.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          isMe
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 rounded-tl-sm'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[10px] text-gray-400 px-1">
                        {!isMe && <span className="font-medium text-gray-500 dark:text-gray-400 mr-1">{msg.user.name}</span>}
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
          <div className="border-t border-gray-100 dark:border-gray-800 p-3">
            {ticket.channel ? (
              <form onSubmit={handleSend} className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  disabled={sending}
                  className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!messageText.trim() || sending}
                  className="rounded-full h-9 w-9 p-0 shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            ) : (
              <p className="text-center text-xs text-gray-400 py-1">Canal de chat no disponible</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
