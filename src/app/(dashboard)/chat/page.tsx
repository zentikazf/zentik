'use client';

import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Plus, Search, Users, Hash, User } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useChatStore } from '@/stores/use-chat-store';
import { ChatWindow } from '@/components/chat/chat-window';
import { CreateChannelDialog } from '@/components/chat/create-channel-dialog';
import { cn } from '@/lib/utils';

const typeIcons: Record<string, typeof MessageSquare> = {
 DM: User,
 GROUP: Users,
 PROJECT: Hash,
};

const typeLabels: Record<string, string> = {
 DM: 'Mensajes Directos',
 GROUP: 'Grupos',
 PROJECT: 'Canales de Proyecto',
};

export default function ChatPage() {
 const { organizations } = useAuth();
 const orgId = organizations?.[0]?.id;
 const { channels, activeChannelId, setChannels, setActiveChannel, addChannel } = useChatStore();
 const [loading, setLoading] = useState(true);
 const [search, setSearch] = useState('');
 const [createOpen, setCreateOpen] = useState(false);

 useEffect(() => {
 if (!orgId) return;
 const load = async () => {
 try {
 const res = await api.get(`/organizations/${orgId}/channels`);
 const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
 setChannels(list);
 if (list.length > 0 && !activeChannelId) {
 setActiveChannel(list[0].id);
 }
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cargar canales';
 toast.error('Error', message);
 } finally {
 setLoading(false);
 }
 };
 load();
 }, [orgId]);

 const handleChannelCreated = (channel: any) => {
 addChannel(channel);
 setActiveChannel(channel.id);
 };

 const getChannelName = (channel: any) => {
 if (channel.type === 'DM' && channel.members) {
 const other = channel.members.find((m: any) => m.user);
 return other?.user?.name || 'Mensaje Directo';
 }
 return channel.name;
 };

 const filtered = channels.filter((ch) =>
 getChannelName(ch).toLowerCase().includes(search.toLowerCase()),
 );

 const grouped = {
 DM: filtered.filter((ch) => ch.type === 'DM'),
 GROUP: filtered.filter((ch) => ch.type === 'GROUP'),
 PROJECT: filtered.filter((ch) => ch.type === 'PROJECT'),
 };

 if (loading) {
 return (
 <div className="flex gap-4">
 <Skeleton className="h-[calc(100vh-8rem)] w-72 rounded-xl"/>
 <Skeleton className="h-[calc(100vh-8rem)] flex-1 rounded-xl"/>
 </div>
 );
 }

 return (
 <div className="flex h-[calc(100vh-8rem)] gap-4">
 {/* Sidebar */}
 <div className="flex w-72 flex-shrink-0 flex-col rounded-xl border border-border bg-card">
 <div className="flex items-center justify-between p-4 pb-2">
 <h2 className="text-lg font-semibold text-foreground">Chat</h2>
 <Button size="icon"variant="ghost"className="h-8 w-8"onClick={() => setCreateOpen(true)}>
 <Plus className="h-4 w-4"/>
 </Button>
 </div>

 <div className="px-4 pb-3">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"/>
 <Input
 placeholder="Buscar..."
 className="h-8 rounded-full bg-muted pl-9 text-sm"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 />
 </div>
 </div>

 <ScrollArea className="flex-1 px-2 pb-2">
 {(['DM', 'GROUP', 'PROJECT'] as const).map((type) => {
 const items = grouped[type];
 if (items.length === 0) return null;
 const Icon = typeIcons[type];
 return (
 <div key={type} className="mb-3">
 <p className="mb-1 px-2 text-[11px] uppercase tracking-wider text-muted-foreground">
 {typeLabels[type]}
 </p>
 {items.map((ch) => (
 <button
 key={ch.id}
 onClick={() => setActiveChannel(ch.id)}
 className={cn(
 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors',
 activeChannelId === ch.id
 ? 'bg-primary/10 text-primary '
 : 'text-muted-foreground hover:bg-muted',
 )}
 >
 <Icon className="h-4 w-4 shrink-0"/>
 <span className="truncate font-medium">{getChannelName(ch)}</span>
 {ch._count?.messages ? (
 <span className="ml-auto text-[10px] text-muted-foreground">{ch._count.messages}</span>
 ) : null}
 </button>
 ))}
 </div>
 );
 })}

 {channels.length === 0 && (
 <div className="flex flex-col items-center py-12 text-center">
 <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/50"/>
 <p className="text-sm text-muted-foreground">No hay conversaciones</p>
 <Button size="sm"className="mt-4 rounded-full"onClick={() => setCreateOpen(true)}>
 <Plus className="mr-2 h-4 w-4"/> Nueva Conversación
 </Button>
 </div>
 )}
 </ScrollArea>
 </div>

 {/* Chat area */}
 <div className="flex flex-1 flex-col rounded-xl border border-border bg-card">
 {activeChannelId ? (
 <ChatWindow channelId={activeChannelId} />
 ) : (
 <div className="flex flex-1 items-center justify-center">
 <div className="text-center">
 <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50"/>
 <p className="text-muted-foreground">Selecciona una conversación para comenzar</p>
 </div>
 </div>
 )}
 </div>

 {orgId && (
 <CreateChannelDialog
 orgId={orgId}
 open={createOpen}
 onOpenChange={setCreateOpen}
 onCreated={handleChannelCreated}
 />
 )}
 </div>
 );
}
