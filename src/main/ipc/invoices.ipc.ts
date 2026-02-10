import { ipcMain, shell, dialog, app } from 'electron';
import { getDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { generateInvoicePdf } from '../pdf/invoice-pdf';
import * as path from 'path';
import * as fs from 'fs';

export function registerInvoicesHandlers(): void {
    ipcMain.handle('invoices:list', (_, profileId: string, filters?: any) => {
        const db = getDatabase();

        let query = `
      SELECT i.*, c.name as client_name, c.email as client_email
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.profile_id = ? AND i.deleted_at IS NULL
    `;
        const params: any[] = [profileId];

        if (filters?.status) {
            query += ` AND i.status = ?`;
            params.push(filters.status);
        }

        if (filters?.clientId) {
            query += ` AND i.client_id = ?`;
            params.push(filters.clientId);
        }

        if (filters?.startDate) {
            query += ` AND i.issue_date >= ?`;
            params.push(filters.startDate);
        }

        if (filters?.endDate) {
            query += ` AND i.issue_date <= ?`;
            params.push(filters.endDate);
        }

        if (filters?.search) {
            query += ` AND (i.invoice_number LIKE ? OR c.name LIKE ?)`;
            const searchPattern = `%${filters.search}%`;
            params.push(searchPattern, searchPattern);
        }

        if (filters?.overdue) {
            query += ` AND i.status NOT IN ('paid', 'void', 'refunded') AND i.due_date < date('now')`;
        }

        const orderBy = filters?.sortBy || 'issue_date';
        const orderDir = filters?.sortDir || 'DESC';
        query += ` ORDER BY i.${orderBy} ${orderDir}`;

        const invoices = db.prepare(query).all(...params);

        return invoices.map((inv: any) => ({
            ...mapInvoiceFromDb(inv),
            client: inv.client_name ? { name: inv.client_name, email: inv.client_email } : null,
        }));
    });

    // List deleted invoices (trash)
    ipcMain.handle('invoices:list-deleted', (_, profileId: string) => {
        const db = getDatabase();
        const invoices = db.prepare(`
            SELECT i.*, c.name as client_name, c.email as client_email
            FROM invoices i
            LEFT JOIN clients c ON i.client_id = c.id
            WHERE i.profile_id = ? AND i.deleted_at IS NOT NULL
            ORDER BY i.deleted_at DESC
        `).all(profileId);
        return invoices.map((inv: any) => ({
            ...mapInvoiceFromDb(inv),
            client: inv.client_name ? { name: inv.client_name, email: inv.client_email } : null,
        }));
    });

    ipcMain.handle('invoices:get', (_, id: string) => {
        const db = getDatabase();
        const invoice = db.prepare(`
      SELECT i.*, c.name as client_name, c.email as client_email, c.billing_address as client_address
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = ?
    `).get(id) as any;

        if (!invoice) return null;

        const items = db.prepare(`SELECT * FROM invoice_items WHERE invoice_id = ?`).all(id);

        return {
            ...mapInvoiceFromDb(invoice),
            client: {
                id: invoice.client_id,
                name: invoice.client_name,
                email: invoice.client_email,
                billingAddress: invoice.client_address,
            },
            items: items.map(mapInvoiceItemFromDb),
        };
    });

    ipcMain.handle('invoices:create', (_, profileId: string, data: any) => {
        const db = getDatabase();
        const id = uuidv4();
        const now = new Date().toISOString();

        // Get next invoice number
        const settings = db.prepare(`SELECT data FROM settings WHERE profile_id = ?`).get(profileId) as any;
        const settingsData = JSON.parse(settings.data);
        const invoiceNumber = formatInvoiceNumber(settingsData.invoicePrefix, settingsData.invoiceNextNumber);

        // Calculate totals
        const { subtotal, taxTotal, discountTotal, grandTotal } = calculateInvoiceTotals(data.items);

        db.prepare(`
      INSERT INTO invoices (id, profile_id, invoice_number, client_id, status, issue_date, due_date,
        subtotal, tax_total, discount_total, grand_total, amount_paid, balance_due, notes, terms,
        attachments, recurring_rule, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id, profileId, invoiceNumber, data.clientId, 'draft', data.issueDate, data.dueDate,
            subtotal, taxTotal, discountTotal, grandTotal, 0, grandTotal,
            data.notes || null, data.terms || null,
            JSON.stringify(data.attachments || []),
            data.recurringRule ? JSON.stringify(data.recurringRule) : null,
            now, now
        );

        // Insert invoice items
        const insertItem = db.prepare(`
      INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit_price,
        tax_rate, tax_amount, discount_percent, discount_amount, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        for (const item of data.items) {
            const { taxAmount, discountAmount, lineTotal } = calculateItemTotals(item);
            insertItem.run(
                uuidv4(), id, item.productId || null, item.description,
                item.quantity, item.unitPrice, item.taxRate || 0,
                taxAmount, item.discountPercent || 0, discountAmount, lineTotal
            );
        }

        // Update next invoice number
        settingsData.invoiceNextNumber += 1;
        db.prepare(`UPDATE settings SET data = ?, updated_at = ? WHERE profile_id = ?`)
            .run(JSON.stringify(settingsData), now, profileId);

        logAudit(db, profileId, 'created', 'invoice', id, `Created invoice: ${invoiceNumber}`);

        return { id, invoiceNumber, status: 'draft', grandTotal, createdAt: now };
    });

    ipcMain.handle('invoices:update', (_, id: string, data: any) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        const existing = db.prepare(`SELECT profile_id, invoice_number, status FROM invoices WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Invoice not found');

        // Calculate totals if items provided
        let totals = {};
        if (data.items) {
            const calculated = calculateInvoiceTotals(data.items);
            const amountPaid = db.prepare(`SELECT COALESCE(SUM(amount), 0) as paid FROM payments WHERE invoice_id = ? AND is_refund = 0`).get(id) as any;
            const refunded = db.prepare(`SELECT COALESCE(SUM(amount), 0) as refunded FROM payments WHERE invoice_id = ? AND is_refund = 1`).get(id) as any;
            const netPaid = (amountPaid?.paid || 0) - (refunded?.refunded || 0);

            totals = {
                subtotal: calculated.subtotal,
                taxTotal: calculated.taxTotal,
                discountTotal: calculated.discountTotal,
                grandTotal: calculated.grandTotal,
                balanceDue: calculated.grandTotal - netPaid,
            };

            // Delete old items and insert new
            db.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`).run(id);

            const insertItem = db.prepare(`
        INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit_price,
          tax_rate, tax_amount, discount_percent, discount_amount, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

            for (const item of data.items) {
                const { taxAmount, discountAmount, lineTotal } = calculateItemTotals(item);
                insertItem.run(
                    uuidv4(), id, item.productId || null, item.description,
                    item.quantity, item.unitPrice, item.taxRate || 0,
                    taxAmount, item.discountPercent || 0, discountAmount, lineTotal
                );
            }
        }

        db.prepare(`
      UPDATE invoices SET
        client_id = COALESCE(?, client_id),
        issue_date = COALESCE(?, issue_date),
        due_date = COALESCE(?, due_date),
        subtotal = COALESCE(?, subtotal),
        tax_total = COALESCE(?, tax_total),
        discount_total = COALESCE(?, discount_total),
        grand_total = COALESCE(?, grand_total),
        balance_due = COALESCE(?, balance_due),
        notes = ?,
        terms = ?,
        attachments = COALESCE(?, attachments),
        recurring_rule = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
            data.clientId,
            data.issueDate,
            data.dueDate,
            (totals as any).subtotal,
            (totals as any).taxTotal,
            (totals as any).discountTotal,
            (totals as any).grandTotal,
            (totals as any).balanceDue,
            data.notes !== undefined ? data.notes : null,
            data.terms !== undefined ? data.terms : null,
            data.attachments ? JSON.stringify(data.attachments) : null,
            data.recurringRule ? JSON.stringify(data.recurringRule) : null,
            now,
            id
        );

        logAudit(db, existing.profile_id, 'updated', 'invoice', id, `Updated invoice: ${existing.invoice_number}`);

        return { id, updatedAt: now };
    });

    // Soft delete - move to trash
    ipcMain.handle('invoices:delete', (_, id: string) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        const existing = db.prepare(`SELECT profile_id, invoice_number FROM invoices WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Invoice not found');

        db.prepare(`UPDATE invoices SET deleted_at = ? WHERE id = ?`).run(now, id);

        logAudit(db, existing.profile_id, 'deleted', 'invoice', id, `Moved invoice to trash: ${existing.invoice_number}`);
    });

    // Restore from trash
    ipcMain.handle('invoices:restore', (_, id: string) => {
        const db = getDatabase();

        const existing = db.prepare(`SELECT profile_id, invoice_number FROM invoices WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Invoice not found');

        db.prepare(`UPDATE invoices SET deleted_at = NULL WHERE id = ?`).run(id);

        logAudit(db, existing.profile_id, 'restored', 'invoice', id, `Restored invoice: ${existing.invoice_number}`);
    });

    // Permanent delete
    ipcMain.handle('invoices:permanent-delete', (_, id: string) => {
        const db = getDatabase();

        const existing = db.prepare(`SELECT profile_id, invoice_number FROM invoices WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Invoice not found');

        db.prepare(`DELETE FROM invoices WHERE id = ?`).run(id);

        logAudit(db, existing.profile_id, 'permanent-deleted', 'invoice', id, `Permanently deleted invoice: ${existing.invoice_number}`);
    });

    ipcMain.handle('invoices:update-status', (_, id: string, status: string) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        const existing = db.prepare(`SELECT profile_id, invoice_number FROM invoices WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Invoice not found');

        db.prepare(`UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?`).run(status, now, id);

        logAudit(db, existing.profile_id, 'status_changed', 'invoice', id, `Invoice ${existing.invoice_number} status changed to ${status}`);
    });

    ipcMain.handle('invoices:generate-pdf', async (_, id: string, template?: string) => {
        const db = getDatabase();

        // Get full invoice data
        const invoice = db.prepare(`
      SELECT i.*, c.name as client_name, c.email as client_email, c.billing_address as client_address,
             c.phone as client_phone, c.tax_number as client_tax_number
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = ?
    `).get(id) as any;

        if (!invoice) throw new Error('Invoice not found');

        const items = db.prepare(`SELECT * FROM invoice_items WHERE invoice_id = ?`).all(id);
        const settings = db.prepare(`SELECT data FROM settings WHERE profile_id = ?`).get(invoice.profile_id) as any;
        const settingsData = JSON.parse(settings.data);

        const invoiceData = {
            ...mapInvoiceFromDb(invoice),
            client: {
                name: invoice.client_name,
                email: invoice.client_email,
                billingAddress: invoice.client_address,
                phone: invoice.client_phone,
                taxNumber: invoice.client_tax_number,
            },
            items: items.map(mapInvoiceItemFromDb),
        };

        const pdfPath = await generateInvoicePdf(invoiceData, settingsData, template || settingsData.pdfTemplate);

        return pdfPath;
    });

    ipcMain.handle('invoices:send-email', async (_, id: string) => {
        const db = getDatabase();

        const invoice = db.prepare(`
      SELECT i.*, c.name as client_name, c.email as client_email
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = ?
    `).get(id) as any;

        if (!invoice) throw new Error('Invoice not found');
        if (!invoice.client_email) throw new Error('Client has no email address');

        const settings = db.prepare(`SELECT data FROM settings WHERE profile_id = ?`).get(invoice.profile_id) as any;
        const settingsData = JSON.parse(settings.data);

        const subject = `Invoice ${invoice.invoice_number} from ${settingsData.companyName}`;
        const body = `Dear ${invoice.client_name},

Please find attached invoice ${invoice.invoice_number} for ${settingsData.currencySymbol}${invoice.grand_total.toFixed(2)}.

Due Date: ${new Date(invoice.due_date).toLocaleDateString()}

${settingsData.defaultNotes || 'Thank you for your business!'}

Best regards,
${settingsData.companyName}`;

        const mailto = `mailto:${invoice.client_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        await shell.openExternal(mailto);

        // Update status to sent if draft
        if (invoice.status === 'draft') {
            const now = new Date().toISOString();
            db.prepare(`UPDATE invoices SET status = 'sent', updated_at = ? WHERE id = ?`).run(now, id);
        }

        logAudit(db, invoice.profile_id, 'sent', 'invoice', id, `Sent invoice: ${invoice.invoice_number}`);
    });

    ipcMain.handle('invoices:duplicate', (_, id: string) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(id) as any;
        if (!invoice) throw new Error('Invoice not found');

        const items = db.prepare(`SELECT * FROM invoice_items WHERE invoice_id = ?`).all(id);

        // Get next invoice number
        const settings = db.prepare(`SELECT data FROM settings WHERE profile_id = ?`).get(invoice.profile_id) as any;
        const settingsData = JSON.parse(settings.data);
        const invoiceNumber = formatInvoiceNumber(settingsData.invoicePrefix, settingsData.invoiceNextNumber);

        const newId = uuidv4();
        const today = new Date().toISOString().split('T')[0];
        const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        db.prepare(`
      INSERT INTO invoices (id, profile_id, invoice_number, client_id, status, issue_date, due_date,
        subtotal, tax_total, discount_total, grand_total, amount_paid, balance_due, notes, terms,
        attachments, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, '[]', ?, ?)
    `).run(
            newId, invoice.profile_id, invoiceNumber, invoice.client_id, today, dueDate,
            invoice.subtotal, invoice.tax_total, invoice.discount_total, invoice.grand_total,
            invoice.grand_total, invoice.notes, invoice.terms, now, now
        );

        // Duplicate items
        const insertItem = db.prepare(`
      INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit_price,
        tax_rate, tax_amount, discount_percent, discount_amount, line_total)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        for (const item of items as any[]) {
            insertItem.run(
                uuidv4(), newId, item.product_id, item.description,
                item.quantity, item.unit_price, item.tax_rate,
                item.tax_amount, item.discount_percent, item.discount_amount, item.line_total
            );
        }

        // Update next invoice number
        settingsData.invoiceNextNumber += 1;
        db.prepare(`UPDATE settings SET data = ?, updated_at = ? WHERE profile_id = ?`)
            .run(JSON.stringify(settingsData), now, invoice.profile_id);

        logAudit(db, invoice.profile_id, 'duplicated', 'invoice', newId, `Duplicated from ${invoice.invoice_number} to ${invoiceNumber}`);

        return { id: newId, invoiceNumber };
    });

    ipcMain.handle('invoices:next-number', (_, profileId: string) => {
        const db = getDatabase();
        const settings = db.prepare(`SELECT data FROM settings WHERE profile_id = ?`).get(profileId) as any;
        const settingsData = JSON.parse(settings.data);
        return formatInvoiceNumber(settingsData.invoicePrefix, settingsData.invoiceNextNumber);
    });
}

function mapInvoiceFromDb(row: any) {
    return {
        id: row.id,
        profileId: row.profile_id,
        invoiceNumber: row.invoice_number,
        clientId: row.client_id,
        status: row.status,
        issueDate: row.issue_date,
        dueDate: row.due_date,
        subtotal: row.subtotal,
        taxTotal: row.tax_total,
        discountTotal: row.discount_total,
        grandTotal: row.grand_total,
        amountPaid: row.amount_paid,
        balanceDue: row.balance_due,
        notes: row.notes,
        terms: row.terms,
        attachments: JSON.parse(row.attachments || '[]'),
        recurringRule: row.recurring_rule ? JSON.parse(row.recurring_rule) : null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
    };
}

function mapInvoiceItemFromDb(row: any) {
    return {
        id: row.id,
        invoiceId: row.invoice_id,
        productId: row.product_id,
        description: row.description,
        quantity: row.quantity,
        unitPrice: row.unit_price,
        taxRate: row.tax_rate,
        taxAmount: row.tax_amount,
        discountPercent: row.discount_percent,
        discountAmount: row.discount_amount,
        lineTotal: row.line_total,
    };
}

function calculateItemTotals(item: any) {
    const baseAmount = item.quantity * item.unitPrice;
    const discountAmount = baseAmount * (item.discountPercent || 0) / 100;
    const afterDiscount = baseAmount - discountAmount;
    const taxAmount = afterDiscount * (item.taxRate || 0) / 100;
    const lineTotal = afterDiscount + taxAmount;

    return { taxAmount, discountAmount, lineTotal };
}

function calculateInvoiceTotals(items: any[]) {
    let subtotal = 0;
    let taxTotal = 0;
    let discountTotal = 0;

    for (const item of items) {
        const baseAmount = item.quantity * item.unitPrice;
        const { taxAmount, discountAmount, lineTotal } = calculateItemTotals(item);

        subtotal += baseAmount;
        taxTotal += taxAmount;
        discountTotal += discountAmount;
    }

    const grandTotal = subtotal - discountTotal + taxTotal;

    return { subtotal, taxTotal, discountTotal, grandTotal };
}

function formatInvoiceNumber(prefix: string, number: number): string {
    const year = new Date().getFullYear();
    const paddedNumber = String(number).padStart(4, '0');
    return `${prefix}-${year}-${paddedNumber}`;
}

function logAudit(db: any, profileId: string, action: string, entityType: string, entityId: string, details: string) {
    db.prepare(`
    INSERT INTO audit_log (id, profile_id, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), profileId, action, entityType, entityId, details, new Date().toISOString());
}
