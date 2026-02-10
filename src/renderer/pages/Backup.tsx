import { useState } from 'react';
import { useApp } from '../App';
import { Download, Upload, FileText, Users, Package, Database, Check, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Backup() {
    const { profileId } = useApp();
    const { t } = useLanguage();
    const [loading, setLoading] = useState<string | null>(null);
    const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [password, setPassword] = useState('');

    const handleBackup = async () => {
        setLoading('backup');
        setResult(null);
        try {
            const path = await window.electronAPI.createBackup(profileId, password || undefined);
            if (path) {
                setResult({ type: 'success', message: `Backup saved to: ${path}` });
            }
        } catch (error: any) {
            setResult({ type: 'error', message: error.message || 'Failed to create backup' });
        } finally {
            setLoading(null);
        }
    };

    const handleRestore = async () => {
        setLoading('restore');
        setResult(null);
        try {
            const newProfileId = await window.electronAPI.restoreBackup(undefined, password || undefined);
            if (newProfileId) {
                setResult({ type: 'success', message: 'Backup restored successfully! Reload the app to see restored data.' });
            }
        } catch (error: any) {
            setResult({ type: 'error', message: error.message || 'Failed to restore backup' });
        } finally {
            setLoading(null);
        }
    };

    const handleImportClients = async () => {
        setLoading('import-clients');
        setResult(null);
        try {
            const count = await window.electronAPI.importClients(profileId);
            if (count !== null) {
                setResult({ type: 'success', message: `Imported ${count} clients` });
            }
        } catch (error: any) {
            setResult({ type: 'error', message: error.message || 'Failed to import' });
        } finally {
            setLoading(null);
        }
    };

    const handleImportProducts = async () => {
        setLoading('import-products');
        setResult(null);
        try {
            const count = await window.electronAPI.importProducts(profileId);
            if (count !== null) {
                setResult({ type: 'success', message: `Imported ${count} products` });
            }
        } catch (error: any) {
            setResult({ type: 'error', message: error.message || 'Failed to import' });
        } finally {
            setLoading(null);
        }
    };

    const handleExport = async (type: string) => {
        setLoading(`export-${type}`);
        setResult(null);
        try {
            const path = await window.electronAPI.exportCsv(type, profileId);
            if (path) {
                setResult({ type: 'success', message: `Exported to: ${path}` });
            }
        } catch (error: any) {
            setResult({ type: 'error', message: error.message || 'Failed to export' });
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold text-foreground">{t('backup.title')}</h1>
                <p className="text-muted-foreground">{t('backup.subtitle')}</p>
            </div>

            {result && (
                <div className={`flex items-center gap-3 p-4 rounded-lg ${result.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    {result.type === 'success' ? <Check className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    <p className="text-sm">{result.message}</p>
                </div>
            )}

            {/* Backup & Restore */}
            <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Database className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{t('backup.backupRestore')}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    {t('backup.backupDesc')}
                </p>
                <div className="flex items-center gap-4 mb-4">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('backup.encryptionPassword')}
                        className="form-input flex-1"
                    />
                </div>
                <div className="flex gap-3">
                    <button onClick={handleBackup} disabled={loading === 'backup'} className="btn-primary">
                        <Download className="w-4 h-4" />
                        {loading === 'backup' ? t('common.loading') : t('backup.createBackup')}
                    </button>
                    <button onClick={handleRestore} disabled={loading === 'restore'} className="btn-secondary">
                        <Upload className="w-4 h-4" />
                        {loading === 'restore' ? t('common.loading') : t('backup.restoreBackup')}
                    </button>
                </div>
            </div>

            {/* Import */}
            <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Upload className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{t('backup.importData')}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    {t('backup.importDesc')}
                </p>
                <div className="flex gap-3">
                    <button onClick={handleImportClients} disabled={loading === 'import-clients'} className="btn-secondary">
                        <Users className="w-4 h-4" />
                        {loading === 'import-clients' ? t('common.loading') : t('backup.importClients')}
                    </button>
                    <button onClick={handleImportProducts} disabled={loading === 'import-products'} className="btn-secondary">
                        <Package className="w-4 h-4" />
                        {loading === 'import-products' ? t('common.loading') : t('backup.importProducts')}
                    </button>
                </div>
            </div>

            {/* Export */}
            <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Download className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-foreground">{t('backup.exportData')}</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                    {t('backup.exportDesc')}
                </p>
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => handleExport('clients')} disabled={loading?.startsWith('export')} className="btn-secondary">
                        <Users className="w-4 h-4" />
                        {t('clients.title')}
                    </button>
                    <button onClick={() => handleExport('products')} disabled={loading?.startsWith('export')} className="btn-secondary">
                        <Package className="w-4 h-4" />
                        {t('products.title')}
                    </button>
                    <button onClick={() => handleExport('invoices')} disabled={loading?.startsWith('export')} className="btn-secondary">
                        <FileText className="w-4 h-4" />
                        {t('invoices.title')}
                    </button>
                    <button onClick={() => handleExport('payments')} disabled={loading?.startsWith('export')} className="btn-secondary">
                        <Download className="w-4 h-4" />
                        {t('payments.title')}
                    </button>
                    <button onClick={() => handleExport('expenses')} disabled={loading?.startsWith('export')} className="btn-secondary">
                        <Download className="w-4 h-4" />
                        {t('expenses.title')}
                    </button>
                </div>
            </div>

            {/* Database Info */}
            <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center gap-3 mb-2">
                    <Database className="w-5 h-5 text-muted-foreground" />
                    <h3 className="font-semibold text-foreground">{t('backup.databaseLocation')}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                    {t('backup.databaseDesc')} <code className="bg-secondary px-2 py-1 rounded text-xs">%APPDATA%/invoice-manager/data.db</code>
                </p>
            </div>
        </div>
    );
}
