import { api } from '@/lib/api-client';
import type { Sprint } from '@/types';

export const sprintService = {
  list: (projectId: string) => api.get<Sprint[]>(`/projects/${projectId}/sprints`),

  getActive: (projectId: string) => api.get<Sprint>(`/projects/${projectId}/sprints/active`),

  getById: (sprintId: string) => api.get<Sprint>(`/sprints/${sprintId}`),

  create: (projectId: string, data: Partial<Sprint>) =>
    api.post<Sprint>(`/projects/${projectId}/sprints`, data),

  update: (sprintId: string, data: Partial<Sprint>) =>
    api.patch<Sprint>(`/sprints/${sprintId}`, data),

  start: (sprintId: string) => api.post(`/sprints/${sprintId}/start`),

  complete: (sprintId: string) => api.post(`/sprints/${sprintId}/complete`),

  addTasks: (sprintId: string, taskIds: string[]) =>
    api.post(`/sprints/${sprintId}/tasks`, { taskIds }),

  removeTask: (sprintId: string, taskId: string) =>
    api.delete(`/sprints/${sprintId}/tasks/${taskId}`),

  getBurndown: (sprintId: string) =>
    api.get<unknown>(`/sprints/${sprintId}/burndown`),

  getBacklog: (projectId: string) =>
    api.get<unknown[]>(`/projects/${projectId}/backlog`),
};
