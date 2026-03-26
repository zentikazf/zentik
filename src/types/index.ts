// ── Enums ──────────────────────────────────────────

export enum ProjectStatus {
  DEFINITION = 'DEFINITION',
  DEVELOPMENT = 'DEVELOPMENT',
  PRODUCTION = 'PRODUCTION',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
}

export enum TaskPriority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  NONE = 'NONE',
}

export enum TaskStatus {
  BACKLOG = 'BACKLOG',
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  TESTING = 'TESTING',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum SprintStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum SubscriptionStatus {
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum PlanTier {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum NotificationType {
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_COMMENTED = 'TASK_COMMENTED',
  SPRINT_STARTED = 'SPRINT_STARTED',
  SPRINT_COMPLETED = 'SPRINT_COMPLETED',
  MENTION = 'MENTION',
  INVITATION = 'INVITATION',
  INVOICE_SENT = 'INVOICE_SENT',
  SYSTEM = 'SYSTEM',
}

export enum FileCategory {
  ATTACHMENT = 'ATTACHMENT',
  AVATAR = 'AVATAR',
  PROJECT_COVER = 'PROJECT_COVER',
  DOCUMENT = 'DOCUMENT',
}

// ── API Response Types ─────────────────────────────

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationLinks {
  self: string;
  first: string;
  prev: string | null;
  next: string | null;
  last: string;
}

export interface ApiPaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
  links: PaginationLinks;
  timestamp: string;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  correlationId: string;
  timestamp: string;
  path: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
  fields?: string;
}

export interface CursorPaginationQuery {
  cursor?: string;
  limit?: number;
}

// ── Entity Types ───────────────────────────────────

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string | null;
  timezone: string;
  locale: string;
  onboardingDone: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  website: string | null;
  plan: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  organizationId: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  maxProjects: number;
  maxMembers: number;
  maxStorageBytes: number;
  features: string[];
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  roleId: string;
  joinedAt: string;
  user?: User;
  role?: Role;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  organizationId: string;
  isDefault: boolean;
  isSystem: boolean;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  action: string;
  resource: string;
  description: string | null;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  coverImage: string | null;
  hourlyRate: number | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  clientName: string | null;
  clientEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
  columns?: BoardColumn[];
}

export interface BoardColumn {
  id: string;
  boardId: string;
  name: string;
  position: number;
  color: string;
  wipLimit: number | null;
  tasks?: Task[];
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  status: SprintStatus;
  startDate: string | null;
  endDate: string | null;
  velocity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  sprintId: string | null;
  boardColumnId: string | null;
  parentId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  storyPoints: number | null;
  dueDate: string | null;
  startDate: string | null;
  completedAt: string | null;
  estimatedHours: number | null;
  totalTimeSpent: number;
  createdAt: string;
  updatedAt: string;
  assignees?: User[];
  labels?: Label[];
  subtasks?: Task[];
}

export interface Label {
  id: string;
  projectId: string;
  name: string;
  color: string;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  billable: boolean;
  createdAt: string;
  task?: Task;
  user?: User;
}

export interface Channel {
  id: string;
  projectId: string;
  name: string;
  isDefault: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  parentId: string | null;
  editedAt: string | null;
  createdAt: string;
  user?: User;
  replies?: Message[];
}

export interface Comment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  editedAt: string | null;
  createdAt: string;
  user?: User;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface ZentikFile {
  id: string;
  projectId: string | null;
  taskId: string | null;
  uploaderId: string;
  name: string;
  key: string;
  url: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  createdAt: string;
}

export interface Invoice {
  id: string;
  projectId: string;
  number: string;
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  notes: string | null;
  paidAt: string | null;
  dueDate: string | null;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

// ── Role Permission Suggestions ────────────────────

export const ROLE_PERMISSION_SUGGESTIONS: Record<
  string,
  { action: string; resource: string }[]
> = {
  Owner: [{ action: '*', resource: '*' }],
  'Product Owner': [
    { action: 'manage', resource: 'projects' },
    { action: 'manage', resource: 'tasks' },
    { action: 'manage', resource: 'sprints' },
    { action: 'manage', resource: 'boards' },
    { action: 'read', resource: 'members' },
    { action: 'read', resource: 'billing' },
    { action: 'manage', resource: 'chat' },
  ],
  'Project Manager': [
    { action: 'manage', resource: 'projects' },
    { action: 'manage', resource: 'tasks' },
    { action: 'manage', resource: 'sprints' },
    { action: 'manage', resource: 'boards' },
    { action: 'manage', resource: 'members' },
    { action: 'manage', resource: 'time-entries' },
    { action: 'read', resource: 'billing' },
    { action: 'manage', resource: 'chat' },
    { action: 'read', resource: 'audit' },
  ],
  'Tech Lead': [
    { action: 'read', resource: 'projects' },
    { action: 'manage', resource: 'tasks' },
    { action: 'manage', resource: 'sprints' },
    { action: 'manage', resource: 'boards' },
    { action: 'manage', resource: 'time-entries' },
    { action: 'read', resource: 'members' },
    { action: 'manage', resource: 'chat' },
  ],
  Developer: [
    { action: 'read', resource: 'projects' },
    { action: 'manage', resource: 'tasks' },
    { action: 'read', resource: 'sprints' },
    { action: 'read', resource: 'boards' },
    { action: 'manage', resource: 'time-entries' },
    { action: 'manage', resource: 'chat' },
  ],
  'QA Engineer': [
    { action: 'read', resource: 'projects' },
    { action: 'manage', resource: 'tasks' },
    { action: 'read', resource: 'sprints' },
    { action: 'read', resource: 'boards' },
    { action: 'manage', resource: 'time-entries' },
    { action: 'manage', resource: 'chat' },
  ],
  Designer: [
    { action: 'read', resource: 'projects' },
    { action: 'manage', resource: 'tasks' },
    { action: 'read', resource: 'boards' },
    { action: 'manage', resource: 'time-entries' },
    { action: 'manage', resource: 'chat' },
  ],
  DevOps: [
    { action: 'read', resource: 'projects' },
    { action: 'read', resource: 'tasks' },
    { action: 'read', resource: 'sprints' },
    { action: 'manage', resource: 'time-entries' },
    { action: 'manage', resource: 'chat' },
  ],
  Soporte: [
    { action: 'read', resource: 'projects' },
    { action: 'read', resource: 'tasks' },
    { action: 'manage', resource: 'time-entries' },
    { action: 'manage', resource: 'chat' },
  ],
};
