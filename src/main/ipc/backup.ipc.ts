import { ipcMain, dialog, app } from 'electron';
import { getDatabase } from '../database';
import * as fs from 'fs';
import * as path from 'path';
import CryptoJS from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';

export function registerBackupHandlers(): void {
    ipcMain.handle('backup:create', async (_, profileId: string, password?: string) => {
        const db = getDatabase();

        const result = await dialog.showSaveDialog({
            defaultPath: `invoice-backup-${new Date().toISOString().split('T')[0]}.ivbak`,
            filters: [{ name: 'Invoice Backup', extensions: ['ivbak'] }],
        });

        if (result.canceled || !result.filePath) return null;

        // Export all data for the profile
        const data = {
            version: 1,
            createdAt: new Date().toISOString(),
            profile: db.prepare(`SELECT * FROM profiles WHERE id = ?`).get(profileId),
            settings: db.prepare(`SELECT * FROM settings WHERE profile_id = ?`).get(profileId),
            clients: db.prepare(`SELECT * FROM clients WHERE profile_id = ?`).all(profileId),
            products: db.prepare(`SELECT * FROM products WHERE profile_id = ?`).all(profileId),
            invoices: db.prepare(`SELECT * FROM invoices WHERE profile_id = ?`).all(profileId),
            invoiceItems: db.prepare(`
        SELECT ii.* FROM invoice_items ii
        JOIN invoices i ON ii.invoice_id = i.id
        WHERE i.profile_id = ?
      `).all(profileId),
            payments: db.prepare(`SELECT * FROM payments WHERE profile_id = ?`).all(profileId),
            expenseCategories: db.prepare(`SELECT * FROM expense_categories WHERE profile_id = ?`).all(profileId),
            expenses: db.prepare(`SELECT * FROM expenses WHERE profile_id = ?`).all(profileId),
        };

        let content = JSON.stringify(data);

        if (password) {
            content = CryptoJS.AES.encrypt(content, password).toString();
        }

        fs.writeFileSync(result.filePath, content);

        logAudit(db, profileId, 'backup_created', 'system', '', `Backup created: ${result.filePath}`);

        return result.filePath;
    });

    ipcMain.handle('backup:restore', async (_, filePath?: string, password?: string) => {
        let backupPath = filePath;

        if (!backupPath) {
            const result = await dialog.showOpenDialog({
                filters: [{ name: 'Invoice Backup', extensions: ['ivbak'] }],
                properties: ['openFile'],
            });

            if (result.canceled || !result.filePaths[0]) return null;
            backupPath = result.filePaths[0];
        }

        let content = fs.readFileSync(backupPath, 'utf8');

        // Try to decrypt if password provided
        if (password) {
            try {
                const bytes = CryptoJS.AES.decrypt(content, password);
                content = bytes.toString(CryptoJS.enc.Utf8);
                if (!content) throw new Error('Invalid password');
            } catch (e) {
                throw new Error('Invalid password or corrupted backup');
            }
        }

        let data;
        try {
            data = JSON.parse(content);
        } catch (e) {
            // If parsing fails and no password was provided, backup might be encrypted
            if (!password) {
                throw new Error('Backup appears to be encrypted. Please provide a password.');
            }
            throw new Error('Invalid backup file');
        }

        const db = getDatabase();

        // Create new profile ID to avoid conflicts
        const newProfileId = uuidv4();
        const now = new Date().toISOString();

        // Map old IDs to new IDs for foreign key relationships
        const clientMap = new Map();
        const productMap = new Map();
        const invoiceMap = new Map();
        const categoryMap = new Map();

        // Use the database's transaction wrapper method
        const restoreTransaction = db.transaction(() => {
            // Insert profile
            db.prepare(`
                INSERT INTO profiles (id, name, pin_hash, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            `).run(newProfileId, (data.profile?.name || 'Restored') + ' (Restored)', data.profile?.pin_hash || null, now, now);

            // Insert settings
            if (data.settings) {
                db.prepare(`
                    INSERT INTO settings (id, profile_id, data, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                `).run(uuidv4(), newProfileId, data.settings.data, now, now);
            }

            // Insert clients
            for (const client of data.clients || []) {
                const newId = uuidv4();
                clientMap.set(client.id, newId);
                db.prepare(`
                    INSERT INTO clients (id, profile_id, name, email, phone, billing_address, shipping_address, tax_number, notes, created_at, updated_at, deleted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(newId, newProfileId, client.name ?? null, client.email ?? null, client.phone ?? null, client.billing_address ?? null, client.shipping_address ?? null, client.tax_number ?? null, client.notes ?? null, client.created_at ?? null, client.updated_at ?? null, client.deleted_at ?? null);
            }

            // Insert products
            for (const product of data.products || []) {
                const newId = uuidv4();
                productMap.set(product.id, newId);
                db.prepare(`
                    INSERT INTO products (id, profile_id, sku, name, description, unit, price, cost, tax_rate_id, stock, track_stock, created_at, updated_at, deleted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(newId, newProfileId, product.sku ?? null, product.name ?? null, product.description ?? null, product.unit ?? 'pcs', product.price ?? 0, product.cost ?? null, product.tax_rate_id ?? null, product.stock ?? null, product.track_stock ?? 0, product.created_at ?? null, product.updated_at ?? null, product.deleted_at ?? null);
            }

            // Insert expense categories
            for (const cat of data.expenseCategories || []) {
                const newId = uuidv4();
                categoryMap.set(cat.id, newId);
                db.prepare(`
                    INSERT INTO expense_categories (id, profile_id, name, color)
                    VALUES (?, ?, ?, ?)
                `).run(newId, newProfileId, cat.name ?? 'Uncategorized', cat.color ?? '#gray');
            }

            // Insert invoices
            for (const invoice of data.invoices || []) {
                const newId = uuidv4();
                invoiceMap.set(invoice.id, newId);
                db.prepare(`
                    INSERT INTO invoices (id, profile_id, invoice_number, client_id, status, issue_date, due_date, subtotal, tax_total, discount_total, grand_total, amount_paid, balance_due, notes, terms, attachments, recurring_rule, created_at, updated_at, deleted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(newId, newProfileId, invoice.invoice_number ?? null, clientMap.get(invoice.client_id) ?? null, invoice.status ?? 'draft', invoice.issue_date ?? null, invoice.due_date ?? null, invoice.subtotal ?? 0, invoice.tax_total ?? 0, invoice.discount_total ?? 0, invoice.grand_total ?? 0, invoice.amount_paid ?? 0, invoice.balance_due ?? 0, invoice.notes ?? null, invoice.terms ?? null, invoice.attachments ?? null, invoice.recurring_rule ?? null, invoice.created_at ?? null, invoice.updated_at ?? null, invoice.deleted_at ?? null);
            }

            // Insert invoice items
            for (const item of data.invoiceItems || []) {
                db.prepare(`
                    INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit_price, tax_rate, tax_amount, discount_percent, discount_amount, line_total)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(uuidv4(), invoiceMap.get(item.invoice_id) ?? null, productMap.get(item.product_id) ?? null, item.description ?? null, item.quantity ?? 0, item.unit_price ?? 0, item.tax_rate ?? 0, item.tax_amount ?? 0, item.discount_percent ?? 0, item.discount_amount ?? 0, item.line_total ?? 0);
            }

            // Insert payments
            for (const payment of data.payments || []) {
                db.prepare(`
                    INSERT INTO payments (id, profile_id, invoice_id, amount, method, reference, payment_date, notes, is_refund, created_at, deleted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(uuidv4(), newProfileId, invoiceMap.get(payment.invoice_id) ?? null, payment.amount ?? 0, payment.method ?? 'cash', payment.reference ?? null, payment.payment_date ?? null, payment.notes ?? null, payment.is_refund ?? 0, payment.created_at ?? null, payment.deleted_at ?? null);
            }

            // Insert expenses
            for (const expense of data.expenses || []) {
                db.prepare(`
                    INSERT INTO expenses (id, profile_id, category_id, vendor, description, amount, tax_amount, expense_date, notes, attachment, created_at, updated_at, deleted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(uuidv4(), newProfileId, categoryMap.get(expense.category_id) ?? null, expense.vendor ?? null, expense.description ?? null, expense.amount ?? 0, expense.tax_amount ?? 0, expense.expense_date ?? null, expense.notes ?? null, expense.attachment ?? null, expense.created_at ?? null, expense.updated_at ?? null, expense.deleted_at ?? null);
            }
        });

        // Execute the transaction
        restoreTransaction();

        return newProfileId;
    });

    ipcMain.handle('import:clients', async (_, profileId: string, filePath?: string) => {
        let csvPath = filePath;

        if (!csvPath) {
            const result = await dialog.showOpenDialog({
                filters: [{ name: 'CSV', extensions: ['csv'] }],
                properties: ['openFile'],
            });

            if (result.canceled || !result.filePaths[0]) return 0;
            csvPath = result.filePaths[0];
        }

        const content = fs.readFileSync(csvPath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());

        if (lines.length < 2) return 0;

        const db = getDatabase();
        const now = new Date().toISOString();
        let imported = 0;

        // Expect: Name,Email,Phone,Billing Address
        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length >= 2) {
                db.prepare(`
          INSERT INTO clients (id, profile_id, name, email, phone, billing_address, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), profileId, cols[0], cols[1] || null, cols[2] || null, cols[3] || 'N/A', now, now);
                imported++;
            }
        }

        logAudit(db, profileId, 'import', 'client', '', `Imported ${imported} clients from CSV`);

        return imported;
    });

    ipcMain.handle('import:products', async (_, profileId: string, filePath?: string) => {
        let csvPath = filePath;

        if (!csvPath) {
            const result = await dialog.showOpenDialog({
                filters: [{ name: 'CSV', extensions: ['csv'] }],
                properties: ['openFile'],
            });

            if (result.canceled || !result.filePaths[0]) return 0;
            csvPath = result.filePaths[0];
        }

        const content = fs.readFileSync(csvPath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());

        if (lines.length < 2) return 0;

        const db = getDatabase();
        const now = new Date().toISOString();
        let imported = 0;

        // Expect: SKU,Name,Unit,Price,Cost
        for (let i = 1; i < lines.length; i++) {
            const cols = parseCSVLine(lines[i]);
            if (cols.length >= 2) {
                db.prepare(`
          INSERT INTO products (id, profile_id, sku, name, unit, price, cost, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), profileId, cols[0] || null, cols[1], cols[2] || 'pcs', parseFloat(cols[3]) || 0, parseFloat(cols[4]) || null, now, now);
                imported++;
            }
        }

        logAudit(db, profileId, 'import', 'product', '', `Imported ${imported} products from CSV`);

        return imported;
    });

    ipcMain.handle('export:csv', async (_, type: string, profileId: string) => {
        const db = getDatabase();

        const result = await dialog.showSaveDialog({
            defaultPath: `${type}-${new Date().toISOString().split('T')[0]}.csv`,
            filters: [{ name: 'CSV', extensions: ['csv'] }],
        });

        if (result.canceled || !result.filePath) return null;

        let csv = '';

        if (type === 'clients') {
            csv = 'Name,Email,Phone,Billing Address,Shipping Address,Tax Number\n';
            const clients = db.prepare(`SELECT * FROM clients WHERE profile_id = ?`).all(profileId);
            for (const c of clients as any[]) {
                csv += `"${c.name}","${c.email || ''}","${c.phone || ''}","${c.billing_address}","${c.shipping_address || ''}","${c.tax_number || ''}"\n`;
            }
        } else if (type === 'products') {
            csv = 'SKU,Name,Unit,Price,Cost,Stock\n';
            const products = db.prepare(`SELECT * FROM products WHERE profile_id = ?`).all(profileId);
            for (const p of products as any[]) {
                csv += `"${p.sku || ''}","${p.name}","${p.unit}",${p.price},${p.cost || ''},${p.stock || ''}\n`;
            }
        } else if (type === 'invoices') {
            csv = 'Invoice Number,Client,Issue Date,Due Date,Status,Subtotal,Tax,Discount,Total,Paid,Balance\n';
            const invoices = db.prepare(`
        SELECT i.*, c.name as client_name FROM invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.profile_id = ?
      `).all(profileId);
            for (const i of invoices as any[]) {
                csv += `"${i.invoice_number}","${i.client_name}","${i.issue_date}","${i.due_date}","${i.status}",${i.subtotal},${i.tax_total},${i.discount_total},${i.grand_total},${i.amount_paid},${i.balance_due}\n`;
            }
        } else if (type === 'payments') {
            csv = 'Date,Invoice,Amount,Method,Reference,Type\n';
            const payments = db.prepare(`
        SELECT p.*, i.invoice_number FROM payments p
        LEFT JOIN invoices i ON p.invoice_id = i.id
        WHERE p.profile_id = ?
      `).all(profileId);
            for (const p of payments as any[]) {
                csv += `"${p.payment_date}","${p.invoice_number}",${p.amount},"${p.method}","${p.reference || ''}","${p.is_refund ? 'Refund' : 'Payment'}"\n`;
            }
        } else if (type === 'expenses') {
            csv = 'Date,Category,Vendor,Description,Amount,Tax\n';
            const expenses = db.prepare(`
        SELECT e.*, c.name as category_name FROM expenses e
        LEFT JOIN expense_categories c ON e.category_id = c.id
        WHERE e.profile_id = ?
      `).all(profileId);
            for (const e of expenses as any[]) {
                csv += `"${e.expense_date}","${e.category_name}","${e.vendor || ''}","${e.description}",${e.amount},${e.tax_amount}\n`;
            }
        }

        fs.writeFileSync(result.filePath, csv);
        return result.filePath;
    });

    // Dialog handlers
    ipcMain.handle('dialog:save', async (_, options: any) => {
        return dialog.showSaveDialog(options);
    });

    ipcMain.handle('dialog:open', async (_, options: any) => {
        return dialog.showOpenDialog(options);
    });
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

function logAudit(db: any, profileId: string, action: string, entityType: string, entityId: string, details: string) {
    db.prepare(`
    INSERT INTO audit_log (id, profile_id, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), profileId, action, entityType, entityId, details, new Date().toISOString());
}
