import { api } from '@/lib/api-client';
import type { Task } from '@/types';

export const taskService = {
  list: (projectId: string, params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.getPaginated<Task>(`/projects/${projectId}/tasks${query}`);
  },

  getById: (taskId: string) => api.get<Task>(`/tasks/${taskId}`),

  create: (projectId: string, data: Partial<Task>) =>
    api.post<Task>(`/projects/${projectId}/tasks`, data),

  update: (taskId: string, data: Partial<Task>) => api.patch<Task>(`/tasks/${taskId}`, data),

  delete: (taskId: string) => api.delete(`/tasks/${taskId}`),

  createSubtask: (taskId: string, data: Partial<Task>) =>
    api.post<Task>(`/tasks/${taskId}/subtasks`, data),

  listSubtasks: (taskId: string) => api.get<Task[]>(`/tasks/${taskId}/subtasks`),

  assign: (taskId: string, userId: string) =>
    api.post(`/tasks/${taskId}/assign`, { userId }),

  unassign: (taskId: string, userId: string) =>
    api.delete(`/tasks/${taskId}/assign/${userId}`),

  addLabel: (taskId: string, labelId: string) =>
    api.post(`/tasks/${taskId}/labels`, { labelId }),

  removeLabel: (taskId: string, labelId: string) =>
    api.delete(`/tasks/${taskId}/labels/${labelId}`),

  myTasks: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.getPaginated<Task>(`/users/me/tasks${query}`);
  },

  bulkUpdate: (projectId: string, operations: unknown[]) =>
    api.patch(`/projects/${projectId}/tasks/bulk`, { operations }),
};
