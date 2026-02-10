import { z } from 'zod';

export const productSchema = z.object({
    id: z.string().uuid().optional(),
    sku: z.string().max(50).optional(),
    name: z.string().min(1, 'Name is required').max(255),
    description: z.string().optional(),
    unit: z.string().min(1, 'Unit is required').max(20),
    price: z.number().min(0, 'Price must be positive'),
    cost: z.number().min(0).optional(),
    taxRateId: z.string().uuid().optional(),
    stock: z.number().int().optional(),
    trackStock: z.boolean().default(false),
    image: z.string().optional(), // Path to product image
});

export const createProductSchema = productSchema.omit({ id: true });
export const updateProductSchema = productSchema.partial().extend({ id: z.string().uuid() });

export type ProductFormData = z.infer<typeof productSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
