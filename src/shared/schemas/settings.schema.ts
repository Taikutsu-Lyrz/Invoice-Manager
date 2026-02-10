import { z } from 'zod';

export const taxRateSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(50),
    rate: z.number().min(0).max(100),
    isDefault: z.boolean(),
});

export const settingsSchema = z.object({
    companyName: z.string().min(1, 'Company name is required').max(255),
    companyLogo: z.string().optional(),
    companyAddress: z.string().min(1, 'Address is required'),
    companyEmail: z.string().email('Invalid email'),
    companyPhone: z.string().max(50),
    taxId: z.string().max(50).optional(),
    invoicePrefix: z.string().min(1).max(20).default('INV'),
    invoiceNextNumber: z.number().int().min(1).default(1),
    currency: z.string().min(1).max(10).default('USD'),
    currencySymbol: z.string().min(1).max(5).default('$'),
    timezone: z.string().default('UTC'),
    defaultTerms: z.string().optional(),
    defaultNotes: z.string().optional(),
    footerText: z.string().optional(),
    taxRates: z.array(taxRateSchema).default([]),
    autoLockMinutes: z.number().int().min(0).default(15),
    pdfTemplate: z.enum(['classic', 'modern']).default('modern'),
    paperSize: z.enum(['a4', 'letter']).default('a4'),
});

export type SettingsFormData = z.infer<typeof settingsSchema>;
export type TaxRateFormData = z.infer<typeof taxRateSchema>;
