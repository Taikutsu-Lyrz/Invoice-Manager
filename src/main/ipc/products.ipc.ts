import { ipcMain } from 'electron';
import { getDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';

export function registerProductsHandlers(): void {
    ipcMain.handle('products:list', (_, profileId: string, search?: string) => {
        const db = getDatabase();

        let query = `SELECT * FROM products WHERE profile_id = ? AND deleted_at IS NULL`;
        const params: any[] = [profileId];

        if (search) {
            query += ` AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)`;
            const searchPattern = `%${search}%`;
            params.push(searchPattern, searchPattern, searchPattern);
        }

        query += ` ORDER BY name ASC`;

        const products = db.prepare(query).all(...params);

        return products.map(mapProductFromDb);
    });

    // List deleted products (trash)
    ipcMain.handle('products:list-deleted', (_, profileId: string) => {
        const db = getDatabase();
        const products = db.prepare(`
            SELECT * FROM products WHERE profile_id = ? AND deleted_at IS NOT NULL
            ORDER BY deleted_at DESC
        `).all(profileId);
        return products.map(mapProductFromDb);
    });

    ipcMain.handle('products:get', (_, id: string) => {
        const db = getDatabase();
        const product = db.prepare(`SELECT * FROM products WHERE id = ?`).get(id);
        return product ? mapProductFromDb(product) : null;
    });

    ipcMain.handle('products:create', (_, profileId: string, data: any) => {
        const db = getDatabase();
        const id = uuidv4();
        const now = new Date().toISOString();

        db.prepare(`
      INSERT INTO products (id, profile_id, sku, name, description, unit, price, cost, tax_rate_id, stock, track_stock, image, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
            id,
            profileId,
            data.sku || null,
            data.name,
            data.description || null,
            data.unit || 'pcs',
            data.price || 0,
            data.cost || null,
            data.taxRateId || null,
            data.stock || null,
            data.trackStock ? 1 : 0,
            data.image || null,
            now,
            now
        );

        logAudit(db, profileId, 'created', 'product', id, `Created product: ${data.name}`);

        return { id, ...data, profileId, createdAt: now, updatedAt: now };
    });

    ipcMain.handle('products:update', (_, id: string, data: any) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        const existing = db.prepare(`SELECT profile_id FROM products WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Product not found');

        db.prepare(`
      UPDATE products SET
        sku = ?,
        name = COALESCE(?, name),
        description = ?,
        unit = COALESCE(?, unit),
        price = COALESCE(?, price),
        cost = ?,
        tax_rate_id = ?,
        stock = ?,
        track_stock = ?,
        image = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
            data.sku || null,
            data.name,
            data.description || null,
            data.unit,
            data.price,
            data.cost || null,
            data.taxRateId || null,
            data.stock || null,
            data.trackStock ? 1 : 0,
            data.image || null,
            now,
            id
        );

        logAudit(db, existing.profile_id, 'updated', 'product', id, `Updated product: ${data.name}`);

        return { id, ...data, updatedAt: now };
    });

    // Soft delete - move to trash
    ipcMain.handle('products:delete', (_, id: string) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        const existing = db.prepare(`SELECT profile_id, name FROM products WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Product not found');

        db.prepare(`UPDATE products SET deleted_at = ? WHERE id = ?`).run(now, id);

        logAudit(db, existing.profile_id, 'deleted', 'product', id, `Moved product to trash: ${existing.name}`);
    });

    // Restore from trash
    ipcMain.handle('products:restore', (_, id: string) => {
        const db = getDatabase();

        const existing = db.prepare(`SELECT profile_id, name FROM products WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Product not found');

        db.prepare(`UPDATE products SET deleted_at = NULL WHERE id = ?`).run(id);

        logAudit(db, existing.profile_id, 'restored', 'product', id, `Restored product: ${existing.name}`);
    });

    // Permanent delete
    ipcMain.handle('products:permanent-delete', (_, id: string) => {
        const db = getDatabase();

        const existing = db.prepare(`SELECT profile_id, name FROM products WHERE id = ?`).get(id) as any;
        if (!existing) throw new Error('Product not found');

        db.prepare(`DELETE FROM products WHERE id = ?`).run(id);

        logAudit(db, existing.profile_id, 'permanent-deleted', 'product', id, `Permanently deleted product: ${existing.name}`);
    });
}

function mapProductFromDb(row: any) {
    return {
        id: row.id,
        profileId: row.profile_id,
        sku: row.sku,
        name: row.name,
        description: row.description,
        unit: row.unit,
        price: row.price,
        cost: row.cost,
        taxRateId: row.tax_rate_id,
        stock: row.stock,
        trackStock: Boolean(row.track_stock),
        image: row.image,
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
