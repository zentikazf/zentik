'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from '@/components/ui/dialog';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type TabType = 'DM' | 'GROUP' | 'PROJECT';

interface CreateChannelDialogProps {
 orgId: string;
 open: boolean;
 onOpenChange: (open: boolean) => void;
 onCreated: (channel: any) => void;
}

export function CreateChannelDialog({ orgId, open, onOpenChange, onCreated }: CreateChannelDialogProps) {
 const [tab, setTab] = useState<TabType>('DM');
 const [saving, setSaving] = useState(false);

 // Shared data
 const [orgMembers, setOrgMembers] = useState<any[]>([]);
 const [projects, setProjects] = useState<any[]>([]);

 // DM
 const [selectedMemberId, setSelectedMemberId] = useState('');

 // Group
 const [groupName, setGroupName] = useState('');
 const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

 // Project
 const [selectedProjectId, setSelectedProjectId] = useState('');
 const [projectChannelName, setProjectChannelName] = useState('');

 useEffect(() => {
 if (!open) return;
 const load = async () => {
 try {
 const [membersRes, projectsRes] = await Promise.all([
 api.get(`/organizations/${orgId}/members`).catch(() => ({ data: [] })),
 api.get(`/organizations/${orgId}/projects`).catch(() => ({ data: [] })),
 ]);
 setOrgMembers(Array.isArray(membersRes.data) ? membersRes.data : membersRes.data?.data || []);
 setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : projectsRes.data?.data || []);
 } catch {
 // silent
 }
 };
 load();
 }, [open, orgId]);

 useEffect(() => {
 if (open) {
 setSelectedMemberId('');
 setGroupName('');
 setSelectedMemberIds([]);
 setSelectedProjectId('');
 setProjectChannelName('');
 }
 }, [open]);

 const handleSubmit = async () => {
 setSaving(true);
 try {
 let payload: any;

 switch (tab) {
 case 'DM':
 if (!selectedMemberId) return;
 payload = { name: 'DM', type: 'DM', memberIds: [selectedMemberId] };
 break;
 case 'GROUP':
 if (!groupName.trim() || selectedMemberIds.length === 0) return;
 payload = { name: groupName.trim(), type: 'GROUP', memberIds: selectedMemberIds };
 break;
 case 'PROJECT':
 if (!selectedProjectId) return;
 payload = {
 name: projectChannelName.trim() || undefined,
 type: 'PROJECT',
 projectId: selectedProjectId,
 };
 break;
 }

 const res = await api.post(`/organizations/${orgId}/channels`, payload);
 toast.success('Canal creado');
 onCreated(res.data);
 onOpenChange(false);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al crear el canal';
 toast.error('Error', message);
 } finally {
 setSaving(false);
 }
 };

 const toggleMember = (id: string) => {
 setSelectedMemberIds((prev) =>
 prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
 );
 };

 const tabs: { key: TabType; label: string }[] = [
 { key: 'DM', label: 'Mensaje Directo' },
 { key: 'GROUP', label: 'Grupo' },
 { key: 'PROJECT', label: 'Canal de Proyecto' },
 ];

 const canSubmit = () => {
 if (saving) return false;
 switch (tab) {
 case 'DM': return !!selectedMemberId;
 case 'GROUP': return !!groupName.trim() && selectedMemberIds.length > 0;
 case 'PROJECT': return !!selectedProjectId;
 }
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-md">
 <DialogHeader>
 <DialogTitle>Nueva Conversación</DialogTitle>
 </DialogHeader>

 {/* Tabs */}
 <div className="flex gap-1 rounded-lg bg-muted p-1">
 {tabs.map((t) => (
 <button
 key={t.key}
 onClick={() => setTab(t.key)}
 className={cn(
 'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
 tab === t.key
 ? 'bg-card text-foreground shadow-sm '
 : 'text-muted-foreground hover:text-foreground',
 )}
 >
 {t.label}
 </button>
 ))}
 </div>

 <div className="space-y-4 py-2">
 {tab === 'DM' && (
 <div className="space-y-2">
 <Label>Seleccionar miembro</Label>
 <div className="max-h-48 space-y-1 overflow-y-auto">
 {orgMembers.map((m) => {
 const user = m.user || m;
 return (
 <button
 key={user.id}
 type="button"
 onClick={() => setSelectedMemberId(user.id)}
 className={cn(
 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
 selectedMemberId === user.id
 ? 'bg-primary/10 text-primary '
 : 'hover:bg-muted',
 )}
 >
 <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
 {(user.name || user.email || '?').charAt(0).toUpperCase()}
 </div>
 <div>
 <p className="font-medium">{user.name || user.email}</p>
 {user.name && <p className="text-xs text-muted-foreground">{user.email}</p>}
 </div>
 </button>
 );
 })}
 {orgMembers.length === 0 && (
 <p className="py-4 text-center text-sm text-muted-foreground">No hay miembros disponibles</p>
 )}
 </div>
 </div>
 )}

 {tab === 'GROUP' && (
 <>
 <div className="space-y-2">
 <Label>Nombre del grupo</Label>
 <Input
 value={groupName}
 onChange={(e) => setGroupName(e.target.value)}
 placeholder="Ej: Frontend Team"
 />
 </div>
 <div className="space-y-2">
 <Label>Miembros</Label>
 <div className="flex flex-wrap gap-2">
 {orgMembers.map((m) => {
 const user = m.user || m;
 const selected = selectedMemberIds.includes(user.id);
 return (
 <button
 key={user.id}
 type="button"
 onClick={() => toggleMember(user.id)}
 className={cn(
 'rounded-full px-3 py-1 text-xs font-medium transition-colors',
 selected
 ? 'bg-primary text-primary-foreground'
 : 'bg-muted text-muted-foreground hover:bg-muted',
 )}
 >
 {user.name || user.email}
 </button>
 );
 })}
 </div>
 </div>
 </>
 )}

 {tab === 'PROJECT' && (
 <>
 <div className="space-y-2">
 <Label>Seleccionar proyecto</Label>
 <div className="max-h-48 space-y-1 overflow-y-auto">
 {projects.map((p) => (
 <button
 key={p.id}
 type="button"
 onClick={() => setSelectedProjectId(p.id)}
 className={cn(
 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
 selectedProjectId === p.id
 ? 'bg-primary/10 text-primary '
 : 'hover:bg-muted',
 )}
 >
 <span className="font-medium">{p.name}</span>
 </button>
 ))}
 {projects.length === 0 && (
 <p className="py-4 text-center text-sm text-muted-foreground">No hay proyectos disponibles</p>
 )}
 </div>
 </div>
 <div className="space-y-2">
 <Label>Nombre del canal (opcional)</Label>
 <Input
 value={projectChannelName}
 onChange={(e) => setProjectChannelName(e.target.value)}
 placeholder="Se auto-genera si se deja vacío"
 />
 </div>
 </>
 )}
 </div>

 <DialogFooter>
 <Button variant="outline"onClick={() => onOpenChange(false)}>Cancelar</Button>
 <Button onClick={handleSubmit} disabled={!canSubmit()}>
 {saving ? 'Creando...' : 'Crear'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 );
}
