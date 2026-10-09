import { z } from 'zod';

export const serviceTypeEnum = z.enum([
  'SEO',
  'GOOGLE_ADS',
  'META_ADS',
  'SOCIAL_MEDIA',
  'CONTENT',
  'DESIGN',
  'WEB_DEVELOPMENT',
  'EMAIL_MARKETING',
  'INFLUENCER',
  'PR',
  'ANALYTICS',
  'OTHER',
]);

export const customerStatusEnum = z.enum(['PROSPECT', 'ACTIVE', 'PAUSED', 'CHURNED']);

export const createCustomerSchema = z.object({
  companyName: z.string().trim().min(2, 'Firma adi zorunlu').max(120),
  legalName: z.string().trim().max(160).optional().nullable(),
  taxNumber: z.string().trim().max(30).optional().nullable(),
  taxOffice: z.string().trim().max(80).optional().nullable(),
  sector: z.string().trim().max(80).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  logoUrl: z.string().trim().max(500).optional().nullable(),
  status: customerStatusEnum.default('PROSPECT'),
  contractStartDate: z.coerce.date().optional().nullable(),
  contractEndDate: z.coerce.date().optional().nullable(),
  monthlyRetainer: z.number().min(0).default(0),
  currency: z.enum(['TRY', 'USD', 'EUR']).default('TRY'),
  contractedHours: z.number().int().min(0).default(0),
  accountManagerId: z.string().cuid().optional().nullable(),
  healthScore: z.number().int().min(0).max(100).default(70),
  notes: z.string().max(4000).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const listCustomersSchema = z.object({
  status: customerStatusEnum.optional(),
  accountManagerId: z.string().cuid().optional(),
  serviceType: serviceTypeEnum.optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const customerServiceSchema = z.object({
  serviceType: serviceTypeEnum,
  monthlyBudget: z.number().min(0).default(0),
  monthlyHours: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  notes: z.string().max(1000).optional().nullable(),
});

/** Musteri kadrosuna calisan ekleme - is dagiliminin temeli */
export const teamSeatSchema = z.object({
  userId: z.string().cuid('Calisan secilmeli'),
  service: serviceTypeEnum.optional().nullable(),
  allocatedHours: z.number().int().min(0).max(200).default(0),
  isLead: z.boolean().default(false),
});

export const contactSchema = z.object({
  fullName: z.string().trim().min(2, 'Ad soyad zorunlu').max(120),
  email: z.string().email('Gecerli bir e-posta girin').toLowerCase().trim(),
  phone: z.string().trim().max(30).optional().nullable(),
  position: z.string().trim().max(80).optional().nullable(),
  isPrimary: z.boolean().default(false),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersSchema>;
export type TeamSeatInput = z.infer<typeof teamSeatSchema>;
