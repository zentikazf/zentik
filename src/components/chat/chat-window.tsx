'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Send, Paperclip, MoreHorizontal, Pencil, Trash2, X, Check } from 'lucide-react';
import { useSocket } from '@/hooks/use-socket';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { cn, formatDateTime, getInitials } from '@/lib/utils';

interface Message {
 id: string;
 content: string;
 type: 'TEXT' | 'FILE' | 'SYSTEM';
 createdAt: string;
 editedAt?: string;
 sender: {
 id: string;
 name: string;
 avatarUrl?: string;
 };
}

interface ChatWindowProps {
 channelId: string;
 projectId?: string;
}

export function ChatWindow({ channelId }: ChatWindowProps) {
 const [messages, setMessages] = useState<Message[]>([]);
 const [input, setInput] = useState('');
 const [isLoading, setIsLoading] = useState(true);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [editContent, setEditContent] = useState('');
 const scrollRef = useRef<HTMLDivElement>(null);
 const { user } = useAuth();
 const { emit, socket } = useSocket();

 useEffect(() => {
 const loadMessages = async () => {
 try {
 const res = await api.get(`/channels/${channelId}/messages?limit=50`);
 setMessages(res.data || []);
 } catch {
 // handle silently
 } finally {
 setIsLoading(false);
 }
 };
 loadMessages();
 }, [channelId]);

 useEffect(() => {
 if (!socket) return;
 emit('channel:join', { channelId });

 const handleNewMessage = (data: any) => {
 const msg: Message = data.sender ? data : {
 ...data,
 sender: data.user
 ? { id: data.user.id, name: data.user.name, avatarUrl: data.user.image }
 : { id: '', name: 'Sistema', avatarUrl: undefined },
 };
 setMessages((prev) => [...prev, msg]);
 };

 socket.on('message:new', handleNewMessage);

 return () => {
 socket.off('message:new', handleNewMessage);
 emit('channel:leave', { channelId });
 };
 }, [socket, channelId, emit]);

 useEffect(() => {
 if (scrollRef.current) {
 scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
 }
 }, [messages]);

 const handleSend = useCallback(async () => {
 if (!input.trim()) return;
 const content = input.trim();
 setInput('');
 emit('message:send', { channelId, content });
 }, [input, channelId, emit]);

 const handleEdit = async (messageId: string) => {
 if (!editContent.trim()) return;
 try {
 const res = await api.patch(`/messages/${messageId}`, { content: editContent.trim() });
 setMessages((prev) => prev.map((m) =>
 m.id === messageId ? { ...m, content: editContent.trim(), editedAt: new Date().toISOString() } : m
 ));
 setEditingId(null);
 setEditContent('');
 } catch {
 toast.error('Error', 'No se pudo editar el mensaje');
 }
 };

 const handleDelete = async (messageId: string) => {
 try {
 await api.delete(`/messages/${messageId}`);
 setMessages((prev) => prev.filter((m) => m.id !== messageId));
 } catch {
 toast.error('Error', 'No se pudo eliminar el mensaje');
 }
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter' && !e.shiftKey) {
 e.preventDefault();
 handleSend();
 }
 };

 return (
 <div className="flex h-full flex-col">
 <ScrollArea className="flex-1 p-4"ref={scrollRef}>
 {isLoading ? (
 <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
 Cargando mensajes...
 </div>
 ) : messages.length === 0 ? (
 <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
 No hay mensajes aún. ¡Inicia la conversación!
 </div>
 ) : (
 <div className="flex flex-col gap-4">
 {messages.map((message) => {
 const isOwn = message.sender.id === user?.id;
 const isEditing = editingId === message.id;

 return (
 <div
 key={message.id}
 className={cn('group flex gap-3', isOwn && 'flex-row-reverse')}
 >
 <Avatar className="h-8 w-8 shrink-0">
 <AvatarImage src={message.sender.avatarUrl} />
 <AvatarFallback className="text-xs">
 {getInitials(message.sender.name)}
 </AvatarFallback>
 </Avatar>

 <div className={cn('max-w-[70%]', isOwn && 'items-end')}>
 <div className="mb-1 flex items-center gap-2">
 <span className="text-xs font-medium">{message.sender.name}</span>
 <span className="text-[10px] text-muted-foreground">
 {formatDateTime(message.createdAt)}
 </span>
 {message.editedAt && (
 <span className="text-[10px] text-muted-foreground">(editado)</span>
 )}
 </div>

 {isEditing ? (
 <div className="flex items-center gap-2">
 <Input
 value={editContent}
 onChange={(e) => setEditContent(e.target.value)}
 onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(message.id); if (e.key === 'Escape') setEditingId(null); }}
 className="text-sm"
 autoFocus
 />
 <Button size="icon"className="h-7 w-7"onClick={() => handleEdit(message.id)}>
 <Check className="h-3.5 w-3.5"/>
 </Button>
 <Button variant="ghost"size="icon"className="h-7 w-7"onClick={() => setEditingId(null)}>
 <X className="h-3.5 w-3.5"/>
 </Button>
 </div>
 ) : (
 <div className="flex items-start gap-1">
 <div
 className={cn(
 'rounded-lg px-3 py-2 text-sm',
 isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted',
 )}
 >
 {message.content}
 </div>

 {isOwn && (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 variant="ghost"
 size="icon"
 className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
 >
 <MoreHorizontal className="h-3.5 w-3.5"/>
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
 <DropdownMenuItem onClick={() => { setEditingId(message.id); setEditContent(message.content); }}>
 <Pencil className="mr-2 h-4 w-4"/> Editar
 </DropdownMenuItem>
 <DropdownMenuItem onClick={() => handleDelete(message.id)} className="text-destructive focus:text-destructive">
 <Trash2 className="mr-2 h-4 w-4"/> Eliminar
 </DropdownMenuItem>
 </DropdownMenuContent>
 </DropdownMenu>
 )}
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </ScrollArea>

 <div className="border-t p-4">
 <div className="flex gap-2">
 <Button variant="ghost"size="icon"className="shrink-0">
 <Paperclip className="h-4 w-4"/>
 </Button>
 <Input
 value={input}
 onChange={(e) => setInput(e.target.value)}
 onKeyDown={handleKeyDown}
 placeholder="Escribe un mensaje..."
 className="flex-1"
 />
 <Button onClick={handleSend} disabled={!input.trim()} size="icon"className="shrink-0">
 <Send className="h-4 w-4"/>
 </Button>
 </div>
 </div>
 </div>
 );
}
