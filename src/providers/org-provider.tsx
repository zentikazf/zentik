'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { api } from '@/lib/api-client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  roleId: string;
  roleName: string;
}

interface OrgContextType {
  orgId: string | null;
  organization: Organization | null;
  organizations: Organization[];
  switchOrg: (orgId: string) => void;
  loading: boolean;
  ready: boolean;
}

const OrgContext = createContext<OrgContextType>({
  orgId: null,
  organization: null,
  organizations: [],
  switchOrg: () => {},
  loading: true,
  ready: false,
});

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { user, organizations, loading: authLoading } = useAuth();
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [creatingOrg, setCreatingOrg] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (organizations.length > 0 && !currentOrgId) {
      const savedOrgId = typeof window !== 'undefined'
        ? localStorage.getItem('zentik:orgId')
        : null;
      const validSaved = savedOrgId && organizations.some((o) => o.id === savedOrgId);
      setCurrentOrgId(validSaved ? savedOrgId : organizations[0].id);
    }

    // Auto-create org if user exists but has none (legacy users registered before auto-create)
    if (user && organizations.length === 0 && !creatingOrg) {
      setCreatingOrg(true);
      api.post('/organizations', { name: `${user.name || 'My'}'s Organization` })
        .then(() => {
          // Reload page to get fresh session with the new org
          window.location.reload();
        })
        .catch(() => {
          setCreatingOrg(false);
        });
    }
  }, [organizations, authLoading, currentOrgId, user, creatingOrg]);

  const switchOrg = useCallback(
    (orgId: string) => {
      const org = organizations.find((o) => o.id === orgId);
      if (org) {
        setCurrentOrgId(orgId);
        if (typeof window !== 'undefined') {
          localStorage.setItem('zentik:orgId', orgId);
        }
      }
    },
    [organizations],
  );

  const organization = organizations.find((o) => o.id === currentOrgId) ?? null;
  const isLoading = authLoading || creatingOrg;
  const ready = !isLoading && !!currentOrgId;

  return (
    <OrgContext.Provider
      value={{
        orgId: currentOrgId,
        organization,
        organizations,
        switchOrg,
        loading: isLoading,
        ready,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  return ctx;
}
