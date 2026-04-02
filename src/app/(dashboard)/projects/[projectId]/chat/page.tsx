'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from '@/components/ui/dialog';
import { MessageSquare, Plus, Hash } from 'lucide-react';

const ChatWindow = dynamic(() => import('@/components/chat/chat-window').then(m => m.ChatWindow), { ssr: false, loading: () => <Skeleton className="h-[500px] w-full"/> });
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

export default function ChatPage() {
 const { projectId } = useParams<{ projectId: string }>();
 const [channels, setChannels] = useState<any[]>([]);
 const [activeChannel, setActiveChannel] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);

 const [dialogOpen, setDialogOpen] = useState(false);
 const [channelName, setChannelName] = useState('');
 const [creating, setCreating] = useState(false);

 const loadChannels = async () => {
 try {
 const res = await api.get(`/projects/${projectId}/channels`);
 const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
 setChannels(data);
 if (data.length > 0 && !activeChannel) setActiveChannel(data[0].id);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cargar canales';
 toast.error('Error', message);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 loadChannels();
 }, [projectId]);

 const handleCreateChannel = async () => {
 if (!channelName.trim()) return;
 setCreating(true);
 try {
 const res = await api.post(`/projects/${projectId}/channels`, { name: channelName.trim() });
 toast.success('Canal creado', `"${channelName.trim()}"ha sido creado`);
 setChannelName('');
 setDialogOpen(false);
 await loadChannels();
 if (res.data?.id) setActiveChannel(res.data.id);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al crear canal';
 toast.error('Error', message);
 } finally {
 setCreating(false);
 }
 };

 if (loading) {
 return <Skeleton className="h-[600px] rounded-xl"/>;
 }

 return (
 <div className="flex h-[calc(100vh-10rem)] gap-4">
 {/* Channel Sidebar */}
 <div className="w-64 shrink-0 rounded-xl border border-border bg-card p-4">
 <div className="mb-4 flex items-center justify-between">
 <h2 className="text-[15px] font-semibold text-foreground">Canales</h2>
 <button
 onClick={() => setDialogOpen(true)}
 className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
 >
 <Plus className="h-4 w-4"/>
 </button>
 </div>
 <div className="space-y-1">
 {channels.map((ch) => (
 <button
 key={ch.id}
 onClick={() => setActiveChannel(ch.id)}
 className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors ${
 activeChannel === ch.id
 ? 'bg-primary/10 font-medium text-primary'
 : 'text-muted-foreground hover:bg-muted'
 }`}
 >
 <Hash className="h-4 w-4"/>
 <span className="truncate">{ch.name}</span>
 </button>
 ))}
 {channels.length === 0 && (
 <div className="py-8 text-center">
 <MessageSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50"/>
 <p className="text-xs text-muted-foreground">Sin canales aún</p>
 <button onClick={() => setDialogOpen(true)} className="mt-1 text-xs font-medium text-primary hover:text-primary">
 Crear primer canal
 </button>
 </div>
 )}
 </div>
 </div>

 {/* Chat Area */}
 <div className="flex-1 overflow-hidden rounded-xl border border-border bg-card">
 {activeChannel ? (
 <ChatWindow channelId={activeChannel} projectId={projectId} />
 ) : (
 <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
 <MessageSquare className="mb-3 h-10 w-10"/>
 <p>Selecciona un canal para comenzar</p>
 </div>
 )}
 </div>

 <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Crear Nuevo Canal</DialogTitle>
 </DialogHeader>
 <div className="space-y-4 py-2">
 <div className="space-y-2">
 <Label>Nombre del canal</Label>
 <Input
 value={channelName}
 onChange={(e) => setChannelName(e.target.value)}
 placeholder="Ej: general, diseño, backend..."
 onKeyDown={(e) => { if (e.key === 'Enter') handleCreateChannel(); }}
 />
 </div>
 </div>
 <DialogFooter>
 <Button variant="outline"onClick={() => setDialogOpen(false)}>Cancelar</Button>
 <Button onClick={handleCreateChannel} disabled={creating || !channelName.trim()}>
 {creating ? 'Creando...' : 'Crear Canal'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
