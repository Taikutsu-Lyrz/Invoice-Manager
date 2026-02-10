import { useState, useEffect } from 'react';
import { useApp } from '../App';
import { useSync } from '../contexts/SyncContext';
import { useToast } from '../components/Toast';
import { useLanguage } from '../contexts/LanguageContext';
import { syncService } from '../services/syncService';
import {
    AlertTriangle,
    CheckCircle,
    XCircle,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Clock,
    ArrowLeftRight,
    Database,
    Cloud,
    Trash2
} from 'lucide-react';

interface Conflict {
    id: string;
    entityType: 'clients' | 'products' | 'invoices' | 'payments' | 'expenses';
    entityId: string;
    localData: any;
    remoteData: any;
    localUpdatedAt: string;
    remoteUpdatedAt: string;
    status: 'pending' | 'resolved';
    resolvedAt?: string;
    resolution?: 'local' | 'remote' | 'merged';
}

export default function Conflicts() {
    const { profileId } = useApp();
    const { syncAll, isSyncing } = useSync();
    const { showToast } = useToast();
    const { t } = useLanguage();

    const [conflicts, setConflicts] = useState<Conflict[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [resolvedConflicts, setResolvedConflicts] = useState<Conflict[]>([]);

    useEffect(() => {
        if (profileId) {
            checkForConflicts();
        }
    }, [profileId]);

    const checkForConflicts = async () => {
        if (!profileId) return;
        setLoading(true);

        const foundConflicts: Conflict[] = [];

        try {
            // Check each entity type for conflicts
            const entityTypes: Array<'clients' | 'products' | 'invoices' | 'payments' | 'expenses'> = [
                'clients', 'products', 'invoices', 'payments', 'expenses'
            ];

            for (const entityType of entityTypes) {
                // Get local data
                let localData: any[] = [];
                switch (entityType) {
                    case 'clients':
                        localData = await window.electronAPI.listClients(profileId);
                        break;
                    case 'products':
                        localData = await window.electronAPI.listProducts(profileId);
                        break;
                    case 'invoices':
                        localData = await window.electronAPI.listInvoices(profileId);
                        break;
                    case 'payments':
                        localData = await window.electronAPI.listPayments(profileId);
                        break;
                    case 'expenses':
                        localData = await window.electronAPI.listExpenses(profileId);
                        break;
                }

                // Get remote data
                const remoteData = await syncService.pullEntities(entityType);

                // Create lookup maps
                const localMap = new Map(localData?.map(item => [item.id, item]) || []);
                const remoteMap = new Map(remoteData.map(item => [item.id, item]));

                // Check for conflicts (same ID, different updated_at, different data)
                for (const [id, local] of localMap) {
                    const remote = remoteMap.get(id);
                    if (remote) {
                        const localUpdated = local.updated_at || local.created_at;
                        const remoteUpdated = remote.updated_at || remote.syncedAt;

                        // Compare key fields to detect actual differences
                        const hasDataDifference = JSON.stringify(excludeSyncFields(local)) !==
                            JSON.stringify(excludeSyncFields(remote));

                        if (hasDataDifference && localUpdated && remoteUpdated) {
                            foundConflicts.push({
                                id: `${entityType}-${id}`,
                                entityType,
                                entityId: id,
                                localData: local,
                                remoteData: remote,
                                localUpdatedAt: localUpdated,
                                remoteUpdatedAt: typeof remoteUpdated === 'object' ?
                                    remoteUpdated.toDate?.()?.toISOString() : remoteUpdated,
                                status: 'pending'
                            });
                        }
                    }
                }
            }

            setConflicts(foundConflicts);
        } catch (error: any) {
            console.error('Failed to check conflicts:', error);
            showToast('Failed to check for conflicts', 'error');
        } finally {
            setLoading(false);
        }
    };

    const excludeSyncFields = (data: any) => {
        const { syncedAt, tenantId, ...rest } = data;
        return rest;
    };

    const resolveConflict = async (conflict: Conflict, resolution: 'local' | 'remote') => {
        try {
            if (resolution === 'local') {
                // Push local data to Firebase (overwrite remote)
                await syncService.pushEntity(conflict.entityType, conflict.localData);
                showToast('Kept local version', 'success');
            } else {
                // Pull remote data to local (would need IPC handler to update local DB)
                // For now, just mark as resolved - full bidirectional sync would update local
                showToast('Kept remote version (will apply on next pull)', 'success');
            }

            // Mark conflict as resolved
            const resolvedConflict: Conflict = {
                ...conflict,
                status: 'resolved',
                resolvedAt: new Date().toISOString(),
                resolution
            };

            setConflicts(prev => prev.filter(c => c.id !== conflict.id));
            setResolvedConflicts(prev => [resolvedConflict, ...prev]);
        } catch (error: any) {
            showToast(`Failed to resolve conflict: ${error.message}`, 'error');
        }
    };

    const getEntityName = (conflict: Conflict): string => {
        const data = conflict.localData;
        return data.name || data.invoice_number || data.description || data.id;
    };

    const formatDate = (dateStr: string): string => {
        try {
            return new Date(dateStr).toLocaleString();
        } catch {
            return dateStr;
        }
    };

    const pendingCount = conflicts.filter(c => c.status === 'pending').length;

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('conflicts.title')}</h1>
                    <p className="text-muted-foreground">
                        {t('conflicts.subtitle')}
                    </p>
                </div>
                <button
                    onClick={checkForConflicts}
                    disabled={loading}
                    className="btn-secondary"
                >
                    {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4" />
                    )}
                    {t('conflicts.checkConflicts')}
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{pendingCount}</p>
                            <p className="text-sm text-muted-foreground">{t('conflicts.pending')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{resolvedConflicts.length}</p>
                            <p className="text-sm text-muted-foreground">{t('conflicts.resolvedToday')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <ArrowLeftRight className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">
                                {new Set(conflicts.map(c => c.entityType)).size}
                            </p>
                            <p className="text-sm text-muted-foreground">{t('conflicts.entityTypes')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Conflicts List */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border">
                    <h3 className="font-semibold">{t('conflicts.pending')}</h3>
                </div>

                {loading ? (
                    <div className="p-8 text-center">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                        <p className="text-muted-foreground">{t('conflicts.checking') || 'Checking for conflicts...'}</p>
                    </div>
                ) : conflicts.length === 0 ? (
                    <div className="p-8 text-center">
                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <h3 className="font-semibold mb-1">{t('conflicts.noConflicts')}</h3>
                        <p className="text-muted-foreground">
                            {t('conflicts.inSync')}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {conflicts.map((conflict) => (
                            <div key={conflict.id} className="p-4">
                                {/* Conflict Header */}
                                <div
                                    className="flex items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedId(expandedId === conflict.id ? null : conflict.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedId === conflict.id ? (
                                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                        )}
                                        <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                                            <AlertTriangle className="w-5 h-5 text-yellow-500" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{getEntityName(conflict)}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {conflict.entityType} • ID: {conflict.entityId.substring(0, 8)}...
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); resolveConflict(conflict, 'local'); }}
                                            className="btn-secondary text-sm py-1 px-3"
                                        >
                                            <Database className="w-4 h-4" />
                                            {t('conflicts.keepLocal') || 'Keep Local'}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); resolveConflict(conflict, 'remote'); }}
                                            className="btn-secondary text-sm py-1 px-3"
                                        >
                                            <Cloud className="w-4 h-4" />
                                            {t('conflicts.keepRemote') || 'Keep Remote'}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Diff View */}
                                {expandedId === conflict.id && (
                                    <div className="mt-4 grid grid-cols-2 gap-4">
                                        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Database className="w-4 h-4 text-blue-500" />
                                                <span className="font-medium text-blue-500">{t('conflicts.localVersion') || 'Local Version'}</span>
                                                <span className="text-xs text-muted-foreground ml-auto">
                                                    {formatDate(conflict.localUpdatedAt)}
                                                </span>
                                            </div>
                                            <pre className="text-xs bg-secondary/50 rounded p-3 overflow-auto max-h-60">
                                                {JSON.stringify(excludeSyncFields(conflict.localData), null, 2)}
                                            </pre>
                                        </div>
                                        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Cloud className="w-4 h-4 text-purple-500" />
                                                <span className="font-medium text-purple-500">{t('conflicts.remoteVersion') || 'Remote Version'}</span>
                                                <span className="text-xs text-muted-foreground ml-auto">
                                                    {formatDate(conflict.remoteUpdatedAt)}
                                                </span>
                                            </div>
                                            <pre className="text-xs bg-secondary/50 rounded p-3 overflow-auto max-h-60">
                                                {JSON.stringify(excludeSyncFields(conflict.remoteData), null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Resolved Conflicts History */}
            {resolvedConflicts.length > 0 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="p-4 border-b border-border">
                        <h3 className="font-semibold">{t('conflicts.recentlyResolved') || 'Recently Resolved'}</h3>
                    </div>
                    <div className="divide-y divide-border">
                        {resolvedConflicts.map((conflict) => (
                            <div key={conflict.id} className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                    <div>
                                        <p className="font-medium">{getEntityName(conflict)}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {conflict.entityType} • Resolved with {conflict.resolution} version
                                        </p>
                                    </div>
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {conflict.resolvedAt && formatDate(conflict.resolvedAt)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
