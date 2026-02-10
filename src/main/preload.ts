import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // App utilities
    getPath: (name: string) => ipcRenderer.invoke('app:get-path', name),
    getDbPath: () => ipcRenderer.invoke('app:get-db-path'),
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
    openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path),

    // Auth
    getProfiles: () => ipcRenderer.invoke('auth:get-profiles'),
    createProfile: (data: any) => ipcRenderer.invoke('auth:create-profile', data),
    getOrCreateProfileForUser: (data: { firebaseUid: string; tenantId: string; displayName: string; useSharedTenantData?: boolean }) => 
        ipcRenderer.invoke('auth:get-or-create-profile-for-user', data),
    verifyPin: (profileId: string, pin: string) => ipcRenderer.invoke('auth:verify-pin', profileId, pin),
    setPin: (profileId: string, pin: string) => ipcRenderer.invoke('auth:set-pin', profileId, pin),
    removePin: (profileId: string) => ipcRenderer.invoke('auth:remove-pin', profileId),

    // Settings
    getSettings: (profileId: string) => ipcRenderer.invoke('settings:get', profileId),
    updateSettings: (profileId: string, data: any) => ipcRenderer.invoke('settings:update', profileId, data),

    // Clients
    listClients: (profileId: string, search?: string) => ipcRenderer.invoke('clients:list', profileId, search),
    getClient: (id: string) => ipcRenderer.invoke('clients:get', id),
    createClient: (profileId: string, data: any) => ipcRenderer.invoke('clients:create', profileId, data),
    updateClient: (id: string, data: any) => ipcRenderer.invoke('clients:update', id, data),
    deleteClient: (id: string) => ipcRenderer.invoke('clients:delete', id),
    checkDuplicateClient: (profileId: string, name: string, email?: string) =>
        ipcRenderer.invoke('clients:check-duplicate', profileId, name, email),

    // Products
    listProducts: (profileId: string, search?: string) => ipcRenderer.invoke('products:list', profileId, search),
    getProduct: (id: string) => ipcRenderer.invoke('products:get', id),
    createProduct: (profileId: string, data: any) => ipcRenderer.invoke('products:create', profileId, data),
    updateProduct: (id: string, data: any) => ipcRenderer.invoke('products:update', id, data),
    deleteProduct: (id: string) => ipcRenderer.invoke('products:delete', id),

    // Invoices
    listInvoices: (profileId: string, filters?: any) => ipcRenderer.invoke('invoices:list', profileId, filters),
    getInvoice: (id: string) => ipcRenderer.invoke('invoices:get', id),
    createInvoice: (profileId: string, data: any) => ipcRenderer.invoke('invoices:create', profileId, data),
    updateInvoice: (id: string, data: any) => ipcRenderer.invoke('invoices:update', id, data),
    deleteInvoice: (id: string) => ipcRenderer.invoke('invoices:delete', id),
    updateInvoiceStatus: (id: string, status: string) => ipcRenderer.invoke('invoices:update-status', id, status),
    generateInvoicePdf: (id: string, template?: string) => ipcRenderer.invoke('invoices:generate-pdf', id, template),
    sendInvoiceEmail: (id: string) => ipcRenderer.invoke('invoices:send-email', id),
    duplicateInvoice: (id: string) => ipcRenderer.invoke('invoices:duplicate', id),
    getNextInvoiceNumber: (profileId: string) => ipcRenderer.invoke('invoices:next-number', profileId),

    // Payments
    listPayments: (profileId: string, filters?: any) => ipcRenderer.invoke('payments:list', profileId, filters),
    getPayment: (id: string) => ipcRenderer.invoke('payments:get', id),
    createPayment: (profileId: string, data: any) => ipcRenderer.invoke('payments:create', profileId, data),
    deletePayment: (id: string) => ipcRenderer.invoke('payments:delete', id),
    generateReceipt: (id: string) => ipcRenderer.invoke('payments:generate-receipt', id),
    getInvoicePayments: (invoiceId: string) => ipcRenderer.invoke('payments:by-invoice', invoiceId),

    // Expenses
    listExpenses: (profileId: string, filters?: any) => ipcRenderer.invoke('expenses:list', profileId, filters),
    getExpense: (id: string) => ipcRenderer.invoke('expenses:get', id),
    createExpense: (profileId: string, data: any) => ipcRenderer.invoke('expenses:create', profileId, data),
    updateExpense: (id: string, data: any) => ipcRenderer.invoke('expenses:update', id, data),
    deleteExpense: (id: string) => ipcRenderer.invoke('expenses:delete', id),
    listExpenseCategories: (profileId: string) => ipcRenderer.invoke('expense-categories:list', profileId),
    createExpenseCategory: (profileId: string, data: any) => ipcRenderer.invoke('expense-categories:create', profileId, data),
    updateExpenseCategory: (id: string, data: any) => ipcRenderer.invoke('expense-categories:update', id, data),
    deleteExpenseCategory: (id: string) => ipcRenderer.invoke('expense-categories:delete', id),

    // Reports
    getSalesReport: (profileId: string, filters: any) => ipcRenderer.invoke('reports:sales', profileId, filters),
    getTaxReport: (profileId: string, filters: any) => ipcRenderer.invoke('reports:tax', profileId, filters),
    getProfitReport: (profileId: string, filters: any) => ipcRenderer.invoke('reports:profit', profileId, filters),
    getPaymentsReport: (profileId: string, filters: any) => ipcRenderer.invoke('reports:payments', profileId, filters),
    getExpensesReport: (profileId: string, filters: any) => ipcRenderer.invoke('reports:expenses', profileId, filters),
    exportReportCsv: (type: string, data: any) => ipcRenderer.invoke('reports:export-csv', type, data),
    generateReportPdf: (profileId: string, filters: any) => ipcRenderer.invoke('reports:generate-pdf', profileId, filters),

    // Dashboard
    getDashboardStats: (profileId: string) => ipcRenderer.invoke('dashboard:stats', profileId),
    getRevenueChart: (profileId: string, months?: number) => ipcRenderer.invoke('dashboard:revenue-chart', profileId, months),
    getClientRevenueChart: (profileId: string, limit?: number) => ipcRenderer.invoke('dashboard:client-revenue', profileId, limit),
    getStatusChart: (profileId: string) => ipcRenderer.invoke('dashboard:status-chart', profileId),
    getRecentActivity: (profileId: string, limit?: number) => ipcRenderer.invoke('dashboard:recent-activity', profileId, limit),

    // Backup & Export
    createBackup: (profileId: string, password?: string) => ipcRenderer.invoke('backup:create', profileId, password),
    restoreBackup: (filePath: string, password?: string) => ipcRenderer.invoke('backup:restore', filePath, password),
    importClients: (profileId: string, filePath: string) => ipcRenderer.invoke('import:clients', profileId, filePath),
    importProducts: (profileId: string, filePath: string) => ipcRenderer.invoke('import:products', profileId, filePath),
    exportCsv: (type: string, profileId: string) => ipcRenderer.invoke('export:csv', type, profileId),

    // Search
    globalSearch: (profileId: string, query: string) => ipcRenderer.invoke('search:global', profileId, query),

    // Audit
    getAuditLog: (profileId: string, filters?: any) => ipcRenderer.invoke('audit:log', profileId, filters),

    // Trash Bin
    listDeletedClients: (profileId: string) => ipcRenderer.invoke('clients:list-deleted', profileId),
    restoreClient: (id: string) => ipcRenderer.invoke('clients:restore', id),
    permanentDeleteClient: (id: string) => ipcRenderer.invoke('clients:permanent-delete', id),

    listDeletedProducts: (profileId: string) => ipcRenderer.invoke('products:list-deleted', profileId),
    restoreProduct: (id: string) => ipcRenderer.invoke('products:restore', id),
    permanentDeleteProduct: (id: string) => ipcRenderer.invoke('products:permanent-delete', id),

    listDeletedInvoices: (profileId: string) => ipcRenderer.invoke('invoices:list-deleted', profileId),
    restoreInvoice: (id: string) => ipcRenderer.invoke('invoices:restore', id),
    permanentDeleteInvoice: (id: string) => ipcRenderer.invoke('invoices:permanent-delete', id),

    listDeletedPayments: (profileId: string) => ipcRenderer.invoke('payments:list-deleted', profileId),
    restorePayment: (id: string) => ipcRenderer.invoke('payments:restore', id),
    permanentDeletePayment: (id: string) => ipcRenderer.invoke('payments:permanent-delete', id),

    listDeletedExpenses: (profileId: string) => ipcRenderer.invoke('expenses:list-deleted', profileId),
    restoreExpense: (id: string) => ipcRenderer.invoke('expenses:restore', id),
    permanentDeleteExpense: (id: string) => ipcRenderer.invoke('expenses:permanent-delete', id),

    // File dialogs
    showSaveDialog: (options: any) => ipcRenderer.invoke('dialog:save', options),
    showOpenDialog: (options: any) => ipcRenderer.invoke('dialog:open', options),
});

// TypeScript declarations
declare global {
    interface Window {
        electronAPI: {
            getPath: (name: string) => Promise<string>;
            getDbPath: () => Promise<string>;
            openExternal: (url: string) => Promise<void>;
            openPath: (path: string) => Promise<string>;
            getProfiles: () => Promise<any[]>;
            createProfile: (data: any) => Promise<any>;
            getOrCreateProfileForUser: (data: { firebaseUid: string; tenantId: string; displayName: string; useSharedTenantData?: boolean }) => Promise<any>;
            verifyPin: (profileId: string, pin: string) => Promise<boolean>;
            setPin: (profileId: string, pin: string) => Promise<void>;
            removePin: (profileId: string) => Promise<void>;
            getSettings: (profileId: string) => Promise<any>;
            updateSettings: (profileId: string, data: any) => Promise<any>;
            listClients: (profileId: string, search?: string) => Promise<any[]>;
            getClient: (id: string) => Promise<any>;
            createClient: (profileId: string, data: any) => Promise<any>;
            updateClient: (id: string, data: any) => Promise<any>;
            deleteClient: (id: string) => Promise<void>;
            checkDuplicateClient: (profileId: string, name: string, email?: string) => Promise<boolean>;
            listProducts: (profileId: string, search?: string) => Promise<any[]>;
            getProduct: (id: string) => Promise<any>;
            createProduct: (profileId: string, data: any) => Promise<any>;
            updateProduct: (id: string, data: any) => Promise<any>;
            deleteProduct: (id: string) => Promise<void>;
            listInvoices: (profileId: string, filters?: any) => Promise<any[]>;
            getInvoice: (id: string) => Promise<any>;
            createInvoice: (profileId: string, data: any) => Promise<any>;
            updateInvoice: (id: string, data: any) => Promise<any>;
            deleteInvoice: (id: string) => Promise<void>;
            updateInvoiceStatus: (id: string, status: string) => Promise<void>;
            generateInvoicePdf: (id: string, template?: string) => Promise<string>;
            sendInvoiceEmail: (id: string) => Promise<void>;
            duplicateInvoice: (id: string) => Promise<any>;
            getNextInvoiceNumber: (profileId: string) => Promise<string>;
            listPayments: (profileId: string, filters?: any) => Promise<any[]>;
            getPayment: (id: string) => Promise<any>;
            createPayment: (profileId: string, data: any) => Promise<any>;
            deletePayment: (id: string) => Promise<void>;
            generateReceipt: (id: string) => Promise<string>;
            getInvoicePayments: (invoiceId: string) => Promise<any[]>;
            listExpenses: (profileId: string, filters?: any) => Promise<any[]>;
            getExpense: (id: string) => Promise<any>;
            createExpense: (profileId: string, data: any) => Promise<any>;
            updateExpense: (id: string, data: any) => Promise<any>;
            deleteExpense: (id: string) => Promise<void>;
            listExpenseCategories: (profileId: string) => Promise<any[]>;
            createExpenseCategory: (profileId: string, data: any) => Promise<any>;
            updateExpenseCategory: (id: string, data: any) => Promise<any>;
            deleteExpenseCategory: (id: string) => Promise<void>;
            getSalesReport: (profileId: string, filters: any) => Promise<any>;
            getTaxReport: (profileId: string, filters: any) => Promise<any>;
            getProfitReport: (profileId: string, filters: any) => Promise<any>;
            getPaymentsReport: (profileId: string, filters: any) => Promise<any>;
            getExpensesReport: (profileId: string, filters: any) => Promise<any>;
            exportReportCsv: (type: string, data: any) => Promise<string>;
            generateReportPdf: (profileId: string, filters: any) => Promise<string>;
            getDashboardStats: (profileId: string) => Promise<any>;
            getRevenueChart: (profileId: string, months?: number) => Promise<any[]>;
            getClientRevenueChart: (profileId: string, limit?: number) => Promise<any[]>;
            getStatusChart: (profileId: string) => Promise<any[]>;
            getRecentActivity: (profileId: string, limit?: number) => Promise<any[]>;
            createBackup: (profileId: string, password?: string) => Promise<string>;
            restoreBackup: (filePath: string, password?: string) => Promise<void>;
            importClients: (profileId: string, filePath: string) => Promise<number>;
            importProducts: (profileId: string, filePath: string) => Promise<number>;
            exportCsv: (type: string, profileId: string) => Promise<string>;
            globalSearch: (profileId: string, query: string) => Promise<any>;
            getAuditLog: (profileId: string, filters?: any) => Promise<any[]>;
            showSaveDialog: (options: any) => Promise<any>;
            showOpenDialog: (options: any) => Promise<any>;
            // Trash Bin
            listDeletedClients: (profileId: string) => Promise<any[]>;
            restoreClient: (id: string) => Promise<void>;
            permanentDeleteClient: (id: string) => Promise<void>;
            listDeletedProducts: (profileId: string) => Promise<any[]>;
            restoreProduct: (id: string) => Promise<void>;
            permanentDeleteProduct: (id: string) => Promise<void>;
            listDeletedInvoices: (profileId: string) => Promise<any[]>;
            restoreInvoice: (id: string) => Promise<void>;
            permanentDeleteInvoice: (id: string) => Promise<void>;
            listDeletedPayments: (profileId: string) => Promise<any[]>;
            restorePayment: (id: string) => Promise<void>;
            permanentDeletePayment: (id: string) => Promise<void>;
            listDeletedExpenses: (profileId: string) => Promise<any[]>;
            restoreExpense: (id: string) => Promise<void>;
            permanentDeleteExpense: (id: string) => Promise<void>;
        };
    }
}
