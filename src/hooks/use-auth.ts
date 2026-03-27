'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  image?: string | null;
  emailVerified: boolean;
  onboardingCompleted?: boolean;
  createdAt?: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
}

interface SessionResponse {
  user: AuthUser;
  organizations: Organization[];
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchSession() {
      try {
        const response = await api.get<SessionResponse>('/auth/me');
        setUser(response.data.user);
        setOrganizations(response.data.organizations);
      } catch {
        setUser(null);
        setOrganizations([]);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
      setOrganizations([]);
      router.push('/login');
    }
  }, [router]);

  return {
    user,
    organizations,
    loading,
    logout,
    isAuthenticated: !!user,
  };
}
