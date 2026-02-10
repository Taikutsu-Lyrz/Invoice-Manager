// Application constants

export const APP_NAME = 'Invoice Manager';
export const APP_VERSION = '1.0.0';

export const DEFAULT_CURRENCY = 'USD';
export const DEFAULT_CURRENCY_SYMBOL = '$';

export const INVOICE_STATUSES = [
    { value: 'draft', label: 'Draft', color: 'bg-gray-500' },
    { value: 'sent', label: 'Sent', color: 'bg-blue-500' },
    { value: 'paid', label: 'Paid', color: 'bg-green-500' },
    { value: 'partial', label: 'Partial', color: 'bg-yellow-500' },
    { value: 'overdue', label: 'Overdue', color: 'bg-red-500' },
    { value: 'void', label: 'Void', color: 'bg-gray-700' },
    { value: 'refunded', label: 'Refunded', color: 'bg-purple-500' },
] as const;

export const PAYMENT_METHODS = [
    { value: 'cash', label: 'Cash' },
    { value: 'bank', label: 'Bank Transfer' },
    { value: 'card', label: 'Card' },
    { value: 'check', label: 'Check' },
    { value: 'other', label: 'Other' },
] as const;

export const RECURRING_FREQUENCIES = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
] as const;

export const UNITS = [
    { value: 'pcs', label: 'Pieces' },
    { value: 'hrs', label: 'Hours' },
    { value: 'days', label: 'Days' },
    { value: 'kg', label: 'Kilograms' },
    { value: 'units', label: 'Units' },
    { value: 'items', label: 'Items' },
] as const;

export const DEFAULT_TAX_RATES = [
    { id: 'tax-0', name: 'No Tax', rate: 0, isDefault: true },
    { id: 'tax-5', name: 'VAT 5%', rate: 5, isDefault: false },
    { id: 'tax-10', name: 'VAT 10%', rate: 10, isDefault: false },
    { id: 'tax-20', name: 'VAT 20%', rate: 20, isDefault: false },
];

export const KEYBOARD_SHORTCUTS = {
    NEW_INVOICE: 'Ctrl+N',
    SAVE: 'Ctrl+S',
    SEARCH: 'Ctrl+K',
    EXPORT_PDF: 'Ctrl+P',
} as const;
