'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

interface ProjectContextType {
  project: any;
  loading: boolean;
  refetch: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType>({
  project: null,
  loading: true,
  refetch: async () => {},
});

export function ProjectProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}`);
      setProject(res.data);
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  return (
    <ProjectContext.Provider value={{ project, loading, refetch }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  return useContext(ProjectContext);
}
