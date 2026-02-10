import { app, BrowserWindow, ipcMain, shell, protocol, net, session } from 'electron';
import * as path from 'path';
import * as url from 'url';
import { initDatabase, closeDatabase } from './database';
import { registerAuthHandlers } from './ipc/auth.ipc';
import { registerSettingsHandlers } from './ipc/settings.ipc';
import { registerClientsHandlers } from './ipc/clients.ipc';
import { registerProductsHandlers } from './ipc/products.ipc';
import { registerInvoicesHandlers } from './ipc/invoices.ipc';
import { registerPaymentsHandlers } from './ipc/payments.ipc';
import { registerExpensesHandlers } from './ipc/expenses.ipc';
import { registerReportsHandlers } from './ipc/reports.ipc';
import { registerBackupHandlers } from './ipc/backup.ipc';
import { registerDashboardHandlers } from './ipc/dashboard.ipc';

let mainWindow: BrowserWindow | null = null;

// Register custom protocol for serving local files
app.whenReady().then(() => {
    protocol.handle('local-file', (request) => {
        const filePath = decodeURIComponent(request.url.replace('local-file://', ''));
        return net.fetch(url.pathToFileURL(filePath).toString());
    });

    // Configure session to allow Firebase Auth requests from file:// protocol
    // This fixes the "auth/network-request-failed" error in built Electron apps
    const defaultSession = session.defaultSession;
    
    // Allow cookies and storage for Firebase domains
    defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        // Allow credentials for Firebase APIs
        const isFirebaseRequest = details.url.includes('googleapis.com') ||
                                  details.url.includes('firebaseapp.com') ||
                                  details.url.includes('firebase.com');
        
        if (isFirebaseRequest) {
            details.requestHeaders['Origin'] = 'https://invoice-af739.firebaseapp.com';
        }
        
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });
    
    // Handle CORS for Firebase requests
    defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const isFirebaseRequest = details.url.includes('googleapis.com') ||
                                  details.url.includes('firebaseapp.com') ||
                                  details.url.includes('firebase.com');
        
        if (isFirebaseRequest && details.responseHeaders) {
            details.responseHeaders['Access-Control-Allow-Origin'] = ['*'];
            details.responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS'];
            details.responseHeaders['Access-Control-Allow-Headers'] = ['*'];
        }
        
        callback({ responseHeaders: details.responseHeaders });
    });
});

function createWindow(): void {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false, // Allow loading local file:// URLs for logos
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, '..', '..', 'resources', 'icon.ico'),
        show: false,
        titleBarStyle: 'default',
        backgroundColor: '#0f172a',
    });

    // Initialize database
    initDatabase();

    // Register all IPC handlers
    registerAuthHandlers();
    registerSettingsHandlers();
    registerClientsHandlers();
    registerProductsHandlers();
    registerInvoicesHandlers();
    registerPaymentsHandlers();
    registerExpensesHandlers();
    registerReportsHandlers();
    registerBackupHandlers();
    registerDashboardHandlers();

    // Load the app
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.whenReady().then(() => {
    // Handle IPC for getting app paths - must be after app is ready
    ipcMain.handle('app:get-path', (_, name: string) => {
        return app.getPath(name as any);
    });

    ipcMain.handle('app:get-db-path', () => {
        return path.join(app.getPath('userData'), 'data.db');
    });

    ipcMain.handle('shell:open-external', (_, url: string) => {
        return shell.openExternal(url);
    });

    ipcMain.handle('shell:open-path', (_, pathArg: string) => {
        return shell.openPath(pathArg);
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    closeDatabase();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    closeDatabase();
});
