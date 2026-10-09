import { z } from 'zod';

export const roleEnum = z.enum(['ADMIN', 'EMPLOYEE', 'CUSTOMER']);
export const adminTypeEnum = z.enum(['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'SALES_ADMIN']);
export const userStatusEnum = z.enum(['ACTIVE', 'INVITED', 'SUSPENDED']);
export const workModeEnum = z.enum(['OFFICE', 'REMOTE', 'HYBRID']);

const employeeProfileSchema = z.object({
  jobTitleId: z.string().cuid('Unvan secilmeli'),
  departmentId: z.string().cuid('Departman secilmeli'),
  employeeCode: z.string().trim().max(20).optional().nullable(),
  weeklyCapacityHours: z.number().int().min(1).max(80).default(40),
  workMode: workModeEnum.default('HYBRID'),
  hourlyCost: z.number().min(0).default(0),
  hireDate: z.coerce.date().optional().nullable(),
  skills: z.array(z.string().trim().min(1)).max(30).default([]),
  bio: z.string().max(1000).optional().nullable(),
});

export const createUserSchema = z
  .object({
    email: z.string().email('Gecerli bir e-posta girin').toLowerCase().trim(),
    password: z.string().min(8, 'Sifre en az 8 karakter olmali'),
    firstName: z.string().trim().min(2, 'Ad zorunlu').max(60),
    lastName: z.string().trim().min(2, 'Soyad zorunlu').max(60),
    phone: z.string().trim().max(30).optional().nullable(),
    avatarUrl: z.string().url().optional().nullable(),
    role: roleEnum,
    adminType: adminTypeEnum.optional().nullable(),
    status: userStatusEnum.default('ACTIVE'),
    extraPermissions: z.array(z.string()).default([]),
    deniedPermissions: z.array(z.string()).default([]),
    employeeProfile: employeeProfileSchema.optional(),
    /** role = CUSTOMER ise hangi musteriye bagli olacagi */
    customerId: z.string().cuid().optional(),
    position: z.string().trim().max(80).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === 'ADMIN' && !v.adminType) {
      ctx.addIssue({ code: 'custom', path: ['adminType'], message: 'Admin tipi secilmeli' });
    }
    if (v.role === 'EMPLOYEE' && !v.employeeProfile) {
      ctx.addIssue({ code: 'custom', path: ['employeeProfile'], message: 'Calisan icin unvan ve departman zorunlu' });
    }
    if (v.role === 'CUSTOMER' && !v.customerId) {
      ctx.addIssue({ code: 'custom', path: ['customerId'], message: 'Musteri kullanicisi bir musteriye baglanmali' });
    }
  });

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(2).max(60).optional(),
  lastName: z.string().trim().min(2).max(60).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  status: userStatusEnum.optional(),
  adminType: adminTypeEnum.optional().nullable(),
  extraPermissions: z.array(z.string()).optional(),
  deniedPermissions: z.array(z.string()).optional(),
  employeeProfile: employeeProfileSchema.partial().optional(),
});

export const listUsersSchema = z.object({
  role: roleEnum.optional(),
  status: userStatusEnum.optional(),
  departmentId: z.string().cuid().optional(),
  jobTitleId: z.string().cuid().optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Sifre en az 8 karakter olmali'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersSchema>;
