import { ipcMain } from 'electron';
import { getDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { generateReceiptPdf } from '../pdf/receipt-pdf';

export function registerPaymentsHandlers(): void {
    ipcMain.handle('payments:list', (_, profileId: string, filters?: any) => {
        const db = getDatabase();

        let query = `
      SELECT p.*, i.invoice_number, c.name as client_name
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE p.profile_id = ? AND p.deleted_at IS NULL
    `;
        const params: any[] = [profileId];

        if (filters?.invoiceId) {
            query += ` AND p.invoice_id = ?`;
            params.push(filters.invoiceId);
        }

        if (filters?.startDate) {
            query += ` AND p.payment_date >= ?`;
            params.push(filters.startDate);
        }

        if (filters?.endDate) {
            query += ` AND p.payment_date <= ?`;
            params.push(filters.endDate);
        }

        if (filters?.method) {
            query += ` AND p.method = ?`;
            params.push(filters.method);
        }

        query += ` ORDER BY p.payment_date DESC`;

        const payments = db.prepare(query).all(...params);

        return payments.map((p: any) => ({
            ...mapPaymentFromDb(p),
            invoiceNumber: p.invoice_number,
            clientName: p.client_name,
        }));
    });

    // List deleted payments (trash)
    ipcMain.handle('payments:list-deleted', (_, profileId: string) => {
        const db = getDatabase();
        const payments = db.prepare(`
            SELECT p.*, i.invoice_number, c.name as client_name
            FROM payments p
            LEFT JOIN invoices i ON p.invoice_id = i.id
            LEFT JOIN clients c ON i.client_id = c.id
            WHERE p.profile_id = ? AND p.deleted_at IS NOT NULL
            ORDER BY p.deleted_at DESC
        `).all(profileId);
        return payments.map((p: any) => ({
            ...mapPaymentFromDb(p),
            invoiceNumber: p.invoice_number,
            clientName: p.client_name,
        }));
    });

    ipcMain.handle('payments:get', (_, id: string) => {
        const db = getDatabase();
        const payment = db.prepare(`
      SELECT p.*, i.invoice_number, c.name as client_name
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE p.id = ?
    `).get(id) as any;

        if (!payment) return null;

        return {
            ...mapPaymentFromDb(payment),
            invoiceNumber: payment.invoice_number,
            clientName: payment.client_name,
        };
    });

    ipcMain.handle('payments:create', (_, profileId: string, data: any) => {
        const db = getDatabase();
        const id = uuidv4();
        const now = new Date().toISOString();

        // Validate invoice exists
        const invoice = db.prepare(`SELECT id, grand_total, amount_paid, status FROM invoices WHERE id = ?`).get(data.invoiceId) as any;
        if (!invoice) throw new Error('Invoice not found');

        // Insert payment
        db.prepare(`
      INSERT INTO payments (id, profile_id, invoice_id, amount, method, reference, payment_date, notes, is_refund, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id, profileId, data.invoiceId, data.amount, data.method,
            data.reference || null, data.paymentDate, data.notes || null,
            data.isRefund ? 1 : 0, now
        );

        // Update invoice payment totals
        updateInvoicePaymentTotals(db, data.invoiceId);

        const invoiceNum = db.prepare(`SELECT invoice_number FROM invoices WHERE id = ?`).get(data.invoiceId) as any;
        logAudit(db, profileId, data.isRefund ? 'refund_recorded' : 'payment_recorded', 'payment', id,
            `${data.isRefund ? 'Refund' : 'Payment'} of ${data.amount} for invoice ${invoiceNum.invoice_number}`);

        return { id, ...data, profileId, createdAt: now };
    });

    // Soft delete - move to trash
    ipcMain.handle('payments:delete', (_, id: string) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        const payment = db.prepare(`SELECT profile_id, invoice_id, amount FROM payments WHERE id = ?`).get(id) as any;
        if (!payment) throw new Error('Payment not found');

        db.prepare(`UPDATE payments SET deleted_at = ? WHERE id = ?`).run(now, id);

        // Update invoice payment totals
        updateInvoicePaymentTotals(db, payment.invoice_id);

        logAudit(db, payment.profile_id, 'deleted', 'payment', id, `Moved payment of ${payment.amount} to trash`);
    });

    // Restore from trash
    ipcMain.handle('payments:restore', (_, id: string) => {
        const db = getDatabase();

        const payment = db.prepare(`SELECT profile_id, invoice_id, amount FROM payments WHERE id = ?`).get(id) as any;
        if (!payment) throw new Error('Payment not found');

        db.prepare(`UPDATE payments SET deleted_at = NULL WHERE id = ?`).run(id);

        // Update invoice payment totals
        updateInvoicePaymentTotals(db, payment.invoice_id);

        logAudit(db, payment.profile_id, 'restored', 'payment', id, `Restored payment of ${payment.amount}`);
    });

    // Permanent delete
    ipcMain.handle('payments:permanent-delete', (_, id: string) => {
        const db = getDatabase();

        const payment = db.prepare(`SELECT profile_id, invoice_id, amount FROM payments WHERE id = ?`).get(id) as any;
        if (!payment) throw new Error('Payment not found');

        db.prepare(`DELETE FROM payments WHERE id = ?`).run(id);

        // Update invoice payment totals
        updateInvoicePaymentTotals(db, payment.invoice_id);

        logAudit(db, payment.profile_id, 'permanent-deleted', 'payment', id, `Permanently deleted payment of ${payment.amount}`);
    });

    ipcMain.handle('payments:by-invoice', (_, invoiceId: string) => {
        const db = getDatabase();
        const payments = db.prepare(`
      SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC
    `).all(invoiceId);

        return payments.map(mapPaymentFromDb);
    });

    ipcMain.handle('payments:generate-receipt', async (_, id: string) => {
        const db = getDatabase();

        const payment = db.prepare(`
      SELECT p.*, i.invoice_number, i.grand_total as invoice_total,
             c.name as client_name, c.email as client_email, c.billing_address as client_address
      FROM payments p
      LEFT JOIN invoices i ON p.invoice_id = i.id
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE p.id = ?
    `).get(id) as any;

        if (!payment) throw new Error('Payment not found');

        const settings = db.prepare(`SELECT data FROM settings WHERE profile_id = ?`).get(payment.profile_id) as any;
        const settingsData = JSON.parse(settings.data);

        const paymentData = {
            ...mapPaymentFromDb(payment),
            invoiceNumber: payment.invoice_number,
            invoiceTotal: payment.invoice_total,
            client: {
                name: payment.client_name,
                email: payment.client_email,
                billingAddress: payment.client_address,
            },
        };

        const pdfPath = await generateReceiptPdf(paymentData, settingsData);

        return pdfPath;
    });
}

function updateInvoicePaymentTotals(db: any, invoiceId: string) {
    const totals = db.prepare(`
    SELECT 
      COALESCE(SUM(CASE WHEN is_refund = 0 THEN amount ELSE 0 END), 0) as paid,
      COALESCE(SUM(CASE WHEN is_refund = 1 THEN amount ELSE 0 END), 0) as refunded
    FROM payments WHERE invoice_id = ?
  `).get(invoiceId) as any;

    const invoice = db.prepare(`SELECT grand_total FROM invoices WHERE id = ?`).get(invoiceId) as any;

    const amountPaid = totals.paid - totals.refunded;
    const balanceDue = invoice.grand_total - amountPaid;

    let status = 'sent';
    if (balanceDue <= 0) {
        status = totals.refunded > 0 ? 'refunded' : 'paid';
    } else if (amountPaid > 0) {
        status = 'partial';
    }

    const now = new Date().toISOString();
    db.prepare(`
    UPDATE invoices SET amount_paid = ?, balance_due = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).run(amountPaid, balanceDue, status, now, invoiceId);
}

function mapPaymentFromDb(row: any) {
    return {
        id: row.id,
        profileId: row.profile_id,
        invoiceId: row.invoice_id,
        amount: row.amount,
        method: row.method,
        reference: row.reference,
        paymentDate: row.payment_date,
        notes: row.notes,
        isRefund: Boolean(row.is_refund),
        createdAt: row.created_at,
        deletedAt: row.deleted_at,
    };
}

function logAudit(db: any, profileId: string, action: string, entityType: string, entityId: string, details: string) {
    db.prepare(`
    INSERT INTO audit_log (id, profile_id, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), profileId, action, entityType, entityId, details, new Date().toISOString());
}
