'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, Send, RotateCcw, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminMcpChat, type ChatStage, type UiMessage } from './use-admin-mcp-chat';
import { RenderMarkdown } from './render-markdown';

interface AdminMcpChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function stageLabel(stage: ChatStage): string | null {
  switch (stage) {
    case 'thinking':
      return 'Pensando...';
    case 'querying':
      return 'Consultando datos...';
    case 'responding':
      return 'Respondiendo...';
    default:
      return null;
  }
}

function MessageBubble({ message }: { message: UiMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <RenderMarkdown content={message.content} />
        )}
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1 border-t border-border/40 pt-2">
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <Wrench className="h-3 w-3" />
              Tools:
            </span>
            {message.toolCalls.map((tc, idx) => (
              <span
                key={`${tc.tool}-${idx}`}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  tc.ok
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-destructive/10 text-destructive',
                )}
              >
                {tc.tool}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminMcpChatModal({ open, onOpenChange }: AdminMcpChatModalProps) {
  const { messages, loading, stage, error, send, reset } = useAdminMcpChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Autoscroll al fondo cuando llegan mensajes o cambia el stage (loading).
  // Reusa el patron de ticket-chat.tsx: busca el viewport del Radix ScrollArea
  // y le setea scrollTop al scrollHeight.
  useEffect(() => {
    if (!scrollRef.current) return;
    const viewport = scrollRef.current.querySelector(
      '[data-radix-scroll-area-viewport]',
    );
    if (viewport) {
      (viewport as HTMLElement).scrollTop = (viewport as HTMLElement).scrollHeight;
    }
  }, [messages, loading, stage]);

  // Autosize del textarea con cap de 6 rows (aprox 144px).
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 144)}px`;
  }, [input]);

  const canSend = !loading && input.trim().length > 0;

  const handleSend = async () => {
    if (!canSend) return;
    const value = input;
    setInput('');
    await send(value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const stageMessage = stageLabel(stage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[700px] w-full max-w-2xl flex-col gap-0 p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold">
              Asistente Zentik
            </DialogTitle>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={loading}
              className="mr-8 h-8 gap-1 text-xs"
              title="Limpiar conversacion"
            >
              <RotateCcw className="h-3 w-3" />
              Limpiar
            </Button>
          )}
        </DialogHeader>

        <ScrollArea ref={scrollRef} className="flex-1 px-4 py-3">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Hola, soy tu asistente.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pregunta sobre tus clientes, proyectos, horas o tickets.
                </p>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
                <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
                  cuantos clientes tenemos
                </span>
                <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
                  proyectos activos
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {loading && stageMessage && (
                <div className="flex w-full justify-start">
                  <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                    <span className="flex h-2 w-2 animate-pulse rounded-full bg-primary" />
                    {stageMessage}
                  </div>
                </div>
              )}
              {error && !loading && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta... (Enter envia, Shift+Enter nueva linea)"
              disabled={loading}
              rows={1}
              maxLength={8000}
              className="min-h-[40px] flex-1 resize-none overflow-y-auto"
            />
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              className="h-10 w-10 shrink-0"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Las conversaciones no se guardan. Al cerrar el modal se pierden.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
