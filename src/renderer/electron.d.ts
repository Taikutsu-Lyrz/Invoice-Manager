export { };

declare global {
    interface Window {
        electronAPI: {
            // App utilities
            getPath: (name: string) => Promise<string>;
            getDbPath: () => Promise<string>;
            openExternal: (url: string) => Promise<void>;
            openPath: (path: string) => Promise<string>;

            // Auth
            getProfiles: () => Promise<any[]>;
            getProfile: (id: string) => Promise<any>;
            createProfile: (data: any) => Promise<any>;
            verifyPin: (profileId: string, pin: string) => Promise<boolean>;
            setPin: (profileId: string, pin: string) => Promise<void>;
            removePin: (profileId: string) => Promise<void>;

            // Settings
            getSettings: (profileId: string) => Promise<any>;
            updateSettings: (profileId: string, data: any) => Promise<any>;

            // Clients
            listClients: (profileId: string, search?: string) => Promise<any[]>;
            getClient: (id: string) => Promise<any>;
            createClient: (profileId: string, data: any) => Promise<any>;
            updateClient: (id: string, data: any) => Promise<any>;
            deleteClient: (id: string) => Promise<void>;

            // Products
            listProducts: (profileId: string, search?: string) => Promise<any[]>;
            getProduct: (id: string) => Promise<any>;
            createProduct: (profileId: string, data: any) => Promise<any>;
            updateProduct: (id: string, data: any) => Promise<any>;
            deleteProduct: (id: string) => Promise<void>;

            // Invoices
            listInvoices: (profileId: string, filters?: any) => Promise<any[]>;
            getInvoice: (id: string) => Promise<any>;
            createInvoice: (profileId: string, data: any) => Promise<any>;
            updateInvoice: (id: string, data: any) => Promise<any>;
            deleteInvoice: (id: string) => Promise<void>;
            updateInvoiceStatus: (id: string, status: string) => Promise<any>;
            getNextInvoiceNumber: (profileId: string) => Promise<string>;
            generateInvoicePdf: (invoiceId: string) => Promise<string>;

            // Payments
            listPayments: (profileId: string, filters?: any) => Promise<any[]>;
            getPayment: (id: string) => Promise<any>;
            createPayment: (invoiceId: string, data: any) => Promise<any>;
            deletePayment: (id: string) => Promise<void>;

            // Expenses
            listExpenses: (profileId: string, filters?: any) => Promise<any[]>;
            createExpense: (profileId: string, data: any) => Promise<any>;
            updateExpense: (id: string, data: any) => Promise<any>;
            deleteExpense: (id: string) => Promise<void>;
            listExpenseCategories: (profileId: string) => Promise<any[]>;
            createExpenseCategory: (profileId: string, data: any) => Promise<any>;

            // Reports
            getSalesReport: (profileId: string, startDate: string, endDate: string) => Promise<any>;
            getTaxReport: (profileId: string, startDate: string, endDate: string) => Promise<any>;
            getProfitReport: (profileId: string, startDate: string, endDate: string) => Promise<any>;
            getPaymentReport: (profileId: string, startDate: string, endDate: string) => Promise<any>;
            getExpenseReport: (profileId: string, startDate: string, endDate: string) => Promise<any>;
            exportReportCsv: (type: string, data: any) => Promise<string>;

            // Dashboard
            getDashboardStats: (profileId: string) => Promise<any>;
            getRevenueChart: (profileId: string, months?: number) => Promise<any[]>;
            getClientRevenueChart: (profileId: string, limit?: number) => Promise<any[]>;
            getStatusChart: (profileId: string) => Promise<any[]>;
            getRecentActivity: (profileId: string, limit?: number) => Promise<any[]>;
            globalSearch: (profileId: string, query: string) => Promise<any>;

            // Backup
            createBackup: (profileId: string, password?: string) => Promise<string>;
            restoreBackup: (filePath: string, password?: string) => Promise<void>;
            exportCsv: (type: string, profileId: string) => Promise<string>;
            importClients: (profileId: string, filePath: string) => Promise<number>;
            importProducts: (profileId: string, filePath: string) => Promise<number>;

            // Dialogs
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
