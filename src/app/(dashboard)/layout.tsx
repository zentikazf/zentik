'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { OrgProvider, useOrg } from '@/providers/org-provider';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { organization, ready } = useOrg();
  const { user } = useAuth();

  useEffect(() => {
    if (!ready || !organization || !user) return;

    // Show onboarding if org name is auto-generated ("{name}'s Organization")
    const isAutoName = organization.name.endsWith("'s Organization");
    const dismissed = typeof window !== 'undefined'
      ? localStorage.getItem(`zentik:onboarding:${organization.id}`)
      : null;

    if (isAutoName && !dismissed) {
      setShowOnboarding(true);
    }
  }, [ready, organization, user]);

  const handleOnboardingComplete = () => {
    if (organization) {
      localStorage.setItem(`zentik:onboarding:${organization.id}`, 'done');
    }
    setShowOnboarding(false);
    window.location.reload();
  };

  return (
    <>
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Cargando...</p>
        </div>
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
