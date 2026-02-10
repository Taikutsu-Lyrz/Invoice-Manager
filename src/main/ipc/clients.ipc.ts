import { ipcMain } from 'electron';
import { getDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerClientsHandlers(): void {
    ipcMain.handle('clients:list', (_, profileId: string, search?: string) => {
        const db = getDatabase();

        let query = `
      SELECT * FROM clients WHERE profile_id = ? AND deleted_at IS NULL
    `;
        const params: any[] = [profileId];

        if (search) {
            query += ` AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        query += ` ORDER BY name ASC`;

        const clients = db.prepare(query).all(...params);

        return clients.map(mapClientFromDb);
    });

    // List deleted clients (trash)
    ipcMain.handle('clients:list-deleted', (_, profileId: string) => {
        const db = getDatabase();
        const clients = db.prepare(`
            SELECT * FROM clients WHERE profile_id = ? AND deleted_at IS NOT NULL
            ORDER BY deleted_at DESC
        `).all(profileId);
        return clients.map(mapClientFromDb);
    });

    ipcMain.handle('clients:get', (_, id: string) => {
        const db = getDatabase();
        const client = db.prepare(`SELECT * FROM clients WHERE id = ?`).get(id);
        return client ? mapClientFromDb(client) : null;
    });

    ipcMain.handle('clients:create', (_, profileId: string, data: any) => {
        const db = getDatabase();
        const id = uuidv4();
        const now = new Date().toISOString();

        db.prepare(`
      INSERT INTO clients (id, profile_id, name, email, phone, billing_address, shipping_address, tax_number, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id,
            profileId,
            data.name,
            data.email || null,
            data.phone || null,
            data.billingAddress,
            data.shippingAddress || null,
            data.taxNumber || null,
            data.notes || null,
            now,
            now
        );

        logAudit(db, profileId, 'created', 'client', id, `Created client: ${data.name}`);

        return { id, ...data, profileId, createdAt: now, updatedAt: now };
    });

    ipcMain.handle('clients:update', (_, id: string, data: any) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        const existing = db.prepare(`SELECT profile_id FROM clients WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Client not found');

        db.prepare(`
      UPDATE clients SET
        name = COALESCE(?, name),
        email = ?,
        phone = ?,
        billing_address = COALESCE(?, billing_address),
        shipping_address = ?,
        tax_number = ?,
        notes = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
            data.name,
            data.email || null,
            data.phone || null,
            data.billingAddress,
            data.shippingAddress || null,
            data.taxNumber || null,
            data.notes || null,
            now,
            id
        );

        logAudit(db, existing.profile_id, 'updated', 'client', id, `Updated client: ${data.name}`);

        return { id, ...data, updatedAt: now };
    });

    // Soft delete - move to trash
    ipcMain.handle('clients:delete', (_, id: string) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        const existing = db.prepare(`SELECT profile_id, name FROM clients WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Client not found');

        // Soft delete - set deleted_at timestamp
        db.prepare(`UPDATE clients SET deleted_at = ? WHERE id = ?`).run(now, id);

        logAudit(db, existing.profile_id, 'deleted', 'client', id, `Moved client to trash: ${existing.name}`);
    });

    // Restore from trash
    ipcMain.handle('clients:restore', (_, id: string) => {
        const db = getDatabase();

        const existing = db.prepare(`SELECT profile_id, name FROM clients WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Client not found');

        db.prepare(`UPDATE clients SET deleted_at = NULL WHERE id = ?`).run(id);

        logAudit(db, existing.profile_id, 'restored', 'client', id, `Restored client: ${existing.name}`);
    });

    // Permanent delete
    ipcMain.handle('clients:permanent-delete', (_, id: string) => {
        const db = getDatabase();

        const existing = db.prepare(`SELECT profile_id, name FROM clients WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Client not found');

        // Check if client has ACTIVE invoices (not soft-deleted)
        const invoiceCount = db.prepare(`SELECT COUNT(*) as count FROM invoices WHERE client_id = ? AND deleted_at IS NULL`).get(id) as { count: number };
        if (invoiceCount.count > 0) {
            throw new Error('Cannot permanently delete client with existing invoices. Please delete or move the invoices to trash first.');
        }

        db.prepare(`DELETE FROM clients WHERE id = ?`).run(id);

        logAudit(db, existing.profile_id, 'permanent-deleted', 'client', id, `Permanently deleted client: ${existing.name}`);
    });

    ipcMain.handle('clients:check-duplicate', (_, profileId: string, name: string, email?: string) => {
        const db = getDatabase();

        const existing = db.prepare(`
      SELECT id FROM clients 
      WHERE profile_id = ? AND (LOWER(name) = LOWER(?) OR (email IS NOT NULL AND LOWER(email) = LOWER(?)))
    `).get(profileId, name, email || '') as any;

        return Boolean(existing);
    });
}

function mapClientFromDb(row: any) {
    return {
        id: row.id,
        profileId: row.profile_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        billingAddress: row.billing_address,
        shippingAddress: row.shipping_address,
        taxNumber: row.tax_number,
        notes: row.notes,
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
