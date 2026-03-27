'use client';

import { PortalSidebar } from '@/components/portal/portal-sidebar';
import { PortalBottomNav } from '@/components/portal/portal-bottom-nav';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, organizations } = useAuth();
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          <p className="mt-4 text-sm text-gray-400">Cargando portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-background overflow-hidden">
      <PortalSidebar />
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 lg:pb-8">
          {children}
        </main>
        
        {/* Mobile Bottom Navigation */}
        <PortalBottomNav />
      </div>
    </div>
  );
}
