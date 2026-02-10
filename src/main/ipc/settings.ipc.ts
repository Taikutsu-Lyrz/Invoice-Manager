import { ipcMain } from 'electron';
import { getDatabase } from '../database';

export function registerSettingsHandlers(): void {
    ipcMain.handle('settings:get', (_, profileId: string) => {
        const db = getDatabase();
        const settings = db.prepare(`
      SELECT data FROM settings WHERE profile_id = ?
    `).get(profileId) as { data: string } | undefined;

        if (!settings) {
            return null;
        }

        return JSON.parse(settings.data);
    });

    ipcMain.handle('settings:update', (_, profileId: string, data: any) => {
        const db = getDatabase();
        const now = new Date().toISOString();

        // Get existing settings and merge
        const existing = db.prepare(`
      SELECT data FROM settings WHERE profile_id = ?
    `).get(profileId) as { data: string } | undefined;

        const existingData = existing ? JSON.parse(existing.data) : {};
        const mergedData = { ...existingData, ...data };

        db.prepare(`
      UPDATE settings SET data = ?, updated_at = ? WHERE profile_id = ?
    `).run(JSON.stringify(mergedData), now, profileId);

        return mergedData;
    });
}
