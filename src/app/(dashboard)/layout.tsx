'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { OrgProvider, useOrg } from '@/providers/org-provider';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { FolderKanban } from 'lucide-react';
import { PasswordToggle } from '@/components/ui/password-input';

function WelcomeChangePasswordModal({ onComplete, userName, roleName, orgName }: { onComplete: () => void; userName?: string; roleName?: string; orgName?: string }) {
 const [step, setStep] = useState<'welcome' | 'password'>('welcome');
 const [password, setPassword] = useState('');
 const [confirm, setConfirm] = useState('');
 const [saving, setSaving] = useState(false);
 const [showPassword, setShowPassword] = useState(false);
 const [showConfirm, setShowConfirm] = useState(false);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (password.length < 6) {
 toast.error('Error', 'La contrasena debe tener al menos 6 caracteres');
 return;
 }
 if (password !== confirm) {
 toast.error('Error', 'Las contrasenas no coinciden');
 return;
 }
 setSaving(true);
 try {
 await api.patch('/auth/change-password', { newPassword: password });
 toast.success('Contrasena actualizada', 'Tu contrasena ha sido cambiada exitosamente');
 onComplete();
 } catch (err) {
 const message = err instanceof ApiError ? err.message : 'Error al cambiar contrasena';
 toast.error('Error', message);
 } finally {
 setSaving(false);
 }
 };

 return (
 <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
 <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-2xl">
 {step === 'welcome' ? (
 <div className="text-center">
 <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold shadow-lg">
 Z
 </div>
 <h2 className="text-2xl font-bold text-card-foreground">
 Bienvenido al equipo{userName ? `, ${userName.split(' ')[0]}` : ''}!
 </h2>
 {orgName && (
 <p className="mt-2 text-sm text-muted-foreground">
 Te han agregado a <span className="font-semibold text-foreground">{orgName}</span>
 </p>
 )}
 {roleName && (
 <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2">
 <span className="text-xs text-muted-foreground">Tu rol:</span>
 <span className="text-sm font-semibold text-foreground">{roleName}</span>
 </div>
 )}
 <p className="mt-5 text-sm text-muted-foreground">
 Para comenzar, necesitamos que configures tu contrasena personal.
 </p>
 <button
 onClick={() => setStep('password')}
 className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
 >
 Configurar mi contrasena
 </button>
 </div>
 ) : (
 <>
 <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold mx-auto">
 Z
 </div>
 <h2 className="mt-4 text-center text-xl font-semibold text-card-foreground">
 Crea tu contrasena
 </h2>
 <p className="mt-2 text-center text-sm text-muted-foreground">
 Elige una contrasena segura para tu cuenta.
 </p>
 <form onSubmit={handleSubmit} className="mt-6 space-y-4">
 <div>
 <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nueva contrasena</label>
 <div className="relative">
 <input
 type={showPassword ? 'text' : 'password'}
 value={password}
 onChange={(e) => setPassword(e.target.value)}
 placeholder="Minimo 6 caracteres"
 required
 minLength={6}
 autoFocus
 className="w-full rounded-md border border-input bg-background px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
 />
 <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} className="top-1" />
 </div>
 </div>
 <div>
 <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Confirmar contrasena</label>
 <div className="relative">
 <input
 type={showConfirm ? 'text' : 'password'}
 value={confirm}
 onChange={(e) => setConfirm(e.target.value)}
 placeholder="Repite tu contrasena"
 required
 className="w-full rounded-md border border-input bg-background px-4 py-3 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
 />
 <PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)} className="top-1" />
 </div>
 </div>
 <button
 type="submit"
 disabled={saving || !password || !confirm}
 className="w-full rounded-md bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
 >
 {saving ? 'Guardando...' : 'Comenzar'}
 </button>
 </form>
 </>
 )}
 </div>
 </div>
 );
}

function DashboardContent({ children }: { children: React.ReactNode }) {
 const [sidebarOpen, setSidebarOpen] = useState(false);
 const [showOnboarding, setShowOnboarding] = useState(false);
 const [showChangePassword, setShowChangePassword] = useState(false);
 const { organization, ready } = useOrg();
 const { user } = useAuth();

 useEffect(() => {
 if (!ready || !organization || !user) return;

 if (user.mustChangePassword) {
 setShowChangePassword(true);
 return;
 }

 if (!user.onboardingCompleted) {
 const isOwner = organization.roleName === 'Owner';
 if (isOwner) {
 setShowOnboarding(true);
 } else {
 api.patch('/auth/onboarding-complete').catch(() => {});
 }
 }
 }, [ready, organization, user]);

 const handleOnboardingComplete = async () => {
 try {
 await api.patch('/auth/onboarding-complete');
 } catch {
 // silently continue
 }
 setShowOnboarding(false);
 window.location.reload();
 };

 return (
 <>
 {showChangePassword && (
 <WelcomeChangePasswordModal
 userName={user?.name}
 roleName={organization?.roleName}
 orgName={organization?.name}
 onComplete={() => { setShowChangePassword(false); window.location.reload(); }}
 />
 )}
 {showOnboarding && <OnboardingFlow onComplete={handleOnboardingComplete} />}
 <div className="flex h-screen overflow-hidden">
 <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onToggle={() => setSidebarOpen(prev => !prev)} />
 <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
 <div className="p-4 sm:p-6 lg:p-8">
 {children}
 </div>
 </main>
 </div>
 </>
 );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
 const { isAuthenticated, loading, organizations } = useAuth();
 const router = useRouter();

 useEffect(() => {
 if (!loading && !isAuthenticated) {
 router.push('/login');
 }
 }, [loading, isAuthenticated, router]);

 useEffect(() => {
 if (!loading && isAuthenticated && organizations.length > 0) {
 const isClient = organizations.every((o) => o.roleName === 'Cliente');
 if (isClient) {
 router.push('/portal');
 }
 }
 }, [loading, isAuthenticated, organizations, router]);

 const isClient = !loading && isAuthenticated && organizations.length > 0 && organizations.every((o) => o.roleName === 'Cliente');

 if (loading || isClient) {
 return (
 <div className="flex h-screen flex-col items-center justify-center bg-background">
 <p className="text-lg font-semibold text-foreground">Onnix</p>
 <div className="mt-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"/>
 </div>
 );
 }

 if (!isAuthenticated) return null;

 return (
 <OrgProvider>
 <DashboardContent>{children}</DashboardContent>
 </OrgProvider>
 );
}
