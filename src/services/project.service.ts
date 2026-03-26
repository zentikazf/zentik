import { api } from '@/lib/api-client';
import type { Project } from '@/types';

export const projectService = {
  list: (orgId: string, params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.getPaginated<Project>(`/organizations/${orgId}/projects${query}`);
  },

  getById: (projectId: string) => api.get<Project>(`/projects/${projectId}`),

  create: (orgId: string, data: Partial<Project>) =>
    api.post<Project>(`/organizations/${orgId}/projects`, data),

  update: (projectId: string, data: Partial<Project>) =>
    api.patch<Project>(`/projects/${projectId}`, data),

  delete: (projectId: string) => api.delete(`/projects/${projectId}`),

  getStats: (projectId: string) =>
    api.get<Record<string, number>>(`/projects/${projectId}/stats`),

  listMembers: (projectId: string) =>
    api.get<unknown[]>(`/projects/${projectId}/members`),

  addMember: (projectId: string, memberId: string) =>
    api.post(`/projects/${projectId}/members`, { organizationMemberId: memberId }),

  removeMember: (projectId: string, memberId: string) =>
    api.delete(`/projects/${projectId}/members/${memberId}`),
};
