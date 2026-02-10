import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../App';
import {
    Plus,
    Search,
    Filter,
    MoreVertical,
    Eye,
    Edit,
    Copy,
    Trash,
    Send,
    FileText,
    Download,
} from 'lucide-react';
import { useToast } from '../components/Toast';
import { useLanguage } from '../contexts/LanguageContext';

export default function Invoices() {
    const { profileId, settings } = useApp();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { t, isRTL } = useLanguage();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

    useEffect(() => {
        loadInvoices();
    }, [profileId, statusFilter]);

    const loadInvoices = async () => {
        try {
            const data = await window.electronAPI.listInvoices(profileId, {
                status: statusFilter || undefined,
                search: search || undefined,
            });
            setInvoices(data);
        } catch (error) {
            console.error('Failed to load invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (search) loadInvoices();
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const formatCurrency = (amount: number) => {
        return `${settings?.currencySymbol || '$'}${amount.toFixed(2)}`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getStatusBadge = (status: string) => {
        return <span className={`status-badge status-${status}`}>{status.toUpperCase()}</span>;
    };

    const handleDuplicate = async (id: string) => {
        try {
            const newInvoice = await window.electronAPI.duplicateInvoice(id);
            showToast('Invoice duplicated successfully', 'success');
            navigate(`/invoices/${newInvoice.id}`);
        } catch (error: any) {
            showToast(error.message || 'Failed to duplicate invoice', 'error');
        }
        setActiveMenu(null);
    };

    const handleDelete = async (id: string) => {
        try {
            await window.electronAPI.deleteInvoice(id);
            showToast('Invoice deleted successfully', 'success');
            loadInvoices();
        } catch (error: any) {
            showToast(error.message || 'Failed to delete invoice', 'error');
        }
        setActiveMenu(null);
    };

    const handleGeneratePdf = async (id: string) => {
        try {
            const pdfPath = await window.electronAPI.generateInvoicePdf(id);
            await window.electronAPI.openPath(pdfPath);
            showToast('PDF generated successfully', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to generate PDF', 'error');
        }
        setActiveMenu(null);
    };

    const handleSendEmail = async (id: string) => {
        try {
            await window.electronAPI.sendInvoiceEmail(id);
            showToast('Email sent successfully', 'success');
            loadInvoices();
        } catch (error: any) {
            showToast(error.message || 'Failed to send email', 'error');
        }
        setActiveMenu(null);
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('invoices.title')}</h1>
                    <p className="text-muted-foreground">{t('invoices.subtitle')}</p>
                </div>
                <button onClick={() => navigate('/invoices/new')} className="btn-primary">
                    <Plus className="w-4 h-4" />
                    {t('invoices.new')}
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
                <div className="flex-1 flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <Search className="w-4 h-4" />
                    <input
                        type="text"
                        placeholder={t('common.searchPlaceholder')}
                        className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <select
                    className="form-input w-[40%] max-w-[200px]"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">{t('invoices.allStatus')}</option>
                    <option value="draft">{t('invoices.draft')}</option>
                    <option value="sent">{t('invoices.sent')}</option>
                    <option value="paid">{t('invoices.paid')}</option>
                    <option value="partial">{t('invoices.partial')}</option>
                    <option value="overdue">{t('invoices.overdue')}</option>
                    <option value="void">{t('invoices.void')}</option>
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : invoices.length === 0 ? (
                <div className="text-center py-16">
                    <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">{t('empty.noInvoices')}</h3>
                    <p className="text-muted-foreground mb-4">{t('empty.createFirstInvoice')}</p>
                    <button onClick={() => navigate('/invoices/new')} className="btn-primary">
                        <Plus className="w-4 h-4" />
                        {t('invoices.new')}
                    </button>
                </div>
            ) : (
                <div className="table-container overflow-visible">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('table.invoice')} #</th>
                                <th>{t('table.client')}</th>
                                <th>{t('table.date')}</th>
                                <th>{t('invoices.dueDate')}</th>
                                <th>{t('table.amount')}</th>
                                <th>{t('table.status')}</th>
                                <th className="w-12"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoices.map((invoice) => (
                                <tr key={invoice.id}>
                                    <td>
                                        <button
                                            className="text-primary hover:underline font-medium"
                                            onClick={() => navigate(`/invoices/${invoice.id}`)}
                                        >
                                            {invoice.invoiceNumber}
                                        </button>
                                    </td>
                                    <td>{invoice.client?.name || 'N/A'}</td>
                                    <td>{formatDate(invoice.issueDate)}</td>
                                    <td>{formatDate(invoice.dueDate)}</td>
                                    <td className="font-medium">{formatCurrency(invoice.grandTotal)}</td>
                                    <td>{getStatusBadge(invoice.status)}</td>
                                    <td>
                                        <div className="relative">
                                            <button
                                                className="btn-icon"
                                                onClick={() => setActiveMenu(activeMenu === invoice.id ? null : invoice.id)}
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {activeMenu === invoice.id && (
                                                <>
                                                    {/* Backdrop */}
                                                    <div
                                                        className="fixed inset-0 z-40"
                                                        onClick={() => setActiveMenu(null)}
                                                    />
                                                    {/* Menu */}
                                                    <div className={`fixed ${isRTL ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 w-48 bg-card border border-border rounded-lg shadow-xl z-50 py-1`}>
                                                        <button
                                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary"
                                                            onClick={() => { navigate(`/invoices/${invoice.id}`); setActiveMenu(null); }}
                                                        >
                                                            <Eye className="w-4 h-4" /> {t('invoices.viewEdit') || 'View/Edit'}
                                                        </button>
                                                        <button
                                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary"
                                                            onClick={() => handleGeneratePdf(invoice.id)}
                                                        >
                                                            <Download className="w-4 h-4" /> {t('invoices.exportPdf') || 'Export PDF'}
                                                        </button>
                                                        <button
                                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary"
                                                            onClick={() => handleSendEmail(invoice.id)}
                                                        >
                                                            <Send className="w-4 h-4" /> {t('invoices.sendEmail') || 'Send Email'}
                                                        </button>
                                                        <button
                                                            className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-secondary"
                                                            onClick={() => handleDuplicate(invoice.id)}
                                                        >
                                                            <Copy className="w-4 h-4" /> {t('invoices.duplicate') || 'Duplicate'}
                                                        </button>
                                                        <hr className="border-border my-1" />
                                                        <button
                                                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm ${confirmingDelete === invoice.id ? 'bg-red-500 text-white' : 'text-red-500 hover:bg-secondary'}`}
                                                            onClick={() => {
                                                                if (confirmingDelete === invoice.id) {
                                                                    handleDelete(invoice.id);
                                                                } else {
                                                                    setConfirmingDelete(invoice.id);
                                                                    setTimeout(() => setConfirmingDelete(null), 3000);
                                                                }
                                                            }}
                                                        >
                                                            <Trash className="w-4 h-4" />
                                                            {confirmingDelete === invoice.id ? (t('common.confirmDelete') || 'Confirm Delete?') : (t('common.delete') || 'Delete')}
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
