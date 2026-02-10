import { z } from 'zod';

export const paymentSchema = z.object({
    id: z.string().uuid().optional(),
    invoiceId: z.string().uuid({ message: 'Invoice is required' }),
    amount: z.number().min(0.01, 'Amount must be greater than 0'),
    method: z.enum(['cash', 'bank', 'card', 'check', 'other']),
    reference: z.string().max(100).optional(),
    paymentDate: z.string().min(1, 'Payment date is required'),
    notes: z.string().optional(),
    isRefund: z.boolean().default(false),
});

export const createPaymentSchema = paymentSchema.omit({ id: true });

export type PaymentFormData = z.infer<typeof paymentSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
