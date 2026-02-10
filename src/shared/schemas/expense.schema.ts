import { z } from 'zod';

export const expenseCategorySchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, 'Name is required').max(100),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format'),
});

export const expenseSchema = z.object({
    id: z.string().uuid().optional(),
    categoryId: z.string().uuid({ message: 'Category is required' }),
    vendor: z.string().max(255).optional(),
    description: z.string().min(1, 'Description is required'),
    amount: z.number().min(0.01, 'Amount must be greater than 0'),
    taxAmount: z.number().min(0).default(0),
    expenseDate: z.string().min(1, 'Expense date is required'),
    notes: z.string().optional(),
    attachment: z.string().optional(),
});

export const createExpenseSchema = expenseSchema.omit({ id: true });
export const updateExpenseSchema = expenseSchema.partial().extend({ id: z.string().uuid() });

export type ExpenseCategoryFormData = z.infer<typeof expenseCategorySchema>;
export type ExpenseFormData = z.infer<typeof expenseSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
