'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
 Mail,
 Shield,
 Monitor,
 Smartphone,
 Trash2,
 CheckCircle2,
 AlertCircle,
 KeyRound,
 Globe,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { formatDateTime } from '@/lib/utils';
import { updatePasswordSchema, type UpdatePasswordInput } from '@/lib/validations';
import { PasswordToggle } from '@/components/ui/password-input';

interface Session {
 id: string;
 ipAddress?: string;
 userAgent?: string;
 createdAt: string;
 expiresAt: string;
 isCurrent?: boolean;
}

function getDeviceInfo(userAgent?: string): { name: string; icon: typeof Monitor } {
 if (!userAgent) return { name: 'Dispositivo desconocido', icon: Globe };
 const ua = userAgent.toLowerCase();
 if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
 return { name: 'Dispositivo móvil', icon: Smartphone };
 }
 return { name: 'Escritorio', icon: Monitor };
}

function getBrowserName(userAgent?: string): string {
 if (!userAgent) return 'Navegador desconocido';
 if (userAgent.includes('Firefox')) return 'Firefox';
 if (userAgent.includes('Edg')) return 'Edge';
 if (userAgent.includes('Chrome')) return 'Chrome';
 if (userAgent.includes('Safari')) return 'Safari';
 if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
 return 'Navegador';
}

export default function SecurityPage() {
 const { user } = useAuth();
 const [sessions, setSessions] = useState<Session[]>([]);
 const [loadingSessions, setLoadingSessions] = useState(true);
 const [sendingVerification, setSendingVerification] = useState(false);
 const [revokingId, setRevokingId] = useState<string | null>(null);
 const [passwordForm, setPasswordForm] = useState<UpdatePasswordInput>({
 currentPassword: '',
 newPassword: '',
 confirmPassword: '',
 });
 const [passwordErrors, setPasswordErrors] = useState<Partial<Record<keyof UpdatePasswordInput, string>>>({});
 const [passwordGeneralError, setPasswordGeneralError] = useState('');
 const [updatingPassword, setUpdatingPassword] = useState(false);
 const [showCurrent, setShowCurrent] = useState(false);
 const [showNew, setShowNew] = useState(false);
 const [showConfirm, setShowConfirm] = useState(false);

 useEffect(() => {
 api.get<Session[]>('/auth/sessions')
 .then((res) => {
 const data = Array.isArray(res.data) ? res.data : [];
 setSessions(data);
 })
 .catch(() => {})
 .finally(() => setLoadingSessions(false));
 }, []);

 const handlePasswordFieldChange = (field: keyof UpdatePasswordInput, value: string) => {
 setPasswordForm((prev) => ({ ...prev, [field]: value }));
 if (passwordErrors[field]) setPasswordErrors((prev) => ({ ...prev, [field]: undefined }));
 if (passwordGeneralError) setPasswordGeneralError('');
 };

 const handleUpdatePassword = async (e: FormEvent) => {
 e.preventDefault();
 setPasswordErrors({});
 setPasswordGeneralError('');

 const result = updatePasswordSchema.safeParse(passwordForm);
 if (!result.success) {
 const errors: Partial<Record<keyof UpdatePasswordInput, string>> = {};
 result.error.errors.forEach((err) => {
 const field = err.path[0] as keyof UpdatePasswordInput;
 if (!errors[field]) errors[field] = err.message;
 });
 setPasswordErrors(errors);
 return;
 }

 setUpdatingPassword(true);
 try {
 await api.post('/auth/update-password', {
 currentPassword: result.data.currentPassword,
 newPassword: result.data.newPassword,
 });
 setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
 toast.success('Contraseña actualizada', 'Se cerraron otras sesiones activas por seguridad');
 // Refresh session list so revoked sessions disappear
 try {
 const res = await api.get<Session[]>('/auth/sessions');
 setSessions(Array.isArray(res.data) ? res.data : []);
 } catch {}
 } catch (err) {
 if (err instanceof ApiError) {
 if (err.code === 'INVALID_CURRENT_PASSWORD') {
 setPasswordErrors({ currentPassword: 'La contraseña actual es incorrecta' });
 } else if (err.code === 'PASSWORD_UNCHANGED') {
 setPasswordErrors({ newPassword: 'La nueva contraseña debe ser distinta de la actual' });
 } else if (err.code === 'INVALID_PASSWORD') {
 setPasswordErrors({ newPassword: err.message || 'La contraseña no cumple los requisitos' });
 } else if (err.code === 'NO_PASSWORD_SET') {
 setPasswordGeneralError('Esta cuenta no tiene contraseña configurada. Usa el flujo de restablecimiento.');
 } else {
 setPasswordGeneralError(err.message || 'No se pudo actualizar la contraseña');
 }
 } else {
 setPasswordGeneralError('No se pudo conectar al servidor. Verifica tu conexión.');
 }
 } finally {
 setUpdatingPassword(false);
 }
 };

 const handleResendVerification = async () => {
 setSendingVerification(true);
 try {
 await api.post('/auth/resend-verification');
 toast.success('Correo enviado', 'Revisa tu bandeja para verificar tu email');
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al enviar verificación';
 toast.error('Error', message);
 } finally {
 setSendingVerification(false);
 }
 };

 const handleRevokeSession = async (sessionId: string) => {
 setRevokingId(sessionId);
 try {
 await api.delete(`/auth/sessions/${sessionId}`);
 setSessions((prev) => prev.filter((s) => s.id !== sessionId));
 toast.success('Sesión revocada', 'La sesión ha sido cerrada exitosamente');
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al revocar sesión';
 toast.error('Error', message);
 } finally {
 setRevokingId(null);
 }
 };

 return (
 <div className="space-y-7">
 <div>
 <h1 className="text-[22px] font-semibold text-foreground">Seguridad</h1>
 <p className="mt-1 text-sm text-muted-foreground">Gestiona la seguridad de tu cuenta</p>
 </div>

 {/* Email Verification */}
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="mb-5 flex items-center gap-2">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
 <Mail className="h-5 w-5 text-primary"/>
 </div>
 <h3 className="text-lg font-semibold text-foreground">Verificación de Email</h3>
 </div>
 <div className="flex items-center justify-between">
 <div>
 <p className="text-[15px] text-foreground">{user?.email}</p>
 {user?.emailVerified ? (
 <div className="mt-1 flex items-center gap-1.5 text-sm text-success">
 <CheckCircle2 className="h-4 w-4"/>
 Email verificado
 </div>
 ) : (
 <div className="mt-1 flex items-center gap-1.5 text-sm text-warning">
 <AlertCircle className="h-4 w-4"/>
 Email no verificado
 </div>
 )}
 </div>
 {!user?.emailVerified && (
 <Button variant="outline"size="sm"className="rounded-full"onClick={handleResendVerification} disabled={sendingVerification}>
 {sendingVerification ? 'Enviando...' : 'Reenviar verificación'}
 </Button>
 )}
 </div>
 </div>

 {/* Password */}
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="mb-5 flex items-center gap-2">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/10">
 <KeyRound className="h-5 w-5 text-info"/>
 </div>
 <h3 className="text-lg font-semibold text-foreground">Contraseña</h3>
 </div>
 <p className="mb-4 text-sm text-muted-foreground">
 Actualiza tu contraseña regularmente. Al cambiarla se cerrarán las demás sesiones activas por seguridad.
 </p>

 {passwordGeneralError && (
 <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
 <p className="text-sm text-destructive">{passwordGeneralError}</p>
 </div>
 )}

 <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md" noValidate>
 <div>
 <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground">
 Contraseña actual
 </label>
 <div className="relative mt-1.5">
 <input
 id="currentPassword"
 type={showCurrent ? 'text' : 'password'}
 value={passwordForm.currentPassword}
 onChange={(e) => handlePasswordFieldChange('currentPassword', e.target.value)}
 autoComplete="current-password"
 className={`block w-full rounded-xl border px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
 passwordErrors.currentPassword
 ? 'border-destructive/30 bg-destructive/10 focus:border-destructive focus:ring-destructive/20'
 : 'border-border bg-muted focus:border-ring focus:ring-ring/20'
 }`}
 />
 <PasswordToggle visible={showCurrent} onToggle={() => setShowCurrent((v) => !v)} className="top-1" />
 </div>
 {passwordErrors.currentPassword && (
 <p className="mt-1 text-xs text-destructive">{passwordErrors.currentPassword}</p>
 )}
 </div>
 <div>
 <label htmlFor="newPassword" className="block text-sm font-medium text-foreground">
 Nueva contraseña
 </label>
 <div className="relative mt-1.5">
 <input
 id="newPassword"
 type={showNew ? 'text' : 'password'}
 value={passwordForm.newPassword}
 onChange={(e) => handlePasswordFieldChange('newPassword', e.target.value)}
 placeholder="Mínimo 8 caracteres"
 autoComplete="new-password"
 className={`block w-full rounded-xl border px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
 passwordErrors.newPassword
 ? 'border-destructive/30 bg-destructive/10 focus:border-destructive focus:ring-destructive/20'
 : 'border-border bg-muted focus:border-ring focus:ring-ring/20'
 }`}
 />
 <PasswordToggle visible={showNew} onToggle={() => setShowNew((v) => !v)} className="top-1" />
 </div>
 {passwordErrors.newPassword && (
 <p className="mt-1 text-xs text-destructive">{passwordErrors.newPassword}</p>
 )}
 </div>
 <div>
 <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
 Confirmar nueva contraseña
 </label>
 <div className="relative mt-1.5">
 <input
 id="confirmPassword"
 type={showConfirm ? 'text' : 'password'}
 value={passwordForm.confirmPassword}
 onChange={(e) => handlePasswordFieldChange('confirmPassword', e.target.value)}
 placeholder="Repite la nueva contraseña"
 autoComplete="new-password"
 className={`block w-full rounded-xl border px-4 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 ${
 passwordErrors.confirmPassword
 ? 'border-destructive/30 bg-destructive/10 focus:border-destructive focus:ring-destructive/20'
 : 'border-border bg-muted focus:border-ring focus:ring-ring/20'
 }`}
 />
 <PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)} className="top-1" />
 </div>
 {passwordErrors.confirmPassword && (
 <p className="mt-1 text-xs text-destructive">{passwordErrors.confirmPassword}</p>
 )}
 </div>
 <div className="flex flex-wrap items-center gap-3 pt-2">
 <Button type="submit" className="rounded-full" disabled={updatingPassword}>
 <KeyRound className="mr-2 h-4 w-4"/>
 {updatingPassword ? 'Actualizando...' : 'Actualizar contraseña'}
 </Button>
 <Link
 href="/forgot-password"
 className="text-sm font-medium text-primary hover:underline"
 >
 ¿Olvidaste tu contraseña?
 </Link>
 </div>
 </form>
 </div>

 {/* Active Sessions */}
 <div className="rounded-xl border border-border bg-card p-6">
 <div className="mb-5 flex items-center gap-2">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
 <Shield className="h-5 w-5 text-success"/>
 </div>
 <h3 className="text-lg font-semibold text-foreground">Sesiones Activas</h3>
 </div>
 <p className="mb-4 text-sm text-muted-foreground">
 Estas son las sesiones actualmente activas en tu cuenta. Revoca las que no reconozcas.
 </p>

 {loadingSessions ? (
 <div className="space-y-3">
 {Array.from({ length: 3 }).map((_, i) => (
 <Skeleton key={i} className="h-16 rounded-xl"/>
 ))}
 </div>
 ) : sessions.length === 0 ? (
 <p className="py-4 text-center text-sm text-muted-foreground">
 No se encontraron sesiones activas
 </p>
 ) : (
 <div className="space-y-3">
 {sessions.map((session) => {
 const device = getDeviceInfo(session.userAgent);
 const browser = getBrowserName(session.userAgent);
 const DeviceIcon = device.icon;

 return (
 <div
 key={session.id}
 className="flex items-center justify-between rounded-xl border border-border p-4"
 >
 <div className="flex items-center gap-3">
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
 <DeviceIcon className="h-5 w-5 text-muted-foreground"/>
 </div>
 <div>
 <div className="flex items-center gap-2">
 <p className="text-[15px] font-medium text-foreground">
 {browser} — {device.name}
 </p>
 {session.isCurrent && (
 <Badge className="bg-success/10 text-success">
 Sesión actual
 </Badge>
 )}
 </div>
 <div className="flex items-center gap-3 text-[13px] text-muted-foreground">
 {session.ipAddress && <span>IP: {session.ipAddress}</span>}
 <span>Iniciada: {formatDateTime(session.createdAt)}</span>
 </div>
 </div>
 </div>
 {!session.isCurrent && (
 <button
 onClick={() => handleRevokeSession(session.id)}
 disabled={revokingId === session.id}
 className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
 >
 <Trash2 className="h-3.5 w-3.5"/>
 {revokingId === session.id ? 'Revocando...' : 'Revocar'}
 </button>
 )}
 </div>
 );
 })}
 </div>
 )}
 </div>
 </div>
 );
}
