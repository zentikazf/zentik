'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, CheckCircle2, AlertCircle, Building2, CalendarDays } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useOrg } from '@/providers/org-provider';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { getInitials, formatDate } from '@/lib/utils';

export default function ProfilePage() {
 const { user } = useAuth();
 const { organization } = useOrg();
 const fileInputRef = useRef<HTMLInputElement>(null);
 const [saving, setSaving] = useState(false);
 const [uploading, setUploading] = useState(false);
 const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
 const [form, setForm] = useState({ name: '' });

 useEffect(() => {
 if (user) {
 setForm({ name: user.name || '' });
 setAvatarUrl(user.image || null);
 }
 }, [user]);

 const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;

 if (file.size > 5 * 1024 * 1024) {
 toast.error('Archivo muy grande', 'El tamaño máximo es 5MB');
 return;
 }

 if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/)) {
 toast.error('Formato no válido', 'Solo se aceptan imágenes JPEG, PNG, WebP o GIF');
 return;
 }

 setUploading(true);
 try {
 const formData = new FormData();
 formData.append('avatar', file);

 const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/users/me/avatar`, {
 method: 'PATCH',
 body: formData,
 credentials: 'include',
 });

 if (!res.ok) {
 const body = await res.json().catch(() => ({}));
 throw new Error(body.message || 'Error al subir avatar');
 }

 const body = await res.json();
 setAvatarUrl(body.data?.image || body.data?.avatarUrl || avatarUrl);
 toast.success('Avatar actualizado', 'Tu foto de perfil ha sido actualizada');
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Error al subir avatar';
 toast.error('Error', message);
 } finally {
 setUploading(false);
 if (fileInputRef.current) fileInputRef.current.value = '';
 }
 };

 const handleSave = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!form.name.trim()) {
 toast.error('Error', 'El nombre no puede estar vacío');
 return;
 }
 setSaving(true);
 try {
 await api.patch('/users/me', { name: form.name.trim() });
 toast.success('Perfil actualizado', 'Tus datos han sido guardados correctamente');
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al actualizar el perfil';
 toast.error('Error', message);
 } finally {
 setSaving(false);
 }
 };

 return (
 <div className="space-y-7">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">Mi Perfil</h1>
 <p className="mt-1 text-sm text-muted-foreground">Gestiona tu información personal</p>
 </div>

 {/* Avatar & Info */}
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="flex flex-col items-center gap-6 sm:flex-row">
 <div className="relative">
 <Avatar className="h-24 w-24">
 <AvatarImage src={avatarUrl || undefined} />
 <AvatarFallback className="bg-primary/15 text-2xl font-semibold text-primary">
 {getInitials(user?.name || '')}
 </AvatarFallback>
 </Avatar>
 <button
 onClick={() => fileInputRef.current?.click()}
 disabled={uploading}
 className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-md transition-colors hover:bg-primary/90 disabled:opacity-50"
 title="Cambiar foto"
 >
 <Camera className="h-4 w-4"/>
 </button>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/jpeg,image/png,image/webp,image/gif"
 className="hidden"
 onChange={handleAvatarUpload}
 />
 </div>

 <div className="flex-1 text-center sm:text-left">
 <h2 className="text-xl font-semibold text-foreground">{user?.name}</h2>
 <div className="mt-1 flex items-center justify-center gap-2 sm:justify-start">
 <span className="text-sm text-muted-foreground">{user?.email}</span>
 {user?.emailVerified ? (
 <Badge className="bg-success/10 text-success">
 <CheckCircle2 className="mr-1 h-3 w-3"/> Verificado
 </Badge>
 ) : (
 <Badge className="bg-warning/10 text-warning">
 <AlertCircle className="mr-1 h-3 w-3"/> No verificado
 </Badge>
 )}
 </div>
 <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground sm:justify-start">
 {organization && (
 <span className="flex items-center gap-1.5">
 <Building2 className="h-4 w-4"/>
 {organization.name}
 </span>
 )}
 {user?.createdAt && (
 <span className="flex items-center gap-1.5">
 <CalendarDays className="h-4 w-4"/>
 Miembro desde {formatDate(user.createdAt)}
 </span>
 )}
 </div>
 </div>
 </div>
 </div>

 {/* Edit Profile Form */}
 <div className="rounded-xl border border-border bg-card p-6">
 <h3 className="mb-5 text-lg font-semibold text-foreground">Información Personal</h3>
 <form onSubmit={handleSave} className="space-y-4">
 <div className="space-y-2">
 <Label className="text-muted-foreground">Nombre</Label>
 <Input
 value={form.name}
 onChange={(e) => setForm({ name: e.target.value })}
 placeholder="Tu nombre completo"
 className="max-w-md"
 />
 </div>
 <div className="space-y-2">
 <Label className="text-muted-foreground">Email</Label>
 <Input value={user?.email || ''} disabled className="max-w-md bg-muted"/>
 <p className="text-xs text-muted-foreground">El email no se puede cambiar</p>
 </div>
 <div className="flex justify-end">
 <Button type="submit"disabled={saving} className="rounded-full">
 {saving ? 'Guardando...' : 'Guardar Cambios'}
 </Button>
 </div>
 </form>
 </div>
 </div>
 );
}
