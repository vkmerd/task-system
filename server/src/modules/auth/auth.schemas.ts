import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Gecerli bir e-posta girin').toLowerCase().trim(),
  password: z.string().min(1, 'Sifre zorunlu'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mevcut sifre zorunlu'),
    newPassword: z
      .string()
      .min(8, 'Sifre en az 8 karakter olmali')
      .regex(/[a-z]/, 'En az bir kucuk harf iceermeli')
      .regex(/[A-Z]/, 'En az bir buyuk harf icermeli')
      .regex(/[0-9]/, 'En az bir rakam icermeli'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Sifreler eslesmiyor',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
