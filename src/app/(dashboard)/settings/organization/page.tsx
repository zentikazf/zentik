'use client';

import { useEffect, useState } from 'react';
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
import { Building2, Copy, Plus, Trash2, AlertTriangle, Link2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { useOrg } from '@/providers/org-provider';
import { formatDate } from '@/lib/utils';

export default function OrganizationSettingsPage() {
 const { orgId, organization } = useOrg();
 const [orgData, setOrgData] = useState<any>(null);
 const [name, setName] = useState('');
 const [saving, setSaving] = useState(false);
 const [loading, setLoading] = useState(true);

 const [invites, setInvites] = useState<any[]>([]);
 const [inviteEmail, setInviteEmail] = useState('');
 const [creatingInvite, setCreatingInvite] = useState(false);

 const [deleteOpen, setDeleteOpen] = useState(false);
 const [deleteConfirmText, setDeleteConfirmText] = useState('');
 const [deleting, setDeleting] = useState(false);

 useEffect(() => {
 if (!orgId) return;
 const load = async () => {
 try {
 const [orgRes, invRes] = await Promise.all([
 api.get(`/organizations/${orgId}`),
 api.get(`/organizations/${orgId}/invites`).catch(() => ({ data: [] })),
 ]);
 setOrgData(orgRes.data);
 setName(orgRes.data?.name || '');
 const inv = invRes.data;
 setInvites(Array.isArray(inv) ? inv : inv?.data || []);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cargar la organización';
 toast.error('Error', message);
 } finally {
 setLoading(false);
 }
 };
 load();
 }, [orgId]);

 const handleSave = async () => {
 if (!orgId || !name.trim()) return;
 setSaving(true);
 try {
 await api.patch(`/organizations/${orgId}`, { name: name.trim() });
 toast.success('Organización actualizada');
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al actualizar';
 toast.error('Error', message);
 } finally {
 setSaving(false);
 }
 };

 const handleCreateInvite = async () => {
 if (!orgId) return;
 setCreatingInvite(true);
 try {
 await api.post(`/organizations/${orgId}/invites`, {
 email: inviteEmail.trim() || undefined,
 });
 toast.success('Invitación creada');
 setInviteEmail('');
 const res = await api.get(`/organizations/${orgId}/invites`);
 setInvites(Array.isArray(res.data) ? res.data : res.data?.data || []);
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al crear invitación';
 toast.error('Error', message);
 } finally {
 setCreatingInvite(false);
 }
 };

 const copyInviteLink = (code: string) => {
 const url = `${window.location.origin}/join/${code}`;
 navigator.clipboard.writeText(url);
 toast.success('Enlace copiado al portapapeles');
 };

 const handleDelete = async () => {
 if (!orgId) return;
 setDeleting(true);
 try {
 await api.delete(`/organizations/${orgId}`);
 toast.success('Organización eliminada');
 window.location.href = '/dashboard';
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al eliminar';
 toast.error('Error', message);
 } finally {
 setDeleting(false);
 }
 };

 if (loading) {
 return (
 <div className="space-y-5">
 <Skeleton className="h-10 w-64 rounded-xl"/>
 <Skeleton className="h-48 rounded-xl"/>
 <Skeleton className="h-48 rounded-xl"/>
 </div>
 );
 }

 return (
 <div className="space-y-7">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">Configuración de la Organización</h1>
 <p className="mt-1 text-sm text-muted-foreground">
 Administra los datos y configuraciones de tu organización
 </p>
 </div>

 {/* Org Info */}
 <div className="rounded-xl border border-border bg-card p-6">
 <h2 className="mb-5 flex items-center gap-2 text-lg font-semibold text-foreground">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
 <Building2 className="h-5 w-5 text-primary"/>
 </div>
 Información General
 </h2>
 <div className="space-y-4">
 <div className="space-y-2">
 <Label className="text-muted-foreground">Nombre de la organización</Label>
 <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-md"/>
 </div>
 {orgData?.slug && (
 <div className="text-sm text-muted-foreground">
 Slug: <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{orgData.slug}</code>
 </div>
 )}
 <Button onClick={handleSave} disabled={saving || !name.trim()} className="rounded-full">
 {saving ? 'Guardando...' : 'Guardar Cambios'}
 </Button>
 </div>
 </div>

 {/* Invites */}
 <div className="rounded-xl border border-border bg-card p-6">
 <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
 <Link2 className="h-5 w-5 text-success"/>
 </div>
 Enlaces de Invitación
 </h2>
 <p className="mb-5 text-sm text-muted-foreground">
 Crea enlaces de invitación para que otros se unan a tu organización
 </p>

 <div className="mb-5 flex gap-2">
 <Input
 value={inviteEmail}
 onChange={(e) => setInviteEmail(e.target.value)}
 placeholder="Email (opcional)"
 className="max-w-xs"
 />
 <Button onClick={handleCreateInvite} disabled={creatingInvite} className="rounded-full">
 <Plus className="mr-2 h-4 w-4"/>
 {creatingInvite ? 'Creando...' : 'Crear Enlace'}
 </Button>
 </div>

 {invites.length > 0 && (
 <div className="space-y-2">
 {invites.map((inv) => (
 <div key={inv.id} className="flex items-center justify-between rounded-xl border border-border p-4">
 <div>
 <code className="text-xs text-foreground">{inv.code}</code>
 {inv.email && <span className="ml-2 text-xs text-muted-foreground">→ {inv.email}</span>}
 <p className="mt-0.5 text-[13px] text-muted-foreground">
 {inv.usedAt ? 'Usado' : 'Pendiente'} · Creado: {formatDate(inv.createdAt)}
 </p>
 </div>
 <button
 onClick={() => copyInviteLink(inv.code)}
 className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
 >
 <Copy className="h-3.5 w-3.5"/> Copiar
 </button>
 </div>
 ))}
 </div>
 )}
 {invites.length === 0 && (
 <p className="text-sm text-muted-foreground">No hay invitaciones pendientes</p>
 )}
 </div>

 {/* Danger Zone */}
 <div className="rounded-xl border border-destructive/30 bg-card p-6">
 <h2 className="mb-2 text-lg font-semibold text-destructive">Zona de Peligro</h2>
 <p className="mb-4 text-sm text-muted-foreground">
 Eliminar la organización es irreversible. Se perderán todos los proyectos, tareas y datos asociados.
 </p>
 <Button variant="destructive"onClick={() => setDeleteOpen(true)} className="rounded-full">
 <Trash2 className="mr-2 h-4 w-4"/> Eliminar Organización
 </Button>
 </div>

 <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
 <DialogContent>
 <DialogHeader><DialogTitle>Eliminar Organización</DialogTitle></DialogHeader>
 <div className="space-y-4 py-2">
 <div className="flex items-center gap-3">
 <AlertTriangle className="h-8 w-8 text-destructive"/>
 <p className="text-sm">
 Esta acción es <strong>irreversible</strong>. Escribe <code className="rounded bg-muted px-1.5 py-0.5">{organization?.name || 'delete'}</code> para confirmar.
 </p>
 </div>
 <Input
 value={deleteConfirmText}
 onChange={(e) => setDeleteConfirmText(e.target.value)}
 placeholder="Escribe el nombre de la organización..."
 />
 </div>
 <DialogFooter>
 <Button variant="outline"onClick={() => setDeleteOpen(false)}>Cancelar</Button>
 <Button
 variant="destructive"
 onClick={handleDelete}
 disabled={deleting || deleteConfirmText !== (organization?.name || '')}
 >
 {deleting ? 'Eliminando...' : 'Eliminar Permanentemente'}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 </div>
 );
}
