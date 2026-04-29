'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Paperclip } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useSocket } from '@/hooks/use-socket';
import { cn, getInitials } from '@/lib/utils';

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

interface TicketChatProps {
  channelId: string | null | undefined;
  className?: string;
}

/**
 * Componente de chat reusable para tickets.
 * Reproduce la UI/UX del chat actual de tickets/[id]/page.tsx
 * para mantener la experiencia que les gusto a los gerentes,
 * pero ahora encapsulado para que pueda vivir dentro del panel lateral.
 */
export function TicketChat({ channelId, className }: TicketChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
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

  const loadMessages = useCallback(async (cid: string) => {
    try {
      const res = await api.get<any>(`/channels/${cid}/messages?limit=100`);
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setMessages(data.reverse());
    } catch {
      // chat may not be accessible yet — silent
    }
  }, []);

  useEffect(() => {
    if (!channelId) {
      setMessages([]);
      return;
    }
    loadMessages(channelId);
    joinRoom(channelId);
    return () => {
      leaveRoom(channelId);
    };
  }, [channelId, loadMessages, joinRoom, leaveRoom]);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (el) (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || !channelId) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');
    try {
      await api.post<any>(`/channels/${channelId}/messages`, { content });
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al enviar el mensaje');
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  }, [newMessage, channelId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !channelId) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await api.upload<any>('/files/upload?category=ATTACHMENT', formData);
      const fileId = uploadRes.data?.id;
      await api.post<any>(`/channels/${channelId}/messages`, {
        content: `📎 ${file.name}`,
        ...(fileId && { fileIds: [fileId] }),
      });
      toast.success('Archivo enviado', file.name);
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al subir archivo');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!channelId) {
    return (
      <div className={cn('flex flex-col rounded-xl border border-border bg-card', className)}>
        <p className="text-center text-xs text-muted-foreground py-8">
          Canal de chat no disponible
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col rounded-xl border border-border bg-card min-h-0', className)}>
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-3 space-y-3">
          {messages.map((msg) => {
            const isTeam = msg.senderType !== 'client';
            const isMyMessage = msg.user.id === user?.id;
            const operatorLabel = isMyMessage ? 'Tu' : msg.user.name;
            return (
              <div
                key={msg.id}
                className={cn('flex gap-2 max-w-[85%]', isTeam ? 'ml-auto flex-row-reverse' : '')}
              >
                <div
                  className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold',
                    isTeam ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground',
                  )}
                >
                  {getInitials(msg.user.name)}
                </div>
                <div className={cn('flex flex-col gap-1', isTeam ? 'items-end' : 'items-start')}>
                  {!(msg.files?.length && msg.content.startsWith('\u{1F4CE}')) && (
                    <div
                      className={cn(
                        'rounded-2xl px-3 py-1.5 text-sm leading-relaxed',
                        isTeam
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-secondary text-secondary-foreground rounded-tl-sm',
                      )}
                    >
                      {msg.content}
                    </div>
                  )}
                  {msg.files && msg.files.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {msg.files.map((f) => (
                        <a
                          key={f.id}
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={f.originalName}
                          className="flex items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
                        >
                          <Paperclip className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate font-medium text-foreground">{f.originalName}</span>
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
            <div className="text-center py-8 text-xs text-muted-foreground">No hay mensajes aun.</div>
          )}
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Escribe un mensaje..."
            className="min-h-[40px] max-h-32 resize-none text-sm"
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
              <Send className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,.pdf,.doc,.docx,.xlsx,.csv,.txt"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
