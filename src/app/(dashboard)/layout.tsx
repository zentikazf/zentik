'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { OrgProvider, useOrg } from '@/providers/org-provider';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { api, ApiError } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

function ChangePasswordModal({ onComplete }: { onComplete: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      toast.error('Error', 'Las contraseñas no coinciden');
      return;
    }
    setSaving(true);
    try {
      await api.patch('/auth/change-password', { newPassword: password });
      toast.success('Contraseña actualizada', 'Tu contraseña ha sido cambiada exitosamente');
      onComplete();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al cambiar contraseña';
      toast.error('Error', message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl dark:bg-gray-900">
        <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white text-xl font-bold mx-auto">
          Z
        </div>
        <h2 className="mt-4 text-center text-xl font-semibold text-gray-800 dark:text-white">
          Cambiar Contraseña
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          Por seguridad, debes cambiar tu contraseña temporal antes de continuar.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Nueva contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              minLength={6}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-500">Confirmar contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repite tu contraseña"
              required
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !password || !confirm}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Cambiar Contraseña'}
          </button>
        </form>
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
    } else if (!user.onboardingCompleted) {
      setShowOnboarding(true);
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
        <ChangePasswordModal onComplete={() => { setShowChangePassword(false); window.location.reload(); }} />
      )}
      {showOnboarding && <OnboardingFlow onComplete={handleOnboardingComplete} />}
      <div className="flex h-screen bg-gray-50 dark:bg-background overflow-hidden">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
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

  // Redirect clients to portal
  useEffect(() => {
    if (!loading && isAuthenticated && organizations.length > 0) {
      const isClient = organizations.every((o) => o.roleName === 'Cliente');
      if (isClient) {
        router.push('/portal');
      }
    }
  }, [loading, isAuthenticated, organizations, router]);

  // Show branded loading while auth or redirect is resolving
  const isClient = !loading && isAuthenticated && organizations.length > 0 && organizations.every((o) => o.roleName === 'Cliente');

  if (loading || isClient) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 dark:bg-background">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white text-xl font-bold mb-4">
          Z
        </div>
        <p className="text-lg font-semibold text-gray-800 dark:text-white">zentik</p>
        <div className="mt-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
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
