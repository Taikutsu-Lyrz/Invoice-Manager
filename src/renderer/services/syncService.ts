import {
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    onSnapshot,
    serverTimestamp,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';

// Types for sync metadata
interface SyncRecord {
    id: string;
    localUpdatedAt: string;
    remoteUpdatedAt?: Timestamp;
    syncStatus: 'pending' | 'synced' | 'conflict';
    entityType: 'client' | 'product' | 'invoice' | 'payment' | 'expense';
}

interface SyncResult {
    pushed: number;
    pulled: number;
    conflicts: number;
    errors: string[];
}

// Entity types that can be synced
type SyncableEntity = 'clients' | 'products' | 'invoices' | 'payments' | 'expenses';

class SyncService {
    private tenantId: string | null = null;
    private profileId: string | null = null;
    private unsubscribers: (() => void)[] = [];
    private isSyncing = false;
    private lastSyncTime: Date | null = null;

    // Set the tenant ID for sync operations
    setTenantId(tenantId: string | null) {
        this.tenantId = tenantId;
    }

    getTenantId() {
        return this.tenantId;
    }

    // Set the profile ID for database operations
    setProfileId(profileId: string | null) {
        this.profileId = profileId;
    }

    getProfileId() {
        return this.profileId;
    }

    // Get Firestore collection path for an entity type
    private getCollectionPath(entityType: SyncableEntity): string {
        if (!this.tenantId) throw new Error('Tenant ID not set');
        return `tenants/${this.tenantId}/${entityType}`;
    }

    // Push a single entity to Firestore
    async pushEntity(entityType: SyncableEntity, entity: any): Promise<void> {
        if (!this.tenantId) throw new Error('Tenant ID not set');

        const collectionPath = this.getCollectionPath(entityType);
        const docRef = doc(db, collectionPath, entity.id);

        await setDoc(docRef, {
            ...entity,
            syncedAt: serverTimestamp(),
            tenantId: this.tenantId
        }, { merge: true });
    }

    // Push multiple entities to Firestore
    async pushEntities(entityType: SyncableEntity, entities: any[]): Promise<number> {
        if (!this.tenantId) throw new Error('Tenant ID not set');
        if (entities.length === 0) return 0;

        const collectionPath = this.getCollectionPath(entityType);
        const batch = writeBatch(db);

        // Firestore batches are limited to 500 operations
        const batchSize = 500;
        let pushed = 0;

        for (let i = 0; i < entities.length; i += batchSize) {
            const currentBatch = writeBatch(db);
            const batchEntities = entities.slice(i, i + batchSize);

            for (const entity of batchEntities) {
                const docRef = doc(db, collectionPath, entity.id);
                currentBatch.set(docRef, {
                    ...entity,
                    syncedAt: serverTimestamp(),
                    tenantId: this.tenantId
                }, { merge: true });
            }

            await currentBatch.commit();
            pushed += batchEntities.length;
        }

        return pushed;
    }

    // Pull all entities of a type from Firestore
    async pullEntities(entityType: SyncableEntity): Promise<any[]> {
        if (!this.tenantId) throw new Error('Tenant ID not set');

        const collectionPath = this.getCollectionPath(entityType);
        const q = query(collection(db, collectionPath));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
        }));
    }

    // Delete an entity from Firestore
    async deleteEntity(entityType: SyncableEntity, entityId: string): Promise<void> {
        if (!this.tenantId) throw new Error('Tenant ID not set');

        const collectionPath = this.getCollectionPath(entityType);
        const docRef = doc(db, collectionPath, entityId);
        await deleteDoc(docRef);
    }

    // Sync entities AND delete orphans from Firebase
    async syncWithDeletions(entityType: SyncableEntity, localEntities: any[]): Promise<{ pushed: number; deleted: number }> {
        if (!this.tenantId) throw new Error('Tenant ID not set');

        let pushed = 0;
        let deleted = 0;

        // Get local IDs
        const localIds = new Set(localEntities.map(e => e.id));

        // Get all remote IDs
        const remoteEntities = await this.pullEntities(entityType);
        const remoteIds = remoteEntities.map(e => e.id);

        // Delete from Firebase anything that's not in local
        for (const remoteId of remoteIds) {
            if (!localIds.has(remoteId)) {
                await this.deleteEntity(entityType, remoteId);
                deleted++;
            }
        }

        // Push local entities to Firebase
        if (localEntities.length > 0) {
            pushed = await this.pushEntities(entityType, localEntities);
        }

        return { pushed, deleted };
    }

    // Subscribe to real-time updates for an entity type
    subscribeToChanges(
        entityType: SyncableEntity,
        onAdd: (data: any) => void,
        onModify: (data: any) => void,
        onDelete: (id: string) => void
    ): () => void {
        if (!this.tenantId) throw new Error('Tenant ID not set');

        const collectionPath = this.getCollectionPath(entityType);
        const q = query(collection(db, collectionPath));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                const data = { ...change.doc.data(), id: change.doc.id };

                if (change.type === 'added') {
                    onAdd(data);
                } else if (change.type === 'modified') {
                    onModify(data);
                } else if (change.type === 'removed') {
                    onDelete(change.doc.id);
                }
            });
        });

        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    // Unsubscribe from all real-time listeners
    unsubscribeAll(): void {
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];
    }

    // Reset all state - call this on logout
    reset(): void {
        this.unsubscribeAll();
        this.tenantId = null;
        this.profileId = null;
        this.isSyncing = false;
        this.lastSyncTime = null;
    }

    // Check if an entity has a conflict
    async checkConflict(entityType: SyncableEntity, localEntity: any): Promise<boolean> {
        if (!this.tenantId) throw new Error('Tenant ID not set');

        const collectionPath = this.getCollectionPath(entityType);
        const docRef = doc(db, collectionPath, localEntity.id);
        const remoteDoc = await getDoc(docRef);

        if (!remoteDoc.exists()) return false;

        const remoteData = remoteDoc.data();
        const remoteUpdated = remoteData.updated_at || remoteData.created_at;
        const localUpdated = localEntity.updated_at || localEntity.created_at;

        // Conflict if remote was updated after our last known sync
        if (remoteUpdated && localUpdated) {
            return new Date(remoteUpdated) > new Date(localUpdated);
        }

        return false;
    }

    // Get sync status
    getSyncStatus(): { isSyncing: boolean; lastSyncTime: Date | null } {
        return {
            isSyncing: this.isSyncing,
            lastSyncTime: this.lastSyncTime
        };
    }

    // Set syncing state
    setSyncing(syncing: boolean): void {
        this.isSyncing = syncing;
        if (!syncing) {
            this.lastSyncTime = new Date();
        }
    }
}

// Export singleton instance
export const syncService = new SyncService();

// Export types
export type { SyncRecord, SyncResult, SyncableEntity };
