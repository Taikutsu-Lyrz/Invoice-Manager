import { ipcMain, dialog, app } from 'electron';
import { getDatabase } from '../database';
import { generateReportPdf } from '../pdf/report-pdf';
import * as fs from 'fs';
import * as path from 'path';

export function registerReportsHandlers(): void {
    ipcMain.handle('reports:sales', (_, profileId: string, filters: any) => {
        const db = getDatabase();

        let query = `
      SELECT 
        i.id, i.invoice_number, i.issue_date, i.due_date, i.status,
        i.subtotal, i.tax_total, i.discount_total, i.grand_total, i.amount_paid,
        c.name as client_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.profile_id = ?
    `;
        const params: any[] = [profileId];

        if (filters.startDate) {
            query += ` AND i.issue_date >= ?`;
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            query += ` AND i.issue_date <= ?`;
            params.push(filters.endDate);
        }
        if (filters.status && filters.status !== 'all') {
            query += ` AND i.status = ?`;
            params.push(filters.status);
        }
        if (filters.clientId) {
            query += ` AND i.client_id = ?`;
            params.push(filters.clientId);
        }

        query += ` ORDER BY i.issue_date DESC`;

        const invoices = db.prepare(query).all(...params);

        // Calculate totals
        const totals = invoices.reduce((acc: any, inv: any) => ({
            count: acc.count + 1,
            subtotal: acc.subtotal + inv.subtotal,
            taxTotal: acc.taxTotal + inv.tax_total,
            discountTotal: acc.discountTotal + inv.discount_total,
            grandTotal: acc.grandTotal + inv.grand_total,
            amountPaid: acc.amountPaid + inv.amount_paid,
        }), { count: 0, subtotal: 0, taxTotal: 0, discountTotal: 0, grandTotal: 0, amountPaid: 0 });

        return { invoices, totals };
    });

    ipcMain.handle('reports:tax', (_, profileId: string, filters: any) => {
        const db = getDatabase();

        let query = `
      SELECT 
        ii.tax_rate,
        SUM(ii.quantity * ii.unit_price) as base_amount,
        SUM(ii.tax_amount) as tax_collected
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      WHERE i.profile_id = ? AND i.status NOT IN ('draft', 'void')
    `;
        const params: any[] = [profileId];

        if (filters.startDate) {
            query += ` AND i.issue_date >= ?`;
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            query += ` AND i.issue_date <= ?`;
            params.push(filters.endDate);
        }

        query += ` GROUP BY ii.tax_rate ORDER BY ii.tax_rate`;

        const taxBreakdown = db.prepare(query).all(...params);

        const totalTax = taxBreakdown.reduce((sum: number, t: any) => sum + t.tax_collected, 0);
        const totalBase = taxBreakdown.reduce((sum: number, t: any) => sum + t.base_amount, 0);

        return { taxBreakdown, totalTax, totalBase };
    });

    ipcMain.handle('reports:profit', (_, profileId: string, filters: any) => {
        const db = getDatabase();

        // Revenue from paid invoices
        let revenueQuery = `
      SELECT COALESCE(SUM(amount_paid), 0) as revenue
      FROM invoices
      WHERE profile_id = ? AND status IN ('paid', 'partial', 'refunded')
    `;
        const revenueParams: any[] = [profileId];

        if (filters.startDate) {
            revenueQuery += ` AND issue_date >= ?`;
            revenueParams.push(filters.startDate);
        }
        if (filters.endDate) {
            revenueQuery += ` AND issue_date <= ?`;
            revenueParams.push(filters.endDate);
        }

        const revenue = (db.prepare(revenueQuery).get(...revenueParams) as any).revenue;

        // Cost of goods sold (from invoice items where product has cost)
        let cogsQuery = `
      SELECT COALESCE(SUM(ii.quantity * p.cost), 0) as cogs
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      JOIN products p ON ii.product_id = p.id
      WHERE i.profile_id = ? AND i.status IN ('paid', 'partial', 'refunded') AND p.cost IS NOT NULL
    `;
        const cogsParams: any[] = [profileId];

        if (filters.startDate) {
            cogsQuery += ` AND i.issue_date >= ?`;
            cogsParams.push(filters.startDate);
        }
        if (filters.endDate) {
            cogsQuery += ` AND i.issue_date <= ?`;
            cogsParams.push(filters.endDate);
        }

        const cogs = (db.prepare(cogsQuery).get(...cogsParams) as any).cogs;

        // Expenses
        let expensesQuery = `
      SELECT COALESCE(SUM(amount), 0) as expenses
      FROM expenses
      WHERE profile_id = ?
    `;
        const expensesParams: any[] = [profileId];

        if (filters.startDate) {
            expensesQuery += ` AND expense_date >= ?`;
            expensesParams.push(filters.startDate);
        }
        if (filters.endDate) {
            expensesQuery += ` AND expense_date <= ?`;
            expensesParams.push(filters.endDate);
        }

        const expenses = (db.prepare(expensesQuery).get(...expensesParams) as any).expenses;

        const grossProfit = revenue - cogs;
        const netProfit = grossProfit - expenses;

        return { revenue, cogs, grossProfit, expenses, netProfit };
    });

    ipcMain.handle('reports:payments', (_, profileId: string, filters: any) => {
        const db = getDatabase();

        let query = `
      SELECT 
        p.id, p.amount, p.method, p.payment_date, p.reference, p.is_refund,
        i.invoice_number, c.name as client_name
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE p.profile_id = ?
    `;
        const params: any[] = [profileId];

        if (filters.startDate) {
            query += ` AND p.payment_date >= ?`;
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            query += ` AND p.payment_date <= ?`;
            params.push(filters.endDate);
        }
        if (filters.method) {
            query += ` AND p.method = ?`;
            params.push(filters.method);
        }

        query += ` ORDER BY p.payment_date DESC`;

        const payments = db.prepare(query).all(...params);

        const totals = payments.reduce((acc: any, p: any) => ({
            totalReceived: acc.totalReceived + (p.is_refund ? 0 : p.amount),
            totalRefunded: acc.totalRefunded + (p.is_refund ? p.amount : 0),
            count: acc.count + 1,
        }), { totalReceived: 0, totalRefunded: 0, count: 0 });

        // By method breakdown
        const byMethod = db.prepare(`
      SELECT method, SUM(CASE WHEN is_refund = 0 THEN amount ELSE 0 END) as total
      FROM payments
      WHERE profile_id = ?
      ${filters.startDate ? 'AND payment_date >= ?' : ''}
      ${filters.endDate ? 'AND payment_date <= ?' : ''}
      GROUP BY method
    `).all(...params);

        return { payments, totals, byMethod };
    });

    ipcMain.handle('reports:expenses', (_, profileId: string, filters: any) => {
        const db = getDatabase();

        let query = `
      SELECT 
        e.id, e.description, e.amount, e.tax_amount, e.expense_date, e.vendor,
        c.name as category_name, c.color as category_color
      FROM expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      WHERE e.profile_id = ?
    `;
        const params: any[] = [profileId];

        if (filters.startDate) {
            query += ` AND e.expense_date >= ?`;
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            query += ` AND e.expense_date <= ?`;
            params.push(filters.endDate);
        }
        if (filters.categoryId) {
            query += ` AND e.category_id = ?`;
            params.push(filters.categoryId);
        }

        query += ` ORDER BY e.expense_date DESC`;

        const expenses = db.prepare(query).all(...params);

        const totals = expenses.reduce((acc: any, e: any) => ({
            total: acc.total + e.amount,
            taxTotal: acc.taxTotal + e.tax_amount,
            count: acc.count + 1,
        }), { total: 0, taxTotal: 0, count: 0 });

        // By category
        let byCategoryQuery = `
      SELECT c.name, c.color, SUM(e.amount) as total
      FROM expenses e
      JOIN expense_categories c ON e.category_id = c.id
      WHERE e.profile_id = ?
    `;

        if (filters.startDate) {
            byCategoryQuery += ` AND e.expense_date >= ?`;
        }
        if (filters.endDate) {
            byCategoryQuery += ` AND e.expense_date <= ?`;
        }

        byCategoryQuery += ` GROUP BY c.id ORDER BY total DESC`;

        const byCategory = db.prepare(byCategoryQuery).all(...params);

        return { expenses, totals, byCategory };
    });

    ipcMain.handle('reports:export-csv', async (_, type: string, data: any) => {
        const result = await dialog.showSaveDialog({
            defaultPath: `${type}-report-${new Date().toISOString().split('T')[0]}.csv`,
            filters: [{ name: 'CSV', extensions: ['csv'] }],
        });

        if (result.canceled || !result.filePath) return null;

        let csv = '';

        if (type === 'sales' && data.invoices) {
            csv = 'Invoice Number,Client,Issue Date,Due Date,Status,Subtotal,Tax,Discount,Total,Paid\n';
            for (const inv of data.invoices) {
                csv += `"${inv.invoice_number}","${inv.client_name}","${inv.issue_date}","${inv.due_date}","${inv.status}",${inv.subtotal},${inv.tax_total},${inv.discount_total},${inv.grand_total},${inv.amount_paid}\n`;
            }
        } else if (type === 'payments' && data.payments) {
            csv = 'Date,Invoice,Client,Method,Amount,Reference,Type\n';
            for (const p of data.payments) {
                csv += `"${p.payment_date}","${p.invoice_number}","${p.client_name}","${p.method}",${p.amount},"${p.reference || ''}","${p.is_refund ? 'Refund' : 'Payment'}"\n`;
            }
        } else if (type === 'expenses' && data.expenses) {
            csv = 'Date,Category,Vendor,Description,Amount,Tax\n';
            for (const e of data.expenses) {
                csv += `"${e.expense_date}","${e.category_name}","${e.vendor || ''}","${e.description}",${e.amount},${e.tax_amount}\n`;
            }
        }

        fs.writeFileSync(result.filePath, csv);
        return result.filePath;
    });

    ipcMain.handle('reports:generate-pdf', async (_, profileId: string, filters: any) => {
        const db = getDatabase();

        // Get settings
        const settingsRow = db.prepare(`SELECT data FROM settings WHERE profile_id = ?`).get(profileId) as any;
        const settings = settingsRow ? JSON.parse(settingsRow.data) : {
            companyName: 'Company',
            companyAddress: '',
            currencySymbol: '$'
        };

        // Get summary data
        const revenueQuery = `
            SELECT COALESCE(SUM(amount_paid), 0) as revenue
            FROM invoices
            WHERE profile_id = ? AND status IN ('paid', 'partial', 'refunded')
            ${filters.startDate ? `AND issue_date >= '${filters.startDate}'` : ''}
            ${filters.endDate ? `AND issue_date <= '${filters.endDate}'` : ''}
        `;
        const revenue = (db.prepare(revenueQuery).get(profileId) as any).revenue;

        const expensesQuery = `
            SELECT COALESCE(SUM(amount), 0) as expenses
            FROM expenses
            WHERE profile_id = ?
            ${filters.startDate ? `AND expense_date >= '${filters.startDate}'` : ''}
            ${filters.endDate ? `AND expense_date <= '${filters.endDate}'` : ''}
        `;
        const expenses = (db.prepare(expensesQuery).get(profileId) as any).expenses;

        // Invoice counts
        const invoiceStats = db.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
                SUM(CASE WHEN status NOT IN ('paid', 'void', 'draft') THEN 1 ELSE 0 END) as unpaid
            FROM invoices
            WHERE profile_id = ?
            ${filters.startDate ? `AND issue_date >= '${filters.startDate}'` : ''}
            ${filters.endDate ? `AND issue_date <= '${filters.endDate}'` : ''}
        `).get(profileId) as any;

        // Top clients
        const topClients = db.prepare(`
            SELECT c.name, SUM(i.amount_paid) as total
            FROM invoices i
            JOIN clients c ON i.client_id = c.id
            WHERE i.profile_id = ? AND i.status IN ('paid', 'partial')
            ${filters.startDate ? `AND i.issue_date >= '${filters.startDate}'` : ''}
            ${filters.endDate ? `AND i.issue_date <= '${filters.endDate}'` : ''}
            GROUP BY c.id
            ORDER BY total DESC
            LIMIT 5
        `).all(profileId);

        // Recent invoices
        const recentInvoices = db.prepare(`
            SELECT i.invoice_number, c.name as client_name, i.grand_total as amount, i.status, i.issue_date as date
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.id
            WHERE i.profile_id = ?
            ${filters.startDate ? `AND i.issue_date >= '${filters.startDate}'` : ''}
            ${filters.endDate ? `AND i.issue_date <= '${filters.endDate}'` : ''}
            ORDER BY i.issue_date DESC
            LIMIT 10
        `).all(profileId);

        const reportData = {
            title: 'Financial Report',
            dateRange: {
                start: filters.startDate || 'All Time',
                end: filters.endDate || 'Present'
            },
            summary: {
                totalRevenue: revenue,
                totalExpenses: expenses,
                netProfit: revenue - expenses,
                invoiceCount: invoiceStats.total || 0,
                paidInvoices: invoiceStats.paid || 0,
                unpaidInvoices: invoiceStats.unpaid || 0,
            },
            topClients: topClients.map((c: any) => ({ name: c.name, total: c.total })),
            recentInvoices: recentInvoices.map((i: any) => ({
                invoiceNumber: i.invoice_number,
                clientName: i.client_name,
                amount: i.amount,
                status: i.status,
                date: i.date,
            })),
        };

        const pdfPath = await generateReportPdf(reportData, settings);
        return pdfPath;
    });
}
