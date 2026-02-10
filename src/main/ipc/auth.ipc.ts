import { ipcMain } from 'electron';
import { getDatabase } from '../database';
import { v4 as uuidv4 } from 'uuid';
import CryptoJS from 'crypto-js';

export function registerAuthHandlers(): void {
    // Get or create a profile for a specific Firebase user/tenant
    // This ensures each user has their own isolated local data
    ipcMain.handle('auth:get-or-create-profile-for-user', (_, data: { 
        firebaseUid: string; 
        tenantId: string; 
        displayName: string;
        useSharedTenantData?: boolean;
    }) => {
        const db = getDatabase();
        
        // Use tenantId as profileId for tenant-level data sharing (mother + all children share data)
        // Or use firebaseUid for per-user isolation
        const profileId = data.useSharedTenantData ? data.tenantId : data.firebaseUid;
        
        // Check if profile already exists
        const existing = db.prepare(`
            SELECT id, name, pin_hash IS NOT NULL as hasPin, created_at, updated_at
            FROM profiles WHERE id = ?
        `).get(profileId) as any;
        
        if (existing) {
            return {
                id: existing.id,
                name: existing.name,
                hasPin: Boolean(existing.hasPin),
                createdAt: existing.created_at,
                updatedAt: existing.updated_at,
                isNew: false
            };
        }
        
        // Create new profile for this user/tenant
        const now = new Date().toISOString();
        
        db.prepare(`
            INSERT INTO profiles (id, name, pin_hash, created_at, updated_at)
            VALUES (?, ?, NULL, ?, ?)
        `).run(profileId, data.displayName, now, now);
        
        // Create default settings for this profile
        const defaultSettings = {
            companyName: data.displayName,
            companyLogo: '',
            companyAddress: '',
            companyEmail: '',
            companyPhone: '',
            taxId: '',
            invoicePrefix: 'INV',
            invoiceNextNumber: 1,
            currency: 'USD',
            currencySymbol: '$',
            timezone: 'UTC',
            defaultTerms: 'Payment due within 30 days.',
            defaultNotes: 'Thank you for your business!',
            footerText: '',
            taxRates: [
                { id: uuidv4(), name: 'No Tax', rate: 0, isDefault: true },
                { id: uuidv4(), name: 'VAT 5%', rate: 5, isDefault: false },
                { id: uuidv4(), name: 'VAT 10%', rate: 10, isDefault: false },
                { id: uuidv4(), name: 'VAT 20%', rate: 20, isDefault: false },
            ],
            autoLockMinutes: 15,
            pdfTemplate: 'modern',
            paperSize: 'a4',
        };
        
        db.prepare(`
            INSERT INTO settings (id, profile_id, data, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `).run(uuidv4(), profileId, JSON.stringify(defaultSettings), now, now);
        
        // Create default expense categories
        const categories = [
            { name: 'Office Supplies', color: '#3b82f6' },
            { name: 'Travel', color: '#10b981' },
            { name: 'Utilities', color: '#f59e0b' },
            { name: 'Marketing', color: '#8b5cf6' },
            { name: 'Software', color: '#ec4899' },
            { name: 'Other', color: '#6b7280' },
        ];
        
        const insertCategory = db.prepare(`
            INSERT INTO expense_categories (id, profile_id, name, color)
            VALUES (?, ?, ?, ?)
        `);
        
        for (const cat of categories) {
            insertCategory.run(uuidv4(), profileId, cat.name, cat.color);
        }
        
        return { 
            id: profileId, 
            name: data.displayName, 
            hasPin: false, 
            createdAt: now, 
            updatedAt: now,
            isNew: true
        };
    });

    ipcMain.handle('auth:get-profiles', () => {
        const db = getDatabase();
        const profiles = db.prepare(`
      SELECT id, name, pin_hash IS NOT NULL as hasPin, created_at, updated_at
      FROM profiles
      ORDER BY created_at DESC
    `).all();

        return profiles.map((p: any) => ({
            id: p.id,
            name: p.name,
            hasPin: Boolean(p.hasPin),
            createdAt: p.created_at,
            updatedAt: p.updated_at,
        }));
    });

    ipcMain.handle('auth:create-profile', (_, data: { name: string; pin?: string }) => {
        const db = getDatabase();
        const id = uuidv4();
        const now = new Date().toISOString();
        const pinHash = data.pin ? hashPin(data.pin) : null;

        db.prepare(`
      INSERT INTO profiles (id, name, pin_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, data.name, pinHash, now, now);

        // Create default settings for this profile
        const defaultSettings = {
            companyName: 'My Company',
            companyLogo: '',
            companyAddress: '123 Business Street\nCity, State 12345',
            companyEmail: 'contact@mycompany.com',
            companyPhone: '+1 234 567 8900',
            taxId: '',
            invoicePrefix: 'INV',
            invoiceNextNumber: 1,
            currency: 'USD',
            currencySymbol: '$',
            timezone: 'UTC',
            defaultTerms: 'Payment due within 30 days.',
            defaultNotes: 'Thank you for your business!',
            footerText: '',
            taxRates: [
                { id: uuidv4(), name: 'No Tax', rate: 0, isDefault: true },
                { id: uuidv4(), name: 'VAT 5%', rate: 5, isDefault: false },
                { id: uuidv4(), name: 'VAT 10%', rate: 10, isDefault: false },
                { id: uuidv4(), name: 'VAT 20%', rate: 20, isDefault: false },
            ],
            autoLockMinutes: 15,
            pdfTemplate: 'modern',
            paperSize: 'a4',
        };

        db.prepare(`
      INSERT INTO settings (id, profile_id, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), id, JSON.stringify(defaultSettings), now, now);

        // Create default expense categories
        const categories = [
            { name: 'Office Supplies', color: '#3b82f6' },
            { name: 'Travel', color: '#10b981' },
            { name: 'Utilities', color: '#f59e0b' },
            { name: 'Marketing', color: '#8b5cf6' },
            { name: 'Software', color: '#ec4899' },
            { name: 'Other', color: '#6b7280' },
        ];

        const insertCategory = db.prepare(`
      INSERT INTO expense_categories (id, profile_id, name, color)
      VALUES (?, ?, ?, ?)
    `);

        for (const cat of categories) {
            insertCategory.run(uuidv4(), id, cat.name, cat.color);
        }

        return { id, name: data.name, hasPin: Boolean(data.pin), createdAt: now, updatedAt: now };
    });

    ipcMain.handle('auth:verify-pin', (_, profileId: string, pin: string) => {
        const db = getDatabase();
        const profile = db.prepare(`
      SELECT pin_hash FROM profiles WHERE id = ?
    `).get(profileId) as { pin_hash: string } | undefined;

        if (!profile || !profile.pin_hash) {
            return true; // No PIN set
        }

        return verifyPin(pin, profile.pin_hash);
    });

    ipcMain.handle('auth:set-pin', (_, profileId: string, pin: string) => {
        const db = getDatabase();
        const pinHash = hashPin(pin);
        const now = new Date().toISOString();

        db.prepare(`
      UPDATE profiles SET pin_hash = ?, updated_at = ? WHERE id = ?
    `).run(pinHash, now, profileId);
    });

    ipcMain.handle('auth:remove-pin', (_, profileId: string) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        db.prepare(`
      UPDATE profiles SET pin_hash = NULL, updated_at = ? WHERE id = ?
    `).run(now, profileId);
    });
}

function hashPin(pin: string): string {
    const salt = CryptoJS.lib.WordArray.random(16).toString();
    const hash = CryptoJS.PBKDF2(pin, salt, { keySize: 256 / 32, iterations: 10000 }).toString();
    return `${salt}:${hash}`;
}

function verifyPin(pin: string, storedHash: string): boolean {
    const [salt, hash] = storedHash.split(':');
    const testHash = CryptoJS.PBKDF2(pin, salt, { keySize: 256 / 32, iterations: 10000 }).toString();
    return hash === testHash;
}
