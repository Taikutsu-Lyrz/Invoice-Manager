import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProductSchema, type CreateProductInput } from '@shared/schemas/product.schema';
import { Plus, Search, Edit, Trash, X, Package } from 'lucide-react';
import { useToast } from '../components/Toast';
import { ConfirmButton } from '../components/ConfirmButton';
import { useLanguage } from '../contexts/LanguageContext';

export default function Products() {
    const { profileId, settings } = useApp();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<CreateProductInput>({
        resolver: zodResolver(createProductSchema),
        defaultValues: { unit: 'pcs', price: 0, trackStock: false },
    });

    useEffect(() => {
        loadProducts();
    }, [profileId]);

    useEffect(() => {
        const timer = setTimeout(() => loadProducts(), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const loadProducts = async () => {
        try {
            const data = await window.electronAPI.listProducts(profileId, search || undefined);
            setProducts(data);
        } catch (error) {
            console.error('Failed to load products:', error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (product?: any) => {
        if (product) {
            setEditingId(product.id);
            reset({
                sku: product.sku || '',
                name: product.name,
                description: product.description || '',
                unit: product.unit,
                price: product.price,
                cost: product.cost || undefined,
                taxRateId: product.taxRateId || undefined,
                stock: product.stock || undefined,
                trackStock: product.trackStock,
            });
        } else {
            setEditingId(null);
            reset({ sku: '', name: '', description: '', unit: 'pcs', price: 0, trackStock: false });
        }
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingId(null);
        reset();
    };

    const onSubmit = async (data: CreateProductInput) => {
        try {
            if (editingId) {
                await window.electronAPI.updateProduct(editingId, data);
                showToast('Product updated successfully', 'success');
            } else {
                await window.electronAPI.createProduct(profileId, data);
                showToast('Product created successfully', 'success');
            }
            closeModal();
            loadProducts();
        } catch (error: any) {
            showToast(error.message || 'Failed to save product', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await window.electronAPI.deleteProduct(id);
            showToast('Product deleted successfully', 'success');
            loadProducts();
        } catch (error: any) {
            showToast(error.message || 'Failed to delete product', 'error');
        }
    };

    const formatCurrency = (amount: number) => {
        return `${settings?.currencySymbol || '$'}${amount.toFixed(2)}`;
    };

    const getUnitLabel = (unit: string) => {
        const key = `units.${unit}`;
        const translated = t(key);
        return translated !== key ? translated : unit;
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('products.title')}</h1>
                    <p className="text-muted-foreground">{t('products.subtitle')}</p>
                </div>
                <button onClick={() => openModal()} className="btn-primary">
                    <Plus className="w-4 h-4" />
                    {t('products.addProduct')}
                </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors w-64">
                <Search className="w-4 h-4" />
                <input
                    type="text"
                    placeholder={t('common.searchPlaceholder')}
                    className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : products.length === 0 ? (
                <div className="text-center py-16">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">{t('empty.noProducts')}</h3>
                    <p className="text-muted-foreground mb-4">{t('empty.addFirstProduct')}</p>
                    <button onClick={() => openModal()} className="btn-primary">
                        <Plus className="w-4 h-4" />
                        {t('products.addProduct')}
                    </button>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('table.sku')}</th>
                                <th>{t('table.name')}</th>
                                <th>{t('table.unit')}</th>
                                <th>{t('table.price')}</th>
                                <th>{t('products.cost')}</th>
                                <th>{t('table.stock')}</th>
                                <th className="w-24">{t('table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product) => (
                                <tr key={product.id}>
                                    <td className="font-mono text-sm">{product.sku || '-'}</td>
                                    <td className="font-medium">{product.name}</td>
                                    <td>{getUnitLabel(product.unit)}</td>
                                    <td className="font-medium">{formatCurrency(product.price)}</td>
                                    <td>{product.cost ? formatCurrency(product.cost) : '-'}</td>
                                    <td>{product.trackStock ? (product.stock ?? 0) : '-'}</td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openModal(product)} className="btn-icon">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <ConfirmButton
                                                onConfirm={() => handleDelete(product.id)}
                                                confirmText="Confirm?"
                                            >
                                                <Trash className="w-4 h-4" />
                                            </ConfirmButton>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 animate-slideUp">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold">{editingId ? t('products.editProduct') : t('products.addProduct')}</h2>
                            <button onClick={closeModal} className="btn-icon">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">{t('table.sku')}</label>
                                    <input {...register('sku')} className="form-input" placeholder="PROD-001" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('table.unit')}</label>
                                    <select {...register('unit')} className="form-input">
                                        <option value="pcs">{t('units.pcs')}</option>
                                        <option value="hrs">{t('units.hrs')}</option>
                                        <option value="days">{t('units.days')}</option>
                                        <option value="kg">{t('units.kg')}</option>
                                        <option value="units">{t('units.units')}</option>
                                        <option value="items">{t('units.items')}</option>
                                    </select>

                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('common.name')} *</label>
                                <input {...register('name')} className="form-input" placeholder={t('products.title')} />
                                {errors.name && <p className="form-error">{errors.name.message}</p>}
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('common.description')}</label>
                                <textarea {...register('description')} className="form-input h-16 resize-none" placeholder={t('common.description')} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">{t('table.price')} *</label>
                                    <input type="number" step="0.01" {...register('price', { valueAsNumber: true })} className="form-input" />
                                    {errors.price && <p className="form-error">{errors.price.message}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('products.cost')}</label>
                                    <input type="number" step="0.01" {...register('cost', { valueAsNumber: true })} className="form-input" placeholder={t('common.forProfitTracking')} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('settings.taxRates')}</label>
                                <select {...register('taxRateId')} className="form-input">
                                    <option value="">{t('common.noTax')}</option>
                                    {settings?.taxRates?.map((rate: any) => (
                                        <option key={rate.id} value={rate.id}>{rate.name} ({rate.rate}%)</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" {...register('trackStock')} className="w-4 h-4 rounded border-border" />
                                    <span className="text-sm">{t('common.trackStock')}</span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={closeModal} className="btn-secondary">
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" disabled={isSubmitting} className="btn-primary">
                                    {isSubmitting ? t('settings.saving') : editingId ? t('common.save') : t('common.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
