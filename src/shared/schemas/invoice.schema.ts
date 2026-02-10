import { z } from 'zod';

export const invoiceItemSchema = z.object({
    id: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
    unitPrice: z.number().min(0, 'Price must be positive'),
    taxRate: z.number().min(0).max(100).default(0),
    discountPercent: z.number().min(0).max(100).default(0),
});

export const invoiceSchema = z.object({
    id: z.string().uuid().optional(),
    clientId: z.string().uuid({ message: 'Please select a client' }),
    issueDate: z.string().min(1, 'Issue date is required'),
    dueDate: z.string().min(1, 'Due date is required'),
    items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
    notes: z.string().optional(),
    terms: z.string().optional(),
    status: z.enum(['draft', 'sent', 'paid', 'partial', 'overdue', 'void', 'refunded']).default('draft'),
});

export const createInvoiceSchema = invoiceSchema.omit({ id: true, status: true });
export const updateInvoiceSchema = invoiceSchema.partial().extend({ id: z.string().uuid() });

export type InvoiceItemFormData = z.infer<typeof invoiceItemSchema>;
export type InvoiceFormData = z.infer<typeof invoiceSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
