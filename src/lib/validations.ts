import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email invalido'),
  password: z.string().min(1, 'La contrasena es requerida'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Minimo 2 caracteres').max(100),
  email: z.string().email('Email invalido'),
  password: z
    .string()
    .min(8, 'Minimo 8 caracteres')
    .max(100)
    .regex(/[A-Z]/, 'Debe contener al menos una mayuscula')
    .regex(/[0-9]/, 'Debe contener al menos un numero'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalido'),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Minimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contrasenas no coinciden',
    path: ['confirmPassword'],
  });

export const createProjectSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  description: z.string().max(500).optional(),
  hourlyRate: z.coerce.number().min(0).optional(),
  currency: z.string().default('USD'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  clientName: z.string().max(100).optional(),
  clientEmail: z.string().email().optional().or(z.literal('')),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, 'El titulo es requerido').max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).default('NONE'),
  storyPoints: z.coerce.number().min(0).max(100).optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.coerce.number().min(0).optional(),
});

export const createSprintSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  goal: z.string().max(500).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Minimo 2 caracteres').max(100),
  description: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal('')),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1, 'El mensaje no puede estar vacio').max(5000),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type CreateSprintInput = z.infer<typeof createSprintSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
