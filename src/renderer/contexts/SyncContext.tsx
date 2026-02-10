import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { syncService, SyncableEntity } from '../services/syncService';
import { useToast } from '../components/Toast';

// Auto-sync interval: 30 minutes
const AUTO_SYNC_INTERVAL = 30 * 60 * 1000;

interface SyncStats {
    clients: number;
    products: number;
    invoices: number;
    payments: number;
    expenses: number;
}

interface SyncContextType {
    isSyncing: boolean;
    lastSyncTime: Date | null;
    syncStatus: 'idle' | 'syncing' | 'error' | 'success';
    pendingChanges: number;
    hasUnsyncedChanges: boolean;
    autoSyncEnabled: boolean;
    lastSyncStats: SyncStats | null;
    syncAll: (profileId: string, silent?: boolean) => Promise<void>;
    syncEntity: (entityType: SyncableEntity, entities: any[]) => Promise<void>;
    pullEntity: (entityType: SyncableEntity) => Promise<any[]>;
    markPendingChange: () => void;
    setAutoSyncEnabled: (enabled: boolean) => void;
    checkUnsyncedBeforeClose: () => boolean;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function useSync() {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error('useSync must be used within a SyncProvider');
    }
    return context;
}

interface SyncProviderProps {
    children: ReactNode;
}

export function SyncProvider({ children }: SyncProviderProps) {
    const { userProfile } = useAuth();
    const { showToast } = useToast();
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
    const [pendingChanges, setPendingChanges] = useState(0);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
    const [lastSyncStats, setLastSyncStats] = useState<SyncStats | null>(null);
    const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize sync service with tenant ID when user logs in
    useEffect(() => {
        if (userProfile?.tenantId) {
            syncService.setTenantId(userProfile.tenantId);
        } else {
            // User logged out - cleanup sync state
            syncService.reset();
            setLastSyncTime(null);
            setLastSyncStats(null);
            setPendingChanges(0);
            setSyncStatus('idle');
            
            // Clear auto-sync interval
            if (autoSyncIntervalRef.current) {
                clearInterval(autoSyncIntervalRef.current);
                autoSyncIntervalRef.current = null;
            }
        }
    }, [userProfile?.tenantId]);

    // Sync all entities - fetches from SQLite and pushes to Firebase
    const syncAll = useCallback(async (profileId: string, silent: boolean = false) => {
        if (!userProfile?.tenantId) {
            if (!silent) showToast('Please log in to sync data', 'error');
            return;
        }

        if (!profileId) {
            if (!silent) showToast('No profile selected', 'error');
            return;
        }

        if (isSyncing) return; // Prevent concurrent syncs

        // Store profileId for auto-sync
        syncService.setProfileId(profileId);

        setIsSyncing(true);
        setSyncStatus('syncing');
        syncService.setSyncing(true);

        const stats: SyncStats = {
            clients: 0,
            products: 0,
            invoices: 0,
            payments: 0,
            expenses: 0
        };

        try {
            // Fetch all data from local SQLite database (both active AND deleted)
            const [clients, products, invoices, payments, expenses] = await Promise.all([
                window.electronAPI.listClients(profileId),
                window.electronAPI.listProducts(profileId),
                window.electronAPI.listInvoices(profileId),
                window.electronAPI.listPayments(profileId),
                window.electronAPI.listExpenses(profileId)
            ]);

            // Also fetch soft-deleted items to ensure they're backed up to Firebase
            const [deletedClients, deletedProducts, deletedInvoices, deletedPayments, deletedExpenses] = await Promise.all([
                window.electronAPI.listDeletedClients?.(profileId) || [],
                window.electronAPI.listDeletedProducts?.(profileId) || [],
                window.electronAPI.listDeletedInvoices?.(profileId) || [],
                window.electronAPI.listDeletedPayments?.(profileId) || [],
                window.electronAPI.listDeletedExpenses?.(profileId) || []
            ]);

            // Combine active and deleted items for sync (all go to Firebase)
            const allClients = [...(clients || []), ...(deletedClients || [])];
            const allProducts = [...(products || []), ...(deletedProducts || [])];
            const allInvoices = [...(invoices || []), ...(deletedInvoices || [])];
            const allPayments = [...(payments || []), ...(deletedPayments || [])];
            const allExpenses = [...(expenses || []), ...(deletedExpenses || [])];

            let totalDeleted = 0;

            // Sync with deletions - pushes all local data (including soft-deleted) and removes orphans from Firebase
            const clientResult = await syncService.syncWithDeletions('clients', allClients);
            stats.clients = clientResult.pushed;
            totalDeleted += clientResult.deleted;

            const productResult = await syncService.syncWithDeletions('products', allProducts);
            stats.products = productResult.pushed;
            totalDeleted += productResult.deleted;

            const invoiceResult = await syncService.syncWithDeletions('invoices', allInvoices);
            stats.invoices = invoiceResult.pushed;
            totalDeleted += invoiceResult.deleted;

            const paymentResult = await syncService.syncWithDeletions('payments', allPayments);
            stats.payments = paymentResult.pushed;
            totalDeleted += paymentResult.deleted;

            const expenseResult = await syncService.syncWithDeletions('expenses', allExpenses);
            stats.expenses = expenseResult.pushed;
            totalDeleted += expenseResult.deleted;

            setSyncStatus('success');
            setLastSyncTime(new Date());
            setLastSyncStats(stats);
            setPendingChanges(0); // Clear pending changes on successful sync

            const totalSynced = stats.clients + stats.products + stats.invoices + stats.payments + stats.expenses;
            if (!silent) {
                const deleteMsg = totalDeleted > 0 ? `, deleted ${totalDeleted}` : '';
                showToast(`Synced ${totalSynced} items${deleteMsg}!`, 'success');
            }
        } catch (error: any) {
            setSyncStatus('error');
            console.error('Sync failed:', error);
            if (!silent) {
                showToast(`Sync failed: ${error.message}`, 'error');
            }
        } finally {
            setIsSyncing(false);
            syncService.setSyncing(false);
        }
    }, [userProfile?.tenantId, showToast, isSyncing]);

    // Sync a specific entity type
    const syncEntity = useCallback(async (entityType: SyncableEntity, entities: any[]) => {
        if (!userProfile?.tenantId) return;

        try {
            await syncService.pushEntities(entityType, entities);
            setPendingChanges(prev => Math.max(0, prev - entities.length));
        } catch (error: any) {
            console.error(`Failed to sync ${entityType}:`, error);
            throw error;
        }
    }, [userProfile?.tenantId]);

    // Pull entities from Firestore
    const pullEntity = useCallback(async (entityType: SyncableEntity): Promise<any[]> => {
        if (!userProfile?.tenantId) return [];

        try {
            return await syncService.pullEntities(entityType);
        } catch (error: any) {
            console.error(`Failed to pull ${entityType}:`, error);
            throw error;
        }
    }, [userProfile?.tenantId]);

    // Mark a pending change (called when data is modified)
    const markPendingChange = useCallback(() => {
        setPendingChanges(prev => prev + 1);
    }, []);

    // Check if there are unsynced changes (for close reminder)
    const checkUnsyncedBeforeClose = useCallback((): boolean => {
        return pendingChanges > 0;
    }, [pendingChanges]);

    // Auto-sync every 30 minutes (silent)
    useEffect(() => {
        if (autoSyncEnabled && userProfile?.tenantId) {
            const profileId = syncService.getProfileId();

            if (profileId) {
                // Set up recurring sync
                autoSyncIntervalRef.current = setInterval(() => {
                    const currentProfileId = syncService.getProfileId();
                    if (currentProfileId) {
                        syncAll(currentProfileId, true); // Silent sync
                    }
                }, AUTO_SYNC_INTERVAL);
            }

            return () => {
                if (autoSyncIntervalRef.current) {
                    clearInterval(autoSyncIntervalRef.current);
                }
            };
        }
    }, [autoSyncEnabled, userProfile?.tenantId, syncAll]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            syncService.unsubscribeAll();
            if (autoSyncIntervalRef.current) {
                clearInterval(autoSyncIntervalRef.current);
            }
        };
    }, []);

    // Handle beforeunload to warn about unsynced changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (pendingChanges > 0) {
                e.preventDefault();
                e.returnValue = 'You have unsynced changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [pendingChanges]);

    const hasUnsyncedChanges = pendingChanges > 0;

    const value: SyncContextType = {
        isSyncing,
        lastSyncTime,
        syncStatus,
        pendingChanges,
        hasUnsyncedChanges,
        autoSyncEnabled,
        lastSyncStats,
        syncAll,
        syncEntity,
        pullEntity,
        markPendingChange,
        setAutoSyncEnabled,
        checkUnsyncedBeforeClose
    };

    return (
        <SyncContext.Provider value={value}>
            {children}
        </SyncContext.Provider>
    );
}
