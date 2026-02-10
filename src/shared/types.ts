// Core entity types for Invoice & Revenue Manager

export interface Profile {
    id: string;
    name: string;
    pinHash?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Settings {
    id: string;
    profileId: string;
    companyName: string;
    companyLogo?: string;
    companyAddress: string;
    companyEmail: string;
    companyPhone: string;
    taxId?: string;
    invoicePrefix: string;
    invoiceNextNumber: number;
    currency: string;
    currencySymbol: string;
    timezone: string;
    defaultTerms?: string;
    defaultNotes?: string;
    footerText?: string;
    taxRates: TaxRate[];
    autoLockMinutes: number;
    pdfTemplate: 'classic' | 'modern';
    paperSize: 'a4' | 'letter';
}

export interface TaxRate {
    id: string;
    name: string;
    rate: number;
    isDefault: boolean;
}

export interface Client {
    id: string;
    profileId: string;
    name: string;
    email?: string;
    phone?: string;
    billingAddress: string;
    shippingAddress?: string;
    taxNumber?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface Product {
    id: string;
    profileId: string;
    sku?: string;
    name: string;
    description?: string;
    unit: string;
    price: number;
    cost?: number;
    taxRateId?: string;
    stock?: number;
    trackStock: boolean;
    createdAt: string;
    updatedAt: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'void' | 'refunded';

export interface Invoice {
    id: string;
    profileId: string;
    invoiceNumber: string;
    clientId: string;
    client?: Client;
    status: InvoiceStatus;
    issueDate: string;
    dueDate: string;
    items: InvoiceItem[];
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
    notes?: string;
    terms?: string;
    attachments: string[];
    recurringRule?: RecurringRule;
    createdAt: string;
    updatedAt: string;
}

export interface InvoiceItem {
    id: string;
    invoiceId: string;
    productId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    taxAmount: number;
    discountPercent: number;
    discountAmount: number;
    lineTotal: number;
}

export interface RecurringRule {
    frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    nextDate: string;
    endDate?: string;
    enabled: boolean;
}

export type PaymentMethod = 'cash' | 'bank' | 'card' | 'check' | 'other';

export interface Payment {
    id: string;
    profileId: string;
    invoiceId: string;
    invoice?: Invoice;
    amount: number;
    method: PaymentMethod;
    reference?: string;
    paymentDate: string;
    notes?: string;
    isRefund: boolean;
    createdAt: string;
}

export interface Expense {
    id: string;
    profileId: string;
    categoryId: string;
    category?: ExpenseCategory;
    vendor?: string;
    description: string;
    amount: number;
    taxAmount: number;
    expenseDate: string;
    notes?: string;
    attachment?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ExpenseCategory {
    id: string;
    profileId: string;
    name: string;
    color: string;
}

export interface AuditLog {
    id: string;
    profileId: string;
    action: string;
    entityType: string;
    entityId: string;
    details?: string;
    createdAt: string;
}

// Dashboard types
export interface DashboardStats {
    revenueThisMonth: number;
    revenueLastMonth: number;
    revenueYTD: number;
    outstandingReceivables: number;
    overdueAmount: number;
    profitEstimate: number;
    totalExpenses: number;
    netProfit: number;
}

export interface ChartData {
    name: string;
    value: number;
}

// IPC Channel types
export type IPCChannel =
    | 'db:init'
    | 'auth:get-profiles'
    | 'auth:create-profile'
    | 'auth:verify-pin'
    | 'auth:set-pin'
    | 'settings:get'
    | 'settings:update'
    | 'clients:list'
    | 'clients:get'
    | 'clients:create'
    | 'clients:update'
    | 'clients:delete'
    | 'products:list'
    | 'products:get'
    | 'products:create'
    | 'products:update'
    | 'products:delete'
    | 'invoices:list'
    | 'invoices:get'
    | 'invoices:create'
    | 'invoices:update'
    | 'invoices:delete'
    | 'invoices:generate-pdf'
    | 'invoices:send-email'
    | 'payments:list'
    | 'payments:get'
    | 'payments:create'
    | 'payments:delete'
    | 'payments:generate-receipt'
    | 'expenses:list'
    | 'expenses:get'
    | 'expenses:create'
    | 'expenses:update'
    | 'expenses:delete'
    | 'expense-categories:list'
    | 'expense-categories:create'
    | 'expense-categories:update'
    | 'expense-categories:delete'
    | 'reports:sales'
    | 'reports:tax'
    | 'reports:profit'
    | 'reports:payments'
    | 'reports:expenses'
    | 'backup:create'
    | 'backup:restore'
    | 'import:clients'
    | 'import:products'
    | 'export:csv'
    | 'dashboard:stats'
    | 'dashboard:charts'
    | 'search:global'
    | 'audit:log';
