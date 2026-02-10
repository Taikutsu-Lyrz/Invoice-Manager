import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { useForm } from 'react-hook-form';
import { Plus, Search, Edit, Trash, X, Receipt } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

export default function Expenses() {
    const { profileId, settings } = useApp();
    const { t } = useLanguage();
    const [expenses, setExpenses] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

    useEffect(() => {
        loadData();
    }, [profileId]);

    const loadData = async () => {
        try {
            const [expensesData, categoriesData] = await Promise.all([
                window.electronAPI.listExpenses(profileId),
                window.electronAPI.listExpenseCategories(profileId),
            ]);
            setExpenses(expensesData);
            setCategories(categoriesData);
        } catch (error) {
            console.error('Failed to load:', error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (expense?: any) => {
        if (expense) {
            setEditingId(expense.id);
            reset({
                categoryId: expense.categoryId,
                vendor: expense.vendor || '',
                description: expense.description,
                amount: expense.amount,
                taxAmount: expense.taxAmount || 0,
                expenseDate: expense.expenseDate,
                notes: expense.notes || '',
            });
        } else {
            setEditingId(null);
            reset({
                categoryId: categories[0]?.id || '',
                vendor: '',
                description: '',
                amount: 0,
                taxAmount: 0,
                expenseDate: new Date().toISOString().split('T')[0],
                notes: '',
            });
        }
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingId(null);
        reset();
    };

    const onSubmit = async (data: any) => {
        try {
            if (editingId) {
                await window.electronAPI.updateExpense(editingId, data);
            } else {
                await window.electronAPI.createExpense(profileId, data);
            }
            closeModal();
            loadData();
        } catch (error) {
            console.error('Failed to save:', error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this expense?')) return;
        try {
            await window.electronAPI.deleteExpense(id);
            loadData();
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const formatCurrency = (amount: number) => `${settings?.currencySymbol || '$'}${amount.toFixed(2)}`;
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const getCategoryName = (name: string) => {
        const keyMap: Record<string, string> = {
            'Office Supplies': 'expenses.cat.officeSupplies',
            'Travel': 'expenses.cat.travel',
            'Utilities': 'expenses.cat.utilities',
            'Marketing': 'expenses.cat.marketing',
            'Other': 'expenses.cat.other',
        };
        const key = keyMap[name];
        return key ? t(key) : name;
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('expenses.title')}</h1>
                    <p className="text-muted-foreground">{t('expenses.subtitle')}</p>
                </div>
                <button onClick={() => openModal()} className="btn-primary">
                    <Plus className="w-4 h-4" />
                    {t('expenses.addExpense')}
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : expenses.length === 0 ? (
                <div className="text-center py-16">
                    <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">{t('empty.noExpenses')}</h3>
                    <p className="text-muted-foreground mb-4">{t('empty.addFirstExpense')}</p>
                    <button onClick={() => openModal()} className="btn-primary">
                        <Plus className="w-4 h-4" />
                        {t('expenses.addExpense')}
                    </button>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('table.date')}</th>
                                <th>{t('table.category')}</th>
                                <th>{t('table.vendor')}</th>
                                <th>{t('table.description')}</th>
                                <th>{t('table.amount')}</th>
                                <th className="w-24">{t('table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map((expense) => (
                                <tr key={expense.id}>
                                    <td>{formatDate(expense.expenseDate)}</td>
                                    <td>
                                        <span className="inline-flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: expense.category?.color }} />
                                            {getCategoryName(expense.category?.name)}
                                        </span>
                                    </td>
                                    <td>{expense.vendor || '-'}</td>
                                    <td className="max-w-xs truncate">{expense.description}</td>
                                    <td className="font-medium">{formatCurrency(expense.amount)}</td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openModal(expense)} className="btn-icon"><Edit className="w-4 h-4" /></button>
                                            <button onClick={() => handleDelete(expense.id)} className="btn-icon text-red-500"><Trash className="w-4 h-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 animate-slideUp">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold">{editingId ? t('expenses.editExpense') : t('expenses.addExpense')}</h2>
                            <button onClick={closeModal} className="btn-icon"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="form-group">
                                <label className="form-label">{t('form.category')}</label>
                                <select {...register('categoryId')} className="form-input">
                                    {categories.map((cat) => (
                                        <option key={cat.id} value={cat.id}>{getCategoryName(cat.name)}</option>
                                    ))}
                                </select>

                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('form.vendor')}</label>
                                <input {...register('vendor')} className="form-input" placeholder={t('form.vendorPlaceholder')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('common.description')} *</label>
                                <input {...register('description')} className="form-input" placeholder={t('form.whatExpenseFor')} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">{t('common.amount')} *</label>
                                    <input type="number" step="0.01" {...register('amount', { valueAsNumber: true })} className="form-input" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('form.tax')}</label>
                                    <input type="number" step="0.01" {...register('taxAmount', { valueAsNumber: true })} className="form-input" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('common.date')}</label>
                                <input type="date" {...register('expenseDate')} className="form-input" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('common.notes')}</label>
                                <textarea {...register('notes')} className="form-input h-16 resize-none" />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={closeModal} className="btn-secondary">{t('common.cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="btn-primary">
                                    {isSubmitting ? t('settings.saving') : editingId ? t('form.update') : t('common.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

