'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { OrgProvider, useOrg } from '@/providers/org-provider';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { api } from '@/lib/api-client';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { organization, ready } = useOrg();
  const { user } = useAuth();

  useEffect(() => {
    if (!ready || !organization || !user) return;

    if (!user.onboardingCompleted) {
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
