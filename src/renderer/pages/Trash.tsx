import { useState, useEffect } from 'react';
import { useApp } from '../App';
import { useToast } from '../components/Toast';
import { useLanguage } from '../contexts/LanguageContext';
import { syncService } from '../services/syncService';
import { Trash2, RotateCcw, AlertTriangle, FileText, Users, Package, CreditCard, Receipt } from 'lucide-react';

type EntityType = 'clients' | 'products' | 'invoices' | 'payments' | 'expenses';

interface TrashItem {
    id: string;
    name: string;
    description?: string;
    deletedAt: string;
    type: EntityType;
}

export default function Trash() {
    const { profileId } = useApp();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<EntityType>('invoices');
    const [items, setItems] = useState<TrashItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const tabs: { id: EntityType; label: string; icon: React.ReactNode }[] = [
        { id: 'invoices', label: t('invoices.title'), icon: <FileText className="w-4 h-4" /> },
        { id: 'clients', label: t('clients.title'), icon: <Users className="w-4 h-4" /> },
        { id: 'products', label: t('products.title'), icon: <Package className="w-4 h-4" /> },
        { id: 'payments', label: t('payments.title'), icon: <CreditCard className="w-4 h-4" /> },
        { id: 'expenses', label: t('expenses.title'), icon: <Receipt className="w-4 h-4" /> },
    ];

    useEffect(() => {
        loadDeletedItems();
    }, [profileId, activeTab]);

    const loadDeletedItems = async () => {
        setLoading(true);
        try {
            let data: any[] = [];

            // Check if API methods exist (need app restart after update)
            if (!window.electronAPI.listDeletedClients) {
                console.warn('Trash API not available - please restart the app');
                setItems([]);
                setLoading(false);
                return;
            }

            switch (activeTab) {
                case 'clients':
                    data = await window.electronAPI.listDeletedClients(profileId);
                    break;
                case 'products':
                    data = await window.electronAPI.listDeletedProducts(profileId);
                    break;
                case 'invoices':
                    data = await window.electronAPI.listDeletedInvoices(profileId);
                    break;
                case 'payments':
                    data = await window.electronAPI.listDeletedPayments(profileId);
                    break;
                case 'expenses':
                    data = await window.electronAPI.listDeletedExpenses(profileId);
                    break;
            }

            // Map to common format
            const mapped = (data || []).map((item: any) => ({
                id: item.id,
                name: getItemName(item, activeTab),
                description: getItemDescription(item, activeTab),
                deletedAt: item.deletedAt,
                type: activeTab,
            }));

            setItems(mapped);
        } catch (error: any) {
            console.error('Failed to load deleted items:', error);
            // Don't show error toast if it's just that there are no deleted items
            if (error.message && !error.message.includes('no such column')) {
                showToast(error.message || 'Failed to load trash', 'error');
            }
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    const getItemName = (item: any, type: EntityType): string => {
        switch (type) {
            case 'clients':
            case 'products':
                return item.name;
            case 'invoices':
                return `Invoice #${item.invoiceNumber}`;
            case 'payments':
                return `Payment of ${item.amount}`;
            case 'expenses':
                return item.description || 'Expense';
            default:
                return 'Item';
        }
    };

    const getItemDescription = (item: any, type: EntityType): string => {
        switch (type) {
            case 'clients':
                return item.email || item.phone || '';
            case 'products':
                return item.sku || '';
            case 'invoices':
                return item.client?.name || '';
            case 'payments':
                return item.invoiceNumber || '';
            case 'expenses':
                return item.vendor || '';
            default:
                return '';
        }
    };

    const handleRestore = async (id: string) => {
        try {
            switch (activeTab) {
                case 'clients':
                    await window.electronAPI.restoreClient(id);
                    break;
                case 'products':
                    await window.electronAPI.restoreProduct(id);
                    break;
                case 'invoices':
                    await window.electronAPI.restoreInvoice(id);
                    break;
                case 'payments':
                    await window.electronAPI.restorePayment(id);
                    break;
                case 'expenses':
                    await window.electronAPI.restoreExpense(id);
                    break;
            }
            showToast('Item restored successfully', 'success');
            loadDeletedItems();
        } catch (error: any) {
            showToast(error.message || 'Failed to restore item', 'error');
        }
    };

    const handlePermanentDelete = async (id: string) => {
        try {
            // Delete from local database
            switch (activeTab) {
                case 'clients':
                    await window.electronAPI.permanentDeleteClient(id);
                    break;
                case 'products':
                    await window.electronAPI.permanentDeleteProduct(id);
                    break;
                case 'invoices':
                    await window.electronAPI.permanentDeleteInvoice(id);
                    break;
                case 'payments':
                    await window.electronAPI.permanentDeletePayment(id);
                    break;
                case 'expenses':
                    await window.electronAPI.permanentDeleteExpense(id);
                    break;
            }

            // Also delete from Firebase (if sync is configured)
            try {
                await syncService.deleteEntity(activeTab, id);
            } catch (firebaseError) {
                // Firebase deletion is optional - ignore if not configured
                console.warn('Could not delete from Firebase:', firebaseError);
            }

            showToast('Item permanently deleted', 'success');
            setConfirmDelete(null);
            loadDeletedItems();
        } catch (error: any) {
            showToast(error.message || 'Failed to delete item', 'error');
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return 'Unknown';
        return new Date(dateStr).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Trash2 className="w-6 h-6" />
                    {t('trash.title') || 'Trash'}
                </h1>
                <p className="text-muted-foreground">
                    {t('trash.subtitle') || 'Deleted items can be restored or permanently deleted'}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-border pb-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${activeTab === tab.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-16">
                    <Trash2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                        {t('trash.empty') || 'Trash is empty'}
                    </h3>
                    <p className="text-muted-foreground">
                        {t('trash.emptyDesc') || 'No deleted items in this category'}
                    </p>
                </div>
            ) : (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('table.name') || 'Name'}</th>
                                <th>{t('trash.deletedAt') || 'Deleted'}</th>
                                <th className="w-40">{t('table.actions') || 'Actions'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id}>
                                    <td>
                                        <div>
                                            <p className="font-medium text-foreground">{item.name}</p>
                                            {item.description && (
                                                <p className="text-sm text-muted-foreground">{item.description}</p>
                                            )}
                                        </div>
                                    </td>
                                    <td className="text-muted-foreground">
                                        {formatDate(item.deletedAt)}
                                    </td>
                                    <td>
                                        {confirmDelete === item.id ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handlePermanentDelete(item.id)}
                                                    className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                                                >
                                                    {t('common.confirm') || 'Confirm'}
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(null)}
                                                    className="text-xs px-2 py-1 bg-secondary rounded hover:bg-secondary/80"
                                                >
                                                    {t('common.cancel') || 'Cancel'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleRestore(item.id)}
                                                    className="btn-icon text-green-500 hover:bg-green-500/10"
                                                    title="Restore"
                                                >
                                                    <RotateCcw className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDelete(item.id)}
                                                    className="btn-icon text-red-500 hover:bg-red-500/10"
                                                    title="Permanently delete"
                                                >
                                                    <AlertTriangle className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Info */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                    <p className="text-sm text-amber-500 font-medium">
                        {t('trash.warning') || 'Warning'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {t('trash.warningDesc') || 'Permanently deleted items cannot be recovered. Restored items will be returned to their original location.'}
                    </p>
                </div>
            </div>
        </div>
    );
}
