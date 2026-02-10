import { ipcMain } from 'electron';
import { getDatabase } from '../database';

export function registerDashboardHandlers(): void {
    ipcMain.handle('dashboard:stats', (_, profileId: string) => {
        const db = getDatabase();
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        const today = now.toISOString().split('T')[0];

        // Revenue this month
        const revenueThisMonth = (db.prepare(`
      SELECT COALESCE(SUM(amount_paid), 0) as total
      FROM invoices
      WHERE profile_id = ? AND issue_date >= ?
    `).get(profileId, thisMonthStart) as any).total;

        // Revenue last month
        const revenueLastMonth = (db.prepare(`
      SELECT COALESCE(SUM(amount_paid), 0) as total
      FROM invoices
      WHERE profile_id = ? AND issue_date >= ? AND issue_date <= ?
    `).get(profileId, lastMonthStart, lastMonthEnd) as any).total;

        // Revenue YTD
        const revenueYTD = (db.prepare(`
      SELECT COALESCE(SUM(amount_paid), 0) as total
      FROM invoices
      WHERE profile_id = ? AND issue_date >= ?
    `).get(profileId, yearStart) as any).total;

        // Outstanding receivables (unpaid balance)
        const outstandingReceivables = (db.prepare(`
      SELECT COALESCE(SUM(balance_due), 0) as total
      FROM invoices
      WHERE profile_id = ? AND status NOT IN ('paid', 'void', 'refunded')
    `).get(profileId) as any).total;

        // Overdue amount
        const overdueAmount = (db.prepare(`
      SELECT COALESCE(SUM(balance_due), 0) as total
      FROM invoices
      WHERE profile_id = ? AND status NOT IN ('paid', 'void', 'refunded') AND due_date < ?
    `).get(profileId, today) as any).total;

        // Total expenses YTD
        const totalExpenses = (db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE profile_id = ? AND expense_date >= ?
    `).get(profileId, yearStart) as any).total;

        // Profit estimate (revenue - COGS)
        const cogs = (db.prepare(`
      SELECT COALESCE(SUM(ii.quantity * p.cost), 0) as total
      FROM invoice_items ii
      JOIN invoices i ON ii.invoice_id = i.id
      JOIN products p ON ii.product_id = p.id
      WHERE i.profile_id = ? AND i.status IN ('paid', 'partial') AND p.cost IS NOT NULL AND i.issue_date >= ?
    `).get(profileId, yearStart) as any).total;

        const profitEstimate = revenueYTD - cogs;
        const netProfit = profitEstimate - totalExpenses;

        return {
            revenueThisMonth,
            revenueLastMonth,
            revenueYTD,
            outstandingReceivables,
            overdueAmount,
            profitEstimate,
            totalExpenses,
            netProfit,
        };
    });

    ipcMain.handle('dashboard:revenue-chart', (_, profileId: string, months: number = 12) => {
        const db = getDatabase();
        const data: any[] = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const startDate = date.toISOString().split('T')[0];
            const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

            const revenue = (db.prepare(`
        SELECT COALESCE(SUM(amount_paid), 0) as total
        FROM invoices
        WHERE profile_id = ? AND issue_date >= ? AND issue_date <= ?
      `).get(profileId, startDate, endDate) as any).total;

            const monthName = date.toLocaleString('default', { month: 'short', year: '2-digit' });
            data.push({ name: monthName, value: revenue });
        }

        return data;
    });

    ipcMain.handle('dashboard:client-revenue', (_, profileId: string, limit: number = 10) => {
        const db = getDatabase();

        const data = db.prepare(`
      SELECT c.name, COALESCE(SUM(i.amount_paid), 0) as value
      FROM clients c
      LEFT JOIN invoices i ON c.id = i.client_id AND i.status IN ('paid', 'partial')
      WHERE c.profile_id = ?
      GROUP BY c.id
      HAVING value > 0
      ORDER BY value DESC
      LIMIT ?
    `).all(profileId, limit);

        return data;
    });

    ipcMain.handle('dashboard:status-chart', (_, profileId: string) => {
        const db = getDatabase();
        const today = new Date().toISOString().split('T')[0];

        // Count by status
        const paid = (db.prepare(`
      SELECT COUNT(*) as count FROM invoices WHERE profile_id = ? AND status = 'paid'
    `).get(profileId) as any).count;

        const unpaid = (db.prepare(`
      SELECT COUNT(*) as count FROM invoices WHERE profile_id = ? AND status IN ('draft', 'sent', 'partial') AND due_date >= ?
    `).get(profileId, today) as any).count;

        const overdue = (db.prepare(`
      SELECT COUNT(*) as count FROM invoices WHERE profile_id = ? AND status NOT IN ('paid', 'void', 'refunded') AND due_date < ?
    `).get(profileId, today) as any).count;

        return [
            { name: 'Paid', value: paid, color: '#10b981' },
            { name: 'Unpaid', value: unpaid, color: '#f59e0b' },
            { name: 'Overdue', value: overdue, color: '#ef4444' },
        ];
    });

    ipcMain.handle('dashboard:recent-activity', (_, profileId: string, limit: number = 10) => {
        const db = getDatabase();

        const activity = db.prepare(`
      SELECT action, entity_type, entity_id, details, created_at
      FROM audit_log
      WHERE profile_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(profileId, limit);

        return activity.map((a: any) => ({
            action: a.action,
            entityType: a.entity_type,
            entityId: a.entity_id,
            details: a.details,
            createdAt: a.created_at,
        }));
    });

    ipcMain.handle('search:global', (_, profileId: string, query: string) => {
        const db = getDatabase();
        const searchPattern = `%${query}%`;

        const clients = db.prepare(`
      SELECT id, 'client' as type, name as title, email as subtitle
      FROM clients
      WHERE profile_id = ? AND (name LIKE ? OR email LIKE ?)
      LIMIT 5
    `).all(profileId, searchPattern, searchPattern);

        const invoices = db.prepare(`
      SELECT i.id, 'invoice' as type, i.invoice_number as title, c.name as subtitle
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.profile_id = ? AND (i.invoice_number LIKE ? OR c.name LIKE ?)
      LIMIT 5
    `).all(profileId, searchPattern, searchPattern);

        const products = db.prepare(`
      SELECT id, 'product' as type, name as title, sku as subtitle
      FROM products
      WHERE profile_id = ? AND (name LIKE ? OR sku LIKE ?)
      LIMIT 5
    `).all(profileId, searchPattern, searchPattern);

        return { clients, invoices, products };
    });

    ipcMain.handle('audit:log', (_, profileId: string, filters?: any) => {
        const db = getDatabase();

        let query = `SELECT * FROM audit_log WHERE profile_id = ?`;
        const params: any[] = [profileId];

        if (filters?.entityType) {
            query += ` AND entity_type = ?`;
            params.push(filters.entityType);
        }
        if (filters?.startDate) {
            query += ` AND created_at >= ?`;
            params.push(filters.startDate);
        }
        if (filters?.endDate) {
            query += ` AND created_at <= ?`;
            params.push(filters.endDate);
        }

        query += ` ORDER BY created_at DESC LIMIT 100`;

        return db.prepare(query).all(...params).map((a: any) => ({
            id: a.id,
            action: a.action,
            entityType: a.entity_type,
            entityId: a.entity_id,
            details: a.details,
            createdAt: a.created_at,
        }));
    });
}
