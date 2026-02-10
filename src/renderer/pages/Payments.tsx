import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPaymentSchema, type CreatePaymentInput } from '@shared/schemas/payment.schema';
import { Plus, Search, Trash, X, CreditCard, Download, Check } from 'lucide-react';
import { useToast } from '../components/Toast';
import { ConfirmButton } from '../components/ConfirmButton';
import { useLanguage } from '../contexts/LanguageContext';

export default function Payments() {
    const { profileId, settings } = useApp();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [payments, setPayments] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors, isSubmitting },
    } = useForm<CreatePaymentInput>({
        resolver: zodResolver(createPaymentSchema),
        defaultValues: {
            method: 'bank',
            paymentDate: new Date().toISOString().split('T')[0],
            isRefund: false,
        },
    });

    const selectedInvoiceId = watch('invoiceId');
    const selectedInvoice = invoices.find(i => i.id === selectedInvoiceId);

    useEffect(() => {
        loadData();
    }, [profileId]);

    const loadData = async () => {
        try {
            const [paymentsData, invoicesData] = await Promise.all([
                window.electronAPI.listPayments(profileId),
                window.electronAPI.listInvoices(profileId, { status: 'sent' }),
            ]);
            setPayments(paymentsData);
            // Include all invoices that can receive payments
            const allInvoices = await window.electronAPI.listInvoices(profileId);
            setInvoices(allInvoices.filter((i: any) => !['void'].includes(i.status)));
        } catch (error) {
            console.error('Failed to load:', error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = () => {
        reset({
            invoiceId: '',
            amount: 0,
            method: 'bank',
            paymentDate: new Date().toISOString().split('T')[0],
            isRefund: false,
        });
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        reset();
    };

    const handlePayInFull = () => {
        if (selectedInvoice && selectedInvoice.balanceDue > 0) {
            setValue('amount', selectedInvoice.balanceDue);
        }
    };

    const onSubmit = async (data: CreatePaymentInput) => {
        try {
            await window.electronAPI.createPayment(profileId, data);
            showToast('Payment recorded successfully', 'success');
            closeModal();
            loadData();
        } catch (error: any) {
            showToast(error.message || 'Failed to save payment', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await window.electronAPI.deletePayment(id);
            showToast('Payment deleted successfully', 'success');
            loadData();
        } catch (error: any) {
            showToast(error.message || 'Failed to delete payment', 'error');
        }
    };

    const handleGenerateReceipt = async (id: string) => {
        try {
            const pdfPath = await window.electronAPI.generateReceipt(id);
            await window.electronAPI.openPath(pdfPath);
            showToast('Receipt generated successfully', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to generate receipt', 'error');
        }
    };

    const formatCurrency = (amount: number) => {
        return `${settings?.currencySymbol || '$'}${amount.toFixed(2)}`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('payments.title')}</h1>
                    <p className="text-muted-foreground">{t('payments.subtitle')}</p>
                </div>
                <button onClick={openModal} className="btn-primary">
                    <Plus className="w-4 h-4" />
                    {t('payments.recordPayment')}
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : payments.length === 0 ? (
                <div className="text-center py-16">
                    <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">{t('empty.noPayments')}</h3>
                    <p className="text-muted-foreground mb-4">{t('empty.recordFirstPayment')}</p>
                    <button onClick={openModal} className="btn-primary">
                        <Plus className="w-4 h-4" />
                        {t('payments.recordPayment')}
                    </button>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('table.date')}</th>
                                <th>{t('table.invoice')}</th>
                                <th>{t('table.client')}</th>
                                <th>{t('table.method')}</th>
                                <th>{t('table.amount')}</th>
                                <th>{t('table.type')}</th>
                                <th className="w-24">{t('table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map((payment) => (
                                <tr key={payment.id}>
                                    <td>{formatDate(payment.paymentDate)}</td>
                                    <td className="font-medium">{payment.invoiceNumber}</td>
                                    <td>{payment.clientName}</td>
                                    <td className="capitalize">{payment.method}</td>
                                    <td className={`font-medium ${payment.isRefund ? 'text-red-500' : 'text-green-500'}`}>
                                        {payment.isRefund ? '-' : '+'}{formatCurrency(payment.amount)}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${payment.isRefund ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                            {payment.isRefund ? t('status.refund') : t('status.payment')}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleGenerateReceipt(payment.id)} className="btn-icon" title="Download Receipt">
                                                <Download className="w-4 h-4" />
                                            </button>
                                            <ConfirmButton
                                                onConfirm={() => handleDelete(payment.id)}
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

            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 animate-slideUp">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold">{t('payments.recordPayment')}</h2>
                            <button onClick={closeModal} className="btn-icon">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="form-group">
                                <label className="form-label">{t('invoices.title')} *</label>
                                <select {...register('invoiceId')} className="form-input">
                                    <option value="">{t('payments.selectInvoice')}</option>
                                    {invoices.map((inv) => (
                                        <option key={inv.id} value={inv.id}>
                                            {inv.invoiceNumber} - {inv.client?.name} ({formatCurrency(inv.balanceDue)} {t('payments.due')})
                                        </option>
                                    ))}
                                </select>
                                {errors.invoiceId && <p className="form-error">{errors.invoiceId.message}</p>}
                            </div>

                            <div className="form-group">
                                <div className="flex items-center justify-between">
                                    <label className="form-label">{t('common.amount')} *</label>
                                    {selectedInvoice && selectedInvoice.balanceDue > 0 && (
                                        <button
                                            type="button"
                                            onClick={handlePayInFull}
                                            className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-md hover:bg-green-500/30 transition-colors flex items-center gap-1"
                                        >
                                            <Check className="w-3 h-3" />
                                            {t('payments.payInFull')} ({formatCurrency(selectedInvoice.balanceDue)})
                                        </button>
                                    )}
                                </div>
                                <input type="number" step="0.01" {...register('amount', { valueAsNumber: true })} className="form-input" />
                                {errors.amount && <p className="form-error">{errors.amount.message}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">{t('payments.method')}</label>
                                    <select {...register('method')} className="form-input">
                                        <option value="cash">{t('payments.cash')}</option>
                                        <option value="bank">{t('payments.bankTransfer')}</option>
                                        <option value="card">{t('payments.card')}</option>
                                        <option value="check">{t('payments.check')}</option>
                                        <option value="other">{t('payments.other')}</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('common.date')} *</label>
                                    <input type="date" {...register('paymentDate')} className="form-input" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('payments.reference')}</label>
                                <input {...register('reference')} className="form-input" placeholder={t('payments.referencePlaceholder')} />
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('common.notes')}</label>
                                <textarea {...register('notes')} className="form-input h-16 resize-none" />
                            </div>

                            <div className="flex items-center gap-2">
                                <input type="checkbox" {...register('isRefund')} id="isRefund" className="w-4 h-4" />
                                <label htmlFor="isRefund" className="text-sm">{t('payments.isRefund')}</label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={closeModal} className="btn-secondary">{t('common.cancel')}</button>
                                <button type="submit" disabled={isSubmitting} className="btn-primary">
                                    {isSubmitting ? t('settings.saving') : t('payments.savePayment')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

