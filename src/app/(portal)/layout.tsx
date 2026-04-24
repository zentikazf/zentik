'use client';

import { useState, useEffect } from 'react';
import { PortalSidebar } from '@/components/portal/portal-sidebar';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';
import { PasswordToggle } from '@/components/ui/password-input';

function WelcomeChangePasswordModal({ onComplete, userName }: { onComplete: () => void; userName?: string }) {
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
       <img src="https://onnix.com.py/assets/img/logo.svg" alt="Onnix" className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold text-card-foreground">
       Bienvenido{userName ? `, ${userName.split(' ')[0]}` : ''}!
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
       Te damos la bienvenida al portal de clientes de <span className="font-semibold text-foreground">Onnix</span>
      </p>
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
      <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
       <img src="https://onnix.com.py/assets/img/logo.svg" alt="Onnix" className="h-8 w-8" />
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

export default function PortalLayout({ children }: { children: React.ReactNode }) {
 const { isAuthenticated, loading, organizations, user } = useAuth();
 const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <WelcomeChangePasswordModal
     userName={user?.name}
     onComplete={() => { setShowChangePassword(false); window.location.reload(); }}
    />
   )}
   <div className="flex h-screen overflow-hidden">
    <PortalSidebar
     isOpen={sidebarOpen}
     onClose={() => setSidebarOpen(false)}
     onToggle={() => setSidebarOpen(prev => !prev)}
    />
    <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
     <div className="p-4 sm:p-6 lg:p-8">
      {children}
     </div>
    </main>
   </div>
  </>
 );
}
