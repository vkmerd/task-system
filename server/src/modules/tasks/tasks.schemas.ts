import { z } from 'zod';
import { serviceTypeEnum } from '../customers/customers.schemas.js';

export const taskStatusEnum = z.enum([
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'REVISION',
  'WAITING_CUSTOMER',
  'DONE',
  'CANCELLED',
]);

export const taskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const createTaskSchema = z.object({
  title: z.string().trim().min(3, 'Baslik en az 3 karakter').max(200),
  description: z.string().max(10000).optional().nullable(),
  customerId: z.string().cuid('Musteri secilmeli'),
  projectId: z.string().cuid().optional().nullable(),
  serviceId: z.string().cuid().optional().nullable(),
  assigneeId: z.string().cuid().optional().nullable(),
  reviewerId: z.string().cuid().optional().nullable(),
  status: taskStatusEnum.default('TODO'),
  priority: taskPriorityEnum.default('MEDIUM'),
  estimatedHours: z.number().min(0).max(1000).optional().nullable(),
  startDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  isBillable: z.boolean().default(true),
  isVisibleToCustomer: z.boolean().default(true),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).default([]),
  checklist: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
});

export const updateTaskSchema = createTaskSchema
  .omit({ customerId: true, checklist: true })
  .partial();

export const listTasksSchema = z.object({
  customerId: z.string().cuid().optional(),
  projectId: z.string().cuid().optional(),
  assigneeId: z.string().cuid().optional(),
  status: z.union([taskStatusEnum, z.array(taskStatusEnum)]).optional(),
  priority: taskPriorityEnum.optional(),
  serviceType: serviceTypeEnum.optional(),
  search: z.string().trim().max(120).optional(),
  /** true: sadece gecikmis isler */
  overdue: z.coerce.boolean().optional(),
  /** true: atanmamis isler (operasyon admininin ilk baktigi kuyruk) */
  unassigned: z.coerce.boolean().optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
  sortBy: z.enum(['dueDate', 'priority', 'createdAt', 'updatedAt', 'status']).default('dueDate'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const assignTaskSchema = z.object({
  assigneeId: z.string().cuid().nullable(),
});

export const moveTaskSchema = z.object({
  status: taskStatusEnum,
  position: z.number().int().min(0).default(0),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Yorum bos olamaz').max(5000),
  isInternal: z.boolean().default(false),
});

export const timeLogSchema = z.object({
  minutes: z.number().int().min(1, 'Sure en az 1 dakika').max(24 * 60),
  workDate: z.coerce.date().default(() => new Date()),
  note: z.string().max(500).optional().nullable(),
  isBillable: z.boolean().default(true),
});

export const checklistItemSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  isDone: z.boolean().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksSchema>;
