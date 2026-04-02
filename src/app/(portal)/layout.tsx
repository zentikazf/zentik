'use client';

import { useState } from 'react';
import { PortalSidebar } from '@/components/portal/portal-sidebar';
import { PortalBottomNav } from '@/components/portal/portal-bottom-nav';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

function ChangePasswordModal({ onComplete }: { onComplete: () => void }) {
 const [password, setPassword] = useState('');
 const [confirm, setConfirm] = useState('');
 const [saving, setSaving] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (password.length < 6) { toast.error('Error', 'La contraseña debe tener al menos 6 caracteres'); return; }
 if (password !== confirm) { toast.error('Error', 'Las contraseñas no coinciden'); return; }
 setSaving(true);
 try {
 await api.patch('/auth/change-password', { newPassword: password });
 toast.success('Contraseña actualizada', 'Tu contraseña ha sido cambiada exitosamente');
 onComplete();
 } catch (err) {
 toast.error('Error', err instanceof ApiError ? err.message : 'Error al cambiar contraseña');
 } finally { setSaving(false); }
 };

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
 <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-2xl">
 <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white text-xl font-bold mx-auto">Z</div>
 <h2 className="mt-4 text-center text-xl font-semibold text-foreground">Cambiar Contraseña</h2>
 <p className="mt-2 text-center text-sm text-muted-foreground">Por seguridad, debes cambiar tu contraseña temporal antes de continuar.</p>
 <form onSubmit={handleSubmit} className="mt-6 space-y-4">
 <div>
 <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nueva contraseña</label>
 <input type="password"value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"required minLength={6} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"/>
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Confirmar contraseña</label>
 <input type="password"value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repite tu contraseña"required className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-ring"/>
 </div>
 <button type="submit"disabled={saving || !password || !confirm} className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">{saving ? 'Guardando...' : 'Cambiar Contraseña'}</button>
 </form>
 </div>
 </div>
 );
}

export default function PortalLayout({ children }: { children: React.ReactNode }) {
 const { isAuthenticated, loading, organizations, user } = useAuth();
 const [showChangePassword, setShowChangePassword] = useState(false);
 const router = useRouter();

 useEffect(() => {
 if (!loading && !isAuthenticated) {
 router.push('/login');
 }
 }, [loading, isAuthenticated, router]);

 useEffect(() => {
 if (!loading && isAuthenticated && organizations.length > 0) {
 const isClient = organizations.some((o) => o.roleName === 'Cliente');
 if (!isClient) {
 router.push('/dashboard');
 }
 }
 }, [loading, isAuthenticated, organizations, router]);

 useEffect(() => {
 if (!loading && isAuthenticated && user?.mustChangePassword) {
 setShowChangePassword(true);
 }
 }, [loading, isAuthenticated, user]);

 if (loading) {
 return (
 <div className="flex h-screen items-center justify-center">
 <div className="text-center">
 <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"/>
 <p className="mt-4 text-sm text-muted-foreground">Cargando portal...</p>
 </div>
 </div>
 );
 }

 if (!isAuthenticated) return null;

 return (
 <>
 {showChangePassword && (
 <ChangePasswordModal onComplete={() => { setShowChangePassword(false); window.location.reload(); }} />
 )}
 <div className="flex h-screen bg-background overflow-hidden">
 <PortalSidebar />
 <div className="flex flex-1 flex-col overflow-hidden relative">
 {/* Mobile Header (Anti-Notch / Branding) */}
 <header className="flex h-14 shrink-0 items-center justify-center border-b border-border bg-card/80 backdrop-blur-md px-4 lg:hidden z-40">
 <div className="flex items-center gap-2">
 <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-indigo-700 text-primary-foreground text-[10px] font-bold shadow-sm">
 Z
 </div>
 <span className="text-sm font-bold text-foreground tracking-wide">ZENTIK</span>
 </div>
 </header>

 <main className="flex-1 overflow-y-auto p-5 sm:p-6 md:p-8 pb-32 lg:pb-8">
 {children}
 </main>
 
 {/* Mobile Bottom Navigation */}
 <PortalBottomNav />
 </div>
 </div>
 </>
 );
}
