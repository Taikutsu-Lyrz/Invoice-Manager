import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../App';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createInvoiceSchema, type CreateInvoiceInput } from '@shared/schemas/invoice.schema';
import { Plus, Save, Download, ArrowLeft, X, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useLanguage } from '../contexts/LanguageContext';

export default function InvoiceEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { profileId, settings } = useApp();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [clients, setClients] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [invoiceNumber, setInvoiceNumber] = useState('');

    // Quick client creation state
    const [showQuickClient, setShowQuickClient] = useState(false);
    const [quickClientName, setQuickClientName] = useState('');
    const [showAdditionalFields, setShowAdditionalFields] = useState(false);
    const [quickClientPhone, setQuickClientPhone] = useState('');
    const [quickClientEmail, setQuickClientEmail] = useState('');
    const [quickClientAddress, setQuickClientAddress] = useState('');
    const [quickClientNotes, setQuickClientNotes] = useState('');
    const [creatingClient, setCreatingClient] = useState(false);

    const isEditing = Boolean(id);

    const {
        register,
        control,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors },
    } = useForm<CreateInvoiceInput>({
        resolver: zodResolver(createInvoiceSchema),
        defaultValues: {
            clientId: '',
            issueDate: new Date().toISOString().split('T')[0],
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 0, discountPercent: 0 }],
            notes: settings?.defaultNotes || '',
            terms: settings?.defaultTerms || '',
        },
    });

    const { fields, append, remove } = useFieldArray({ control, name: 'items' });

    const watchedItems = watch('items');

    useEffect(() => {
        loadData();
    }, [id, profileId]);

    const loadData = async () => {
        try {
            const [clientsData, productsData] = await Promise.all([
                window.electronAPI.listClients(profileId),
                window.electronAPI.listProducts(profileId),
            ]);

            setClients(clientsData);
            setProducts(productsData);

            if (id) {
                const invoice = await window.electronAPI.getInvoice(id);
                if (invoice) {
                    setInvoiceNumber(invoice.invoiceNumber);
                    reset({
                        clientId: invoice.clientId,
                        issueDate: invoice.issueDate,
                        dueDate: invoice.dueDate,
                        items: invoice.items.map((item: any) => ({
                            productId: item.productId,
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            taxRate: item.taxRate,
                            discountPercent: item.discountPercent,
                        })),
                        notes: invoice.notes || '',
                        terms: invoice.terms || '',
                    });
                }
            } else {
                const nextNumber = await window.electronAPI.getNextInvoiceNumber(profileId);
                setInvoiceNumber(nextNumber);
            }
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculateItemTotal = (item: any) => {
        const base = (item.quantity || 0) * (item.unitPrice || 0);
        const discount = base * ((item.discountPercent || 0) / 100);
        const afterDiscount = base - discount;
        const tax = afterDiscount * ((item.taxRate || 0) / 100);
        return afterDiscount + tax;
    };

    const calculateTotals = () => {
        let subtotal = 0;
        let taxTotal = 0;
        let discountTotal = 0;

        for (const item of watchedItems || []) {
            const base = (item.quantity || 0) * (item.unitPrice || 0);
            const discount = base * ((item.discountPercent || 0) / 100);
            const afterDiscount = base - discount;
            const tax = afterDiscount * ((item.taxRate || 0) / 100);

            subtotal += base;
            discountTotal += discount;
            taxTotal += tax;
        }

        const grandTotal = subtotal - discountTotal + taxTotal;
        return { subtotal, discountTotal, taxTotal, grandTotal };
    };

    const handleProductSelect = (index: number, productId: string) => {
        const product = products.find((p) => p.id === productId);
        if (product) {
            setValue(`items.${index}.productId`, productId);
            setValue(`items.${index}.description`, product.name);
            setValue(`items.${index}.unitPrice`, product.price);
            // Get tax rate if available
            const taxRate = settings?.taxRates?.find((t: any) => t.id === product.taxRateId);
            if (taxRate) {
                setValue(`items.${index}.taxRate`, taxRate.rate);
            }
        }
    };

    const onSubmit = async (data: CreateInvoiceInput) => {
        setSaving(true);
        try {
            if (isEditing) {
                await window.electronAPI.updateInvoice(id!, data);
                showToast('Invoice updated successfully', 'success');
            } else {
                await window.electronAPI.createInvoice(profileId, data);
                showToast('Invoice created successfully', 'success');
            }
            navigate('/invoices');
        } catch (error: any) {
            showToast(error.message || 'Failed to save invoice', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleExportPdf = async () => {
        if (!id) return;
        try {
            const pdfPath = await window.electronAPI.generateInvoicePdf(id);
            await window.electronAPI.openPath(pdfPath);
            showToast('PDF generated successfully', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to export PDF', 'error');
        }
    };

    // Quick client creation
    const handleQuickClientCreate = async () => {
        if (!quickClientName.trim()) {
            showToast('Please enter a client name', 'error');
            return;
        }

        setCreatingClient(true);
        try {
            const clientData = {
                name: quickClientName.trim(),
                email: quickClientEmail.trim() || '',
                phone: quickClientPhone.trim() || '',
                billingAddress: quickClientAddress.trim() || '',
                notes: quickClientNotes.trim() || '',
            };

            const newClient = await window.electronAPI.createClient(profileId, clientData);

            // Add to clients list and select it
            setClients(prev => [...prev, newClient]);
            setValue('clientId', newClient.id);

            // Reset and close modal
            setQuickClientName('');
            setQuickClientPhone('');
            setQuickClientEmail('');
            setQuickClientAddress('');
            setQuickClientNotes('');
            setShowAdditionalFields(false);
            setShowQuickClient(false);

            showToast('Client created successfully!', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to create client', 'error');
        } finally {
            setCreatingClient(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return `${settings?.currencySymbol || '$'}${amount.toFixed(2)}`;
    };

    const totals = calculateTotals();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="animate-fadeIn max-w-5xl mx-auto">
            <form onSubmit={handleSubmit(onSubmit, (formErrors) => {
                console.error('Form validation errors:', formErrors);

                // Extract error messages, including nested item errors
                const getErrorMessages = (errors: any): string[] => {
                    const messages: string[] = [];
                    for (const key in errors) {
                        const error = errors[key];
                        if (error?.message) {
                            messages.push(error.message);
                        } else if (Array.isArray(error)) {
                            // Handle items array errors
                            error.forEach((itemError, idx) => {
                                if (itemError) {
                                    for (const field in itemError) {
                                        if (itemError[field]?.message) {
                                            messages.push(`Item ${idx + 1}: ${itemError[field].message}`);
                                        }
                                    }
                                }
                            });
                        } else if (error?.root?.message) {
                            messages.push(error.root.message);
                        }
                    }
                    return messages;
                };

                const errorMessages = getErrorMessages(formErrors);
                if (errorMessages.length > 0) {
                    showToast(`Validation error: ${errorMessages[0]}`, 'error');
                } else {
                    showToast('Please fill in all required fields', 'error');
                }
            })}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={() => navigate('/invoices')} className="btn-icon">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">
                                {isEditing ? t('invoice.edit') : t('invoice.new')}
                            </h1>
                            <p className="text-muted-foreground">#{invoiceNumber}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isEditing && (
                            <button type="button" onClick={handleExportPdf} className="btn-secondary">
                                <Download className="w-4 h-4" />
                                Export PDF
                            </button>
                        )}
                        <button type="submit" disabled={saving} className="btn-primary">
                            <Save className="w-4 h-4" />
                            {saving ? t('invoice.saving') : t('invoice.save')}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Client Selection */}
                        <div className="bg-card rounded-xl border border-border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-foreground">{t('invoice.client')}</h3>
                                <button
                                    type="button"
                                    onClick={() => setShowQuickClient(!showQuickClient)}
                                    className="text-sm text-primary hover:underline flex items-center gap-1"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    {showQuickClient ? t('common.cancel') : t('invoice.newClient')}
                                </button>
                            </div>

                            {showQuickClient ? (
                                <div className="space-y-4 p-4 bg-secondary/30 rounded-lg">
                                    {/* Name - Required */}
                                    <div>
                                        <label className="text-sm text-muted-foreground mb-1 block">{t('common.name')} *</label>
                                        <input
                                            type="text"
                                            value={quickClientName}
                                            onChange={(e) => setQuickClientName(e.target.value)}
                                            className="form-input"
                                            placeholder="Client name (required)"
                                        />
                                    </div>

                                    {/* Additional Information Toggle */}
                                    <button
                                        type="button"
                                        onClick={() => setShowAdditionalFields(!showAdditionalFields)}
                                        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                                    >
                                        {showAdditionalFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        {showAdditionalFields ? 'Hide additional info' : 'Add additional info (phone, email, etc.)'}
                                    </button>

                                    {/* Additional Fields */}
                                    {showAdditionalFields && (
                                        <div className="space-y-4 pt-2">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-sm text-muted-foreground mb-1 block">Phone</label>
                                                    <input
                                                        type="text"
                                                        value={quickClientPhone}
                                                        onChange={(e) => setQuickClientPhone(e.target.value)}
                                                        className="form-input"
                                                        placeholder="Phone number"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-sm text-muted-foreground mb-1 block">Email</label>
                                                    <input
                                                        type="email"
                                                        value={quickClientEmail}
                                                        onChange={(e) => setQuickClientEmail(e.target.value)}
                                                        className="form-input"
                                                        placeholder="Email address"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-sm text-muted-foreground mb-1 block">Address</label>
                                                <textarea
                                                    value={quickClientAddress}
                                                    onChange={(e) => setQuickClientAddress(e.target.value)}
                                                    className="form-input"
                                                    rows={2}
                                                    placeholder="Billing address"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-sm text-muted-foreground mb-1 block">Notes</label>
                                                <input
                                                    type="text"
                                                    value={quickClientNotes}
                                                    onChange={(e) => setQuickClientNotes(e.target.value)}
                                                    className="form-input"
                                                    placeholder="Additional notes"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Create Button */}
                                    <button
                                        type="button"
                                        onClick={handleQuickClientCreate}
                                        disabled={creatingClient || !quickClientName.trim()}
                                        className="btn-primary w-full"
                                    >
                                        {creatingClient ? 'Creating...' : 'Create Client & Select'}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <select
                                        {...register('clientId')}
                                        className="form-input"
                                    >
                                        <option value="">Select a client</option>
                                        {clients.map((client) => (
                                            <option key={client.id} value={client.id}>
                                                {client.name}
                                            </option>
                                        ))}
                                    </select>
                                    {errors.clientId && (
                                        <p className="form-error">{errors.clientId.message}</p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Line Items */}
                        <div className="bg-card rounded-xl border border-border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-foreground">{t('invoice.items')}</h3>
                                <button
                                    type="button"
                                    onClick={() => append({ description: '', quantity: 1, unitPrice: 0, taxRate: 0, discountPercent: 0 })}
                                    className="btn-secondary text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    {t('invoice.addItem')}
                                </button>
                            </div>

                            <div className="space-y-4">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-1 gap-2 items-start p-4 bg-secondary/30 rounded-lg lg:grid-cols-14">
                                        <div className="lg:col-span-3">
                                            <label className="text-xs text-muted-foreground mb-1 block">{t('invoice.description')}</label>
                                            <select
                                                className="form-input text-sm mb-2"
                                                onChange={(e) => handleProductSelect(index, e.target.value)}
                                            >
                                                <option value="">{t('invoice.quickSelect')}</option>
                                                {products.map((p) => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                {...register(`items.${index}.description`)}
                                                className={`form-input text-sm ${errors.items?.[index]?.description ? 'border-red-500' : ''}`}
                                                placeholder={t('invoice.itemDescription')}
                                            />
                                            {errors.items?.[index]?.description && (
                                                <p className="text-xs text-red-500 mt-1">{errors.items[index]?.description?.message}</p>
                                            )}
                                        </div>
                                        <div className="lg:col-span-2">
                                            <label className="text-xs text-muted-foreground mb-1 block">{t('invoice.qty')}</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                                                className="form-input text-sm"
                                            />
                                        </div>
                                        <div className="lg:col-span-2">
                                            <label className="text-xs text-muted-foreground mb-1 block">{t('invoice.unitPrice')}</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                                                className="form-input text-sm"
                                            />
                                        </div>
                                        <div className="lg:col-span-2">
                                            <label className="text-xs text-muted-foreground mb-1 block">{t('invoice.taxPercent')}</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                {...register(`items.${index}.taxRate`, { valueAsNumber: true })}
                                                className="form-input text-sm"
                                            />
                                        </div>
                                        <div className="lg:col-span-2">
                                            <label className="text-xs text-muted-foreground mb-1 block">{t('invoice.discPercent')}</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                {...register(`items.${index}.discountPercent`, { valueAsNumber: true })}
                                                className="form-input text-sm"
                                            />
                                        </div>
                                        <div className="lg:col-span-2">
                                            <label className="text-xs text-muted-foreground mb-1 block">{t('invoice.total')}</label>
                                            <div className="form-input bg-secondary/50 text-sm font-medium">
                                                {formatCurrency(calculateItemTotal(watchedItems?.[index] || {}))}
                                            </div>
                                        </div>
                                        <div className="lg:col-span-1 pt-6 text-center">
                                            <button
                                                type="button"
                                                onClick={() => remove(index)}
                                                className="btn-icon text-red-500 inline-flex"
                                                disabled={fields.length === 1}
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {errors.items && (
                                <p className="form-error mt-2">{errors.items.message || errors.items.root?.message}</p>
                            )}
                        </div>

                        {/* Notes & Terms */}
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-card rounded-xl border border-border p-6">
                                <label className="font-semibold text-foreground block mb-2">{t('invoice.notes')}</label>
                                <textarea
                                    {...register('notes')}
                                    className="form-input h-24 resize-none"
                                    placeholder={t('invoice.additionalNotes')}
                                />
                            </div>
                            <div className="bg-card rounded-xl border border-border p-6">
                                <label className="font-semibold text-foreground block mb-2">{t('invoice.terms')}</label>
                                <textarea
                                    {...register('terms')}
                                    className="form-input h-24 resize-none"
                                    placeholder="Terms and conditions..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Dates */}
                        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                            <div>
                                <label className="form-label">{t('invoice.issueDate')}</label>
                                <input type="date" {...register('issueDate')} className="form-input" />
                            </div>
                            <div>
                                <label className="form-label">{t('invoice.dueDate')}</label>
                                <input type="date" {...register('dueDate')} className="form-input" />
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="bg-card rounded-xl border border-border p-6">
                            <h3 className="font-semibold text-foreground mb-4">{t('invoice.summary')}</h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('invoice.subtotal')}</span>
                                    <span>{formatCurrency(totals.subtotal)}</span>
                                </div>
                                {totals.discountTotal > 0 && (
                                    <div className="flex justify-between text-green-500">
                                        <span>{t('invoice.discount')}</span>
                                        <span>-{formatCurrency(totals.discountTotal)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('invoice.tax')}</span>
                                    <span>{formatCurrency(totals.taxTotal)}</span>
                                </div>
                                <hr className="border-border" />
                                <div className="flex justify-between text-lg font-bold">
                                    <span>{t('invoice.total')}</span>
                                    <span className="text-primary">{formatCurrency(totals.grandTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
