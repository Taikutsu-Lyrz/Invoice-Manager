import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { Download, FileText, DollarSign, Receipt, CreditCard, FileDown } from 'lucide-react';
import { useToast } from '../components/Toast';
import { useLanguage } from '../contexts/LanguageContext';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
} from 'recharts';

type ReportType = 'sales' | 'tax' | 'profit' | 'payments' | 'expenses';

export default function Reports() {
    const { profileId, settings } = useApp();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<ReportType>('sales');
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadReport();
    }, [activeTab, startDate, endDate, profileId]);

    const loadReport = async () => {
        setLoading(true);
        try {
            const filters = { startDate, endDate };
            let data;
            switch (activeTab) {
                case 'sales':
                    data = await window.electronAPI.getSalesReport(profileId, filters);
                    break;
                case 'tax':
                    data = await window.electronAPI.getTaxReport(profileId, filters);
                    break;
                case 'profit':
                    data = await window.electronAPI.getProfitReport(profileId, filters);
                    break;
                case 'payments':
                    data = await window.electronAPI.getPaymentsReport(profileId, filters);
                    break;
                case 'expenses':
                    data = await window.electronAPI.getExpensesReport(profileId, filters);
                    break;
            }
            setReportData(data);
        } catch (error) {
            console.error('Failed to load report:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCsv = async () => {
        if (!reportData) return;
        try {
            await window.electronAPI.exportReportCsv(activeTab, reportData);
            showToast('CSV exported successfully', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to export CSV', 'error');
        }
    };

    const handleExportPdf = async () => {
        setExporting(true);
        try {
            const pdfPath = await window.electronAPI.generateReportPdf(profileId, { startDate, endDate });
            await window.electronAPI.openPath(pdfPath);
            showToast('PDF report generated successfully', 'success');
        } catch (error: any) {
            showToast(error.message || 'Failed to generate PDF', 'error');
        } finally {
            setExporting(false);
        }
    };

    const formatCurrency = (amount: number) => `${settings?.currencySymbol || '$'}${amount.toFixed(2)}`;

    const tabs = [
        { id: 'sales' as const, label: t('reports.sales'), icon: FileText },
        { id: 'tax' as const, label: t('reports.tax'), icon: Receipt },
        { id: 'profit' as const, label: t('reports.profit'), icon: DollarSign },
        { id: 'payments' as const, label: t('payments.title'), icon: CreditCard },
        { id: 'expenses' as const, label: t('expenses.title'), icon: Receipt },
    ];

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('reports.title')}</h1>
                    <p className="text-muted-foreground">{t('reports.subtitle')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleExportPdf} className="btn-primary" disabled={exporting}>
                        <FileDown className="w-4 h-4" />
                        {exporting ? 'Generating...' : t('reports.exportPdf')}
                    </button>
                    <button onClick={handleExportCsv} className="btn-secondary">
                        <Download className="w-4 h-4" />
                        {t('reports.exportCsv')}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border pb-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">{t('reports.from')}</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input w-40" />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">{t('reports.to')}</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input w-40" />
                </div>
            </div>

            {/* Report Content */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Sales Report */}
                    {activeTab === 'sales' && reportData && (
                        <>
                            <div className="grid grid-cols-4 gap-4">
                                <div className="stat-card"><p className="stat-card-value">{reportData.totals?.count || 0}</p><p className="stat-card-label">{t('reports.invoicesCount')}</p></div>
                                <div className="stat-card"><p className="stat-card-value">{formatCurrency(reportData.totals?.grandTotal || 0)}</p><p className="stat-card-label">{t('reports.totalBilled')}</p></div>
                                <div className="stat-card"><p className="stat-card-value">{formatCurrency(reportData.totals?.amountPaid || 0)}</p><p className="stat-card-label">{t('reports.collected')}</p></div>
                                <div className="stat-card"><p className="stat-card-value">{formatCurrency(reportData.totals?.taxTotal || 0)}</p><p className="stat-card-label">{t('reports.taxTotal')}</p></div>
                            </div>
                            <div className="table-container">
                                <table className="data-table">
                                    <thead><tr><th>{t('table.invoice')}</th><th>{t('table.client')}</th><th>{t('table.date')}</th><th>{t('table.status')}</th><th>{t('table.total')}</th><th>{t('table.paid')}</th></tr></thead>
                                    <tbody>
                                        {reportData.invoices?.map((inv: any) => (
                                            <tr key={inv.id}>
                                                <td className="font-medium">{inv.invoice_number}</td>
                                                <td>{inv.client_name}</td>
                                                <td>{new Date(inv.issue_date).toLocaleDateString()}</td>
                                                <td><span className={`status-badge status-${inv.status}`}>{inv.status}</span></td>
                                                <td>{formatCurrency(inv.grand_total)}</td>
                                                <td>{formatCurrency(inv.amount_paid)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* Tax Report */}
                    {activeTab === 'tax' && reportData && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="stat-card"><p className="stat-card-value">{formatCurrency(reportData.totalBase || 0)}</p><p className="stat-card-label">{t('reports.taxableAmount')}</p></div>
                                <div className="stat-card"><p className="stat-card-value">{formatCurrency(reportData.totalTax || 0)}</p><p className="stat-card-label">{t('reports.taxCollected')}</p></div>
                            </div>
                            <div className="table-container">
                                <table className="data-table">
                                    <thead><tr><th>{t('table.taxRate')}</th><th>{t('table.baseAmount')}</th><th>{t('table.taxCollected')}</th></tr></thead>
                                    <tbody>
                                        {reportData.taxBreakdown?.map((row: any, i: number) => (
                                            <tr key={i}>
                                                <td className="font-medium">{row.tax_rate}%</td>
                                                <td>{formatCurrency(row.base_amount)}</td>
                                                <td>{formatCurrency(row.tax_collected)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* Profit Report */}
                    {activeTab === 'profit' && reportData && (
                        <div className="grid grid-cols-5 gap-4">
                            <div className="stat-card"><p className="stat-card-value text-green-500">{formatCurrency(reportData.revenue || 0)}</p><p className="stat-card-label">{t('reports.revenue')}</p></div>
                            <div className="stat-card"><p className="stat-card-value text-red-500">{formatCurrency(reportData.cogs || 0)}</p><p className="stat-card-label">{t('reports.cogs')}</p></div>
                            <div className="stat-card"><p className="stat-card-value">{formatCurrency(reportData.grossProfit || 0)}</p><p className="stat-card-label">{t('reports.grossProfit')}</p></div>
                            <div className="stat-card"><p className="stat-card-value text-red-500">{formatCurrency(reportData.expenses || 0)}</p><p className="stat-card-label">{t('reports.expensesCount')}</p></div>
                            <div className="stat-card"><p className={`stat-card-value ${reportData.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(reportData.netProfit || 0)}</p><p className="stat-card-label">{t('reports.netProfit')}</p></div>
                        </div>
                    )}

                    {/* Payments Report */}
                    {activeTab === 'payments' && reportData && (
                        <>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="stat-card"><p className="stat-card-value">{reportData.totals?.count || 0}</p><p className="stat-card-label">{t('reports.transactions')}</p></div>
                                <div className="stat-card"><p className="stat-card-value text-green-500">{formatCurrency(reportData.totals?.totalReceived || 0)}</p><p className="stat-card-label">{t('reports.received')}</p></div>
                                <div className="stat-card"><p className="stat-card-value text-red-500">{formatCurrency(reportData.totals?.totalRefunded || 0)}</p><p className="stat-card-label">{t('reports.refunded')}</p></div>
                            </div>
                            <div className="table-container">
                                <table className="data-table">
                                    <thead><tr><th>{t('table.date')}</th><th>{t('table.invoice')}</th><th>{t('table.client')}</th><th>{t('table.method')}</th><th>{t('table.amount')}</th></tr></thead>
                                    <tbody>
                                        {reportData.payments?.map((p: any) => (
                                            <tr key={p.id}>
                                                <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                                                <td>{p.invoice_number}</td>
                                                <td>{p.client_name}</td>
                                                <td className="capitalize">{p.method}</td>
                                                <td className={p.is_refund ? 'text-red-500' : 'text-green-500'}>{p.is_refund ? '-' : '+'}{formatCurrency(p.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {/* Expenses Report */}
                    {activeTab === 'expenses' && reportData && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="stat-card"><p className="stat-card-value">{reportData.totals?.count || 0}</p><p className="stat-card-label">{t('reports.expensesCount')}</p></div>
                                <div className="stat-card"><p className="stat-card-value text-red-500">{formatCurrency(reportData.totals?.total || 0)}</p><p className="stat-card-label">{t('reports.totalSpent')}</p></div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="bg-card rounded-xl border border-border p-6">
                                    <h3 className="font-semibold mb-4">{t('reports.byCategory')}</h3>
                                    <div className="h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={reportData.byCategory || []} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                                                    {(reportData.byCategory || []).map((entry: any, i: number) => (
                                                        <Cell key={i} fill={entry.color || '#6366f1'} />
                                                    ))}
                                                </Pie>
                                                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="table-container max-h-80 overflow-y-auto">
                                    <table className="data-table">
                                        <thead><tr><th>{t('table.date')}</th><th>{t('table.category')}</th><th>{t('table.description')}</th><th>{t('table.amount')}</th></tr></thead>
                                        <tbody>
                                            {reportData.expenses?.map((e: any) => (
                                                <tr key={e.id}>
                                                    <td>{new Date(e.expense_date).toLocaleDateString()}</td>
                                                    <td>{e.category_name}</td>
                                                    <td className="max-w-xs truncate">{e.description}</td>
                                                    <td>{formatCurrency(e.amount)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
