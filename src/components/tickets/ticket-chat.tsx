'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Paperclip, X, Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useSocket } from '@/hooks/use-socket';
import { cn, getInitials } from '@/lib/utils';
import { ChatImage } from '@/components/tickets/chat-image';

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

/** Adjunto pendiente de enviar (aun no subido). `preview` es un object URL para
 * imagenes, null para el resto. */
interface PendingAttachment {
  id: string;
  file: File;
  preview: string | null;
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
  const [pending, setPending] = useState<PendingAttachment[]>([]);
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

  // Ref al pending actual para revocar los object URLs al desmontar sin
  // recrear el efecto de cleanup en cada cambio.
  const pendingRef = useRef<PendingAttachment[]>([]);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  useEffect(() => {
    return () => {
      pendingRef.current.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
    };
  }, []);

  const addFiles = useCallback((files: File[]) => {
    const additions = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
    setPending((prev) => [...prev, ...additions]);
  }, []);

  const removePending = useCallback((id: string) => {
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  // Envio unificado: sube los adjuntos pendientes (si hay) y postea UN mensaje
  // con el texto + los fileIds. content es requerido por el backend (1..5000),
  // asi que si no hay texto usamos el marcador 📎 (que oculta la burbuja al render).
  const handleSend = useCallback(async () => {
    const content = newMessage.trim();
    if ((!content && pending.length === 0) || !channelId || sending) return;
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
      pending.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
      setPending([]);
      setNewMessage('');
    } catch (err) {
      toast.error('Error', err instanceof ApiError ? err.message : 'Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  }, [newMessage, channelId, pending, sending]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) addFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Paste de imagen (Ctrl+V): si el clipboard trae archivos, los agrega al
  // preview y frena el paste por defecto (evita pegar la imagen como texto raro).
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData?.items || [])
      .filter((it) => it.kind === 'file')
      .map((it) => it.getAsFile())
      .filter((f): f is File => Boolean(f));
    if (files.length > 0) {
      e.preventDefault();
      addFiles(files);
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
                      {msg.files.map((f) =>
                        f.mimeType?.startsWith('image/') ? (
                          <ChatImage
                            key={f.id}
                            src={f.url}
                            alt={f.originalName}
                            className="max-h-60 max-w-[240px]"
                          />
                        ) : (
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
                        ),
                      )}
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
        {/* Preview de adjuntos pendientes (imagenes con thumbnail, resto como chip) */}
        {pending.length > 0 && (
          <div className={cn('flex flex-wrap gap-2 mb-2', sending && 'opacity-60 pointer-events-none')}>
            {pending.map((p) => (
              <div key={p.id} className="relative">
                {p.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.preview}
                    alt={p.file.name}
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-lg border border-border bg-muted px-1">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span className="w-full truncate text-center text-[9px] text-muted-foreground">
                      {p.file.name}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removePending(p.id)}
                  aria-label="Quitar adjunto"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow hover:opacity-90"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onPaste={handlePaste}
            placeholder="Escribe un mensaje o pega una imagen..."
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
            <Button
              size="sm"
              onClick={handleSend}
              disabled={(!newMessage.trim() && pending.length === 0) || sending}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.xlsx,.csv,.txt"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
