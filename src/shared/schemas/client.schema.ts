import { z } from 'zod';

export const clientSchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, 'Name is required').max(255),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().max(50).optional(),
    billingAddress: z.string().min(1, 'Billing address is required'),
    shippingAddress: z.string().optional(),
    taxNumber: z.string().max(50).optional(),
    notes: z.string().optional(),
});

export const createClientSchema = clientSchema.omit({ id: true });
export const updateClientSchema = clientSchema.partial().extend({ id: z.string().uuid() });

export type ClientFormData = z.infer<typeof clientSchema>;
export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
