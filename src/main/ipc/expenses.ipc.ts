import { ipcMain } from 'electron';
import { getDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerExpensesHandlers(): void {
    // Expense Categories
    ipcMain.handle('expense-categories:list', (_, profileId: string) => {
        const db = getDatabase();
        const categories = db.prepare(`
      SELECT * FROM expense_categories WHERE profile_id = ? ORDER BY name
    `).all(profileId);

        return categories.map((c: any) => ({
            id: c.id,
            profileId: c.profile_id,
            name: c.name,
            color: c.color,
        }));
    });

    ipcMain.handle('expense-categories:create', (_, profileId: string, data: any) => {
        const db = getDatabase();
        const id = uuidv4();

        db.prepare(`
      INSERT INTO expense_categories (id, profile_id, name, color)
      VALUES (?, ?, ?, ?)
    `).run(id, profileId, data.name, data.color);

        return { id, profileId, ...data };
    });

    ipcMain.handle('expense-categories:update', (_, id: string, data: any) => {
        const db = getDatabase();

        db.prepare(`
      UPDATE expense_categories SET name = ?, color = ? WHERE id = ?
    `).run(data.name, data.color, id);

        return { id, ...data };
    });

    ipcMain.handle('expense-categories:delete', (_, id: string) => {
        const db = getDatabase();

        // Check for expenses using this category
        const count = db.prepare(`SELECT COUNT(*) as count FROM expenses WHERE category_id = ?`).get(id) as any;
        if (count.count > 0) {
            throw new Error('Cannot delete category with existing expenses');
        }

        db.prepare(`DELETE FROM expense_categories WHERE id = ?`).run(id);
    });

    // Expenses
    ipcMain.handle('expenses:list', (_, profileId: string, filters?: any) => {
        const db = getDatabase();

        let query = `
      SELECT e.*, c.name as category_name, c.color as category_color
      FROM expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      WHERE e.profile_id = ? AND e.deleted_at IS NULL
    `;
        const params: any[] = [profileId];

        if (filters?.categoryId) {
            query += ` AND e.category_id = ?`;
            params.push(filters.categoryId);
        }

        if (filters?.startDate) {
            query += ` AND e.expense_date >= ?`;
            params.push(filters.startDate);
        }

        if (filters?.endDate) {
            query += ` AND e.expense_date <= ?`;
            params.push(filters.endDate);
        }

        if (filters?.search) {
            query += ` AND (e.description LIKE ? OR e.vendor LIKE ?)`;
            const searchPattern = `%${filters.search}%`;
            params.push(searchPattern, searchPattern);
        }

        query += ` ORDER BY e.expense_date DESC`;

        const expenses = db.prepare(query).all(...params);

        return expenses.map((e: any) => ({
            ...mapExpenseFromDb(e),
            category: { name: e.category_name, color: e.category_color },
        }));
    });

    // List deleted expenses (trash)
    ipcMain.handle('expenses:list-deleted', (_, profileId: string) => {
        const db = getDatabase();
        const expenses = db.prepare(`
            SELECT e.*, c.name as category_name, c.color as category_color
            FROM expenses e
            LEFT JOIN expense_categories c ON e.category_id = c.id
            WHERE e.profile_id = ? AND e.deleted_at IS NOT NULL
            ORDER BY e.deleted_at DESC
        `).all(profileId);
        return expenses.map((e: any) => ({
            ...mapExpenseFromDb(e),
            category: { name: e.category_name, color: e.category_color },
        }));
    });

    ipcMain.handle('expenses:get', (_, id: string) => {
        const db = getDatabase();
        const expense = db.prepare(`
      SELECT e.*, c.name as category_name, c.color as category_color
      FROM expenses e
      LEFT JOIN expense_categories c ON e.category_id = c.id
      WHERE e.id = ?
    `).get(id) as any;

        if (!expense) return null;

        return {
            ...mapExpenseFromDb(expense),
            category: { name: expense.category_name, color: expense.category_color },
        };
    });

    ipcMain.handle('expenses:create', (_, profileId: string, data: any) => {
        const db = getDatabase();
        const id = uuidv4();
        const now = new Date().toISOString();

        db.prepare(`
      INSERT INTO expenses (id, profile_id, category_id, vendor, description, amount, tax_amount, expense_date, notes, receipt_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id, profileId, data.categoryId, data.vendor || null,
            data.description, data.amount, data.taxAmount || 0,
            data.expenseDate, data.notes || null, data.attachment || null,
            now, now
        );

        logAudit(db, profileId, 'created', 'expense', id, `Created expense: ${data.description}`);

        return { id, ...data, profileId, createdAt: now, updatedAt: now };
    });

    ipcMain.handle('expenses:update', (_, id: string, data: any) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        const existing = db.prepare(`SELECT profile_id FROM expenses WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Expense not found');

        db.prepare(`
      UPDATE expenses SET
        category_id = COALESCE(?, category_id),
        vendor = ?,
        description = COALESCE(?, description),
        amount = COALESCE(?, amount),
        tax_amount = COALESCE(?, tax_amount),
        expense_date = COALESCE(?, expense_date),
        notes = ?,
        receipt_path = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
            data.categoryId, data.vendor || null, data.description,
            data.amount, data.taxAmount, data.expenseDate,
            data.notes || null, data.attachment || null, now, id
        );

        logAudit(db, existing.profile_id, 'updated', 'expense', id, `Updated expense: ${data.description}`);

        return { id, ...data, updatedAt: now };
    });

    // Soft delete - move to trash
    ipcMain.handle('expenses:delete', (_, id: string) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        const existing = db.prepare(`SELECT profile_id, description FROM expenses WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Expense not found');

        db.prepare(`UPDATE expenses SET deleted_at = ? WHERE id = ?`).run(now, id);

        logAudit(db, existing.profile_id, 'deleted', 'expense', id, `Moved expense to trash: ${existing.description}`);
    });

    // Restore from trash
    ipcMain.handle('expenses:restore', (_, id: string) => {
        const db = getDatabase();

        const existing = db.prepare(`SELECT profile_id, description FROM expenses WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Expense not found');

        db.prepare(`UPDATE expenses SET deleted_at = NULL WHERE id = ?`).run(id);

        logAudit(db, existing.profile_id, 'restored', 'expense', id, `Restored expense: ${existing.description}`);
    });

    // Permanent delete
    ipcMain.handle('expenses:permanent-delete', (_, id: string) => {
        const db = getDatabase();

        const existing = db.prepare(`SELECT profile_id, description FROM expenses WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Expense not found');

        db.prepare(`DELETE FROM expenses WHERE id = ?`).run(id);

        logAudit(db, existing.profile_id, 'permanent-deleted', 'expense', id, `Permanently deleted expense: ${existing.description}`);
    });
}

function mapExpenseFromDb(row: any) {
    return {
        id: row.id,
        profileId: row.profile_id,
        categoryId: row.category_id,
        vendor: row.vendor,
        description: row.description,
        amount: row.amount,
        taxAmount: row.tax_amount,
        expenseDate: row.expense_date,
        notes: row.notes,
        attachment: row.receipt_path,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
    };
}


function logAudit(db: any, profileId: string, action: string, entityType: string, entityId: string, details: string) {
    db.prepare(`
    INSERT INTO audit_log (id, profile_id, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), profileId, action, entityType, entityId, details, new Date().toISOString());
}
