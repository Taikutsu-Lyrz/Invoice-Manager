import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { useForm } from 'react-hook-form';
import { Save, Plus, Trash, Sun, Moon, Monitor, Globe, Cloud, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useSync } from '../contexts/SyncContext';
import { useToast } from '../components/Toast';

export default function Settings() {
    const { profileId, settings, refreshSettings } = useApp();
    const { theme, setTheme } = useTheme();
    const { language, setLanguage, t } = useLanguage();
    const { showToast } = useToast();
    const { isSyncing, lastSyncTime, syncStatus, hasUnsyncedChanges, autoSyncEnabled, syncAll, setAutoSyncEnabled } = useSync();

    const [saving, setSaving] = useState(false);
    const [taxRates, setTaxRates] = useState<any[]>([]);
    const [newTaxName, setNewTaxName] = useState('');
    const [newTaxRate, setNewTaxRate] = useState(0);

    const { register, handleSubmit, reset } = useForm();

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingData, setPendingData] = useState<any>(null);

    useEffect(() => {
        if (settings) {
            reset({
                companyName: settings.companyName,
                companyAddress: settings.companyAddress,
                companyEmail: settings.companyEmail,
                companyPhone: settings.companyPhone,
                taxId: settings.taxId || '',
                invoicePrefix: settings.invoicePrefix,
                invoiceNextNumber: settings.invoiceNextNumber,
                currency: settings.currency,
                currencySymbol: settings.currencySymbol,
                defaultTerms: settings.defaultTerms || '',
                defaultNotes: settings.defaultNotes || '',
                footerText: settings.footerText || '',
                autoLockMinutes: settings.autoLockMinutes,
                pdfTemplate: settings.pdfTemplate,
                paperSize: settings.paperSize,
            });
            setTaxRates(settings.taxRates || []);
        }
    }, [settings, reset]);

    const handleFormSubmit = (data: any) => {
        setPendingData(data);
        setConfirmOpen(true);
    };

    const confirmSave = async () => {
        if (!pendingData) return;
        setConfirmOpen(false);
        setSaving(true);
        try {
            await window.electronAPI.updateSettings(profileId, {
                ...pendingData,
                taxRates,
            });
            await refreshSettings();
            showToast(t('settings.saveSuccess'), 'success');
        } catch (error: any) {
            console.error('Failed to save:', error);
            showToast(error.message || 'Failed to save settings', 'error');
        } finally {
            setSaving(false);
            setPendingData(null);
        }
    };

    const addTaxRate = () => {
        if (!newTaxName.trim()) return;
        setTaxRates([...taxRates, { id: uuidv4(), name: newTaxName, rate: newTaxRate, isDefault: false }]);
        setNewTaxName('');
        setNewTaxRate(0);
    };

    const removeTaxRate = (id: string) => {
        setTaxRates(taxRates.filter(t => t.id !== id));
    };

    const setDefaultTax = (id: string) => {
        setTaxRates(taxRates.map(t => ({ ...t, isDefault: t.id === id })));
    };

    return (
        <div className="space-y-6 animate-fadeIn max-w-3xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>
                    <p className="text-muted-foreground">{t('settings.subtitle')}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                {/* Company Info */}
                <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold text-foreground mb-4">{t('settings.companyInfo')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group col-span-2">
                            <label className="form-label">{t('settings.companyName')}</label>
                            <input {...register('companyName')} className="form-input" />
                        </div>

                        {/* Company Logo */}
                        <div className="form-group col-span-2">
                            <label className="form-label">{t('settings.companyLogo')}</label>
                            <div className="flex items-center gap-4">
                                <div className="w-24 h-24 border-2 border-dashed border-border rounded-lg flex items-center justify-center bg-secondary/30 overflow-hidden">
                                    {settings?.companyLogo ? (
                                        <img src={settings.companyLogo} alt="Logo" className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="text-xs text-muted-foreground text-center px-2">{t('settings.noLogo')}</span>
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const result = await window.electronAPI.showOpenDialog({
                                                properties: ['openFile'],
                                                filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif'] }]
                                            });
                                            if (!result.canceled && result.filePaths[0]) {
                                                // Store the file path directly
                                                await window.electronAPI.updateSettings(profileId, {
                                                    ...settings,
                                                    companyLogo: result.filePaths[0]
                                                });
                                                await refreshSettings();
                                            }
                                        }}
                                        className="btn-secondary text-sm"
                                    >
                                        {t('settings.chooseLogo')}
                                    </button>
                                    {settings?.companyLogo && (
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                await window.electronAPI.updateSettings(profileId, {
                                                    ...settings,
                                                    companyLogo: null
                                                });
                                                await refreshSettings();
                                            }}
                                            className="text-sm text-red-500 hover:underline"
                                        >
                                            Remove Logo
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="form-group col-span-2">
                            <label className="form-label">{t('settings.companyAddress')}</label>
                            <textarea {...register('companyAddress')} className="form-input h-20 resize-none" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('settings.companyEmail')}</label>
                            <input {...register('companyEmail')} type="email" className="form-input" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('settings.companyPhone')}</label>
                            <input {...register('companyPhone')} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('settings.taxId')}</label>
                            <input {...register('taxId')} className="form-input" placeholder={t('settings.taxIdHint')} />
                        </div>
                    </div>
                </div>

                {/* Invoice Settings */}
                <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold text-foreground mb-4">{t('settings.invoiceSettings')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-group">
                            <label className="form-label">{t('settings.invoicePrefix')}</label>
                            <input {...register('invoicePrefix')} className="form-input" placeholder="INV" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('settings.nextNumber')}</label>
                            <input type="number" {...register('invoiceNextNumber', { valueAsNumber: true })} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('settings.currency')}</label>
                            <input {...register('currency')} className="form-input" placeholder="USD" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('settings.currencySymbol')}</label>
                            <input {...register('currencySymbol')} className="form-input" placeholder="$" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('settings.pdfTemplate')}</label>
                            <select {...register('pdfTemplate')} className="form-input">
                                <option value="modern">Modern</option>
                                <option value="classic">Classic</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('settings.paperSize')}</label>
                            <select {...register('paperSize')} className="form-input">
                                <option value="a4">A4</option>
                                <option value="letter">Letter</option>
                            </select>
                        </div>
                        <div className="form-group col-span-2">
                            <label className="form-label">{t('settings.defaultTerms')}</label>
                            <textarea {...register('defaultTerms')} className="form-input h-20 resize-none" placeholder={t('settings.termsPlaceholder')} />
                        </div>
                        <div className="form-group col-span-2">
                            <label className="form-label">{t('settings.defaultNotes')}</label>
                            <textarea {...register('defaultNotes')} className="form-input h-16 resize-none" placeholder={t('settings.notesPlaceholder')} />
                        </div>
                        <div className="form-group col-span-2">
                            <label className="form-label">{t('settings.footerText')}</label>
                            <input {...register('footerText')} className="form-input" placeholder={t('settings.footerPlaceholder')} />
                        </div>
                    </div>
                </div>

                {/* Tax Rates */}
                <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold text-foreground mb-4">{t('settings.taxRates')}</h3>
                    <div className="space-y-3">
                        {taxRates.map((tax) => (
                            <div key={tax.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg">
                                <input
                                    type="radio"
                                    name="defaultTax"
                                    checked={tax.isDefault}
                                    onChange={() => setDefaultTax(tax.id)}
                                    className="w-4 h-4"
                                />
                                <span className="flex-1 font-medium">{tax.name}</span>
                                <span className="text-muted-foreground">{tax.rate}%</span>
                                <button type="button" onClick={() => removeTaxRate(tax.id)} className="btn-icon text-red-500">
                                    <Trash className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <div className="flex items-center gap-3 pt-2">
                            <input
                                type="text"
                                value={newTaxName}
                                onChange={(e) => setNewTaxName(e.target.value)}
                                placeholder={t('settings.taxName')}
                                className="form-input flex-1"
                            />
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    value={newTaxRate}
                                    onChange={(e) => setNewTaxRate(parseFloat(e.target.value) || 0)}
                                    placeholder="Rate"
                                    className="form-input w-24"
                                />
                                <span className="text-muted-foreground">%</span>
                            </div>
                            <button type="button" onClick={addTaxRate} className="btn-secondary">
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Security */}
                <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold text-foreground mb-4">{t('settings.security')}</h3>
                    <div className="form-group">
                        <label className="form-label">{t('settings.autoLock')}</label>
                        <input type="number" {...register('autoLockMinutes', { valueAsNumber: true })} className="form-input w-32" />
                        <p className="text-xs text-muted-foreground mt-1">{t('settings.autoLockHint')}</p>
                    </div>
                </div>

                {/* Cloud Sync */}
                <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                        <Cloud className="w-5 h-5 text-primary" />
                        {t('sync.title')}
                    </h3>
                    <div className="space-y-4">
                        {/* Sync Status */}
                        <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                            <div className="flex items-center gap-3">
                                {syncStatus === 'success' ? (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                ) : syncStatus === 'error' ? (
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                ) : (
                                    <Cloud className="w-5 h-5 text-muted-foreground" />
                                )}
                                <div>
                                    <p className="font-medium">
                                        {hasUnsyncedChanges ? t('sync.changesPending') : t('sync.allSynced')}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {lastSyncTime
                                            ? `Last synced: ${lastSyncTime.toLocaleString()}`
                                            : t('sync.neverSynced')}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => syncAll(profileId, false)}
                                disabled={isSyncing}
                                className="btn-primary"
                            >
                                {isSyncing ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        {t('sync.syncing')}
                                    </>
                                ) : (
                                    <>
                                        <Cloud className="w-4 h-4" />
                                        {t('sync.syncNow')}
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Auto Sync Toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">{t('sync.autoSync')}</p>
                                <p className="text-sm text-muted-foreground">{t('sync.autoSyncDescription')}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
                                className={`relative w-12 h-6 rounded-full transition-colors ${autoSyncEnabled ? 'bg-primary' : 'bg-secondary'
                                    }`}
                            >
                                <span
                                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${autoSyncEnabled ? 'translate-x-6' : 'translate-x-0'
                                        }`}
                                />
                            </button>
                        </div>

                        {/* Sync Info */}
                        <div className="text-sm text-muted-foreground">
                            <p>• {t('sync.dataInfo')}</p>
                            <p>• {t('sync.reminderInfo')}</p>
                        </div>
                    </div>
                </div>

                {/* Appearance */}
                <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold text-foreground mb-4">{t('settings.appearance')}</h3>
                    <div className="space-y-4">
                        {/* Theme Selection */}
                        <div className="form-group">
                            <label className="form-label">{t('settings.theme')}</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTheme('light')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${theme === 'light' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'}`}
                                >
                                    <Sun className="w-4 h-4" />
                                    {t('settings.light')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTheme('dark')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${theme === 'dark' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'}`}
                                >
                                    <Moon className="w-4 h-4" />
                                    {t('settings.dark')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTheme('system')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${theme === 'system' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'}`}
                                >
                                    <Monitor className="w-4 h-4" />
                                    {t('settings.system')}
                                </button>
                            </div>
                        </div>



                        {/* Restart Tutorial */}
                        <div className="pt-2 border-t border-border">
                            <label className="form-label mb-2 block">{t('settings.restartTutorial')}</label>
                            <button
                                type="button"
                                onClick={async () => {
                                    await window.electronAPI.updateSettings(profileId, {
                                        ...settings,
                                        hasSeenTutorial: false
                                    });
                                    await refreshSettings();
                                    showToast(t('settings.saveSuccess'), 'success');
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-secondary transition-colors w-full sm:w-auto text-sm font-medium"
                            >
                                <Globe className="w-4 h-4" />
                                {t('settings.restartTutorial')}
                            </button>
                        </div>

                        {/* Language Selection */}
                        <div className="form-group">
                            <label className="form-label">{t('settings.language')} / زبان</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setLanguage('en')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${language === 'en' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'}`}
                                >
                                    <Globe className="w-4 h-4" />
                                    English
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLanguage('fa')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${language === 'fa' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-secondary'}`}
                                >
                                    <Globe className="w-4 h-4" />
                                    دری / فارسی
                                </button>
                            </div>
                        </div>
                    </div >
                </div >

                <button type="submit" disabled={saving} className="btn-primary">
                    <Save className="w-4 h-4" />
                    {saving ? t('settings.saving') : t('settings.saveSettings')}
                </button>
            </form >

            {/* Confirmation Modal */}
            {
                confirmOpen && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-card border border-border rounded-xl w-full max-w-sm p-6 animate-slideUp">
                            <h3 className="text-lg font-semibold text-foreground mb-2">{t('settings.confirmSave')}</h3>
                            <p className="text-muted-foreground mb-6">{t('settings.confirmSaveMessage')}</p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setConfirmOpen(false);
                                        setPendingData(null);
                                    }}
                                    className="btn-secondary"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    onClick={confirmSave}
                                    className="btn-primary"
                                >
                                    {t('common.confirm')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

