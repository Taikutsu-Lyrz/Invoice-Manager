import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { useLanguage } from '../contexts/LanguageContext';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Clock,
    AlertTriangle,
    ArrowUpRight,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from 'recharts';

export default function Dashboard() {
    const { profileId, settings } = useApp();
    const { t } = useLanguage();
    const [stats, setStats] = useState<any>(null);
    const [revenueChart, setRevenueChart] = useState<any[]>([]);
    const [statusChart, setStatusChart] = useState<any[]>([]);
    const [clientChart, setClientChart] = useState<any[]>([]);
    const [activity, setActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, [profileId]);

    const loadDashboardData = async () => {
        try {
            const [statsData, revenueData, statusData, clientData, activityData] = await Promise.all([
                window.electronAPI.getDashboardStats(profileId),
                window.electronAPI.getRevenueChart(profileId, 12),
                window.electronAPI.getStatusChart(profileId),
                window.electronAPI.getClientRevenueChart(profileId, 5),
                window.electronAPI.getRecentActivity(profileId, 10),
            ]);

            setStats(statsData);
            setRevenueChart(revenueData);
            setStatusChart(statusData);
            setClientChart(clientData);
            setActivity(activityData);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return `${settings?.currencySymbol || '$'}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const formatActivity = (details: string) => {
        // Soft delete patterns - check these first as they're most specific
        const restoredClient = details.match(/Restored client:? (.+)/);
        if (restoredClient) return `${t('audit.restoredClient')}: ${restoredClient[1]}`;

        const restoredProduct = details.match(/Restored product:? (.+)/);
        if (restoredProduct) return `${t('audit.restoredProduct') || 'Restored product'}: ${restoredProduct[1]}`;

        const restoredInvoice = details.match(/Restored invoice:? (.+)/);
        if (restoredInvoice) return `${t('audit.restoredInvoice') || 'Restored invoice'}: ${restoredInvoice[1]}`;

        const movedClientToTrash = details.match(/Moved client to trash:? (.+)/);
        if (movedClientToTrash) return `${t('audit.movedClientToTrash')}: ${movedClientToTrash[1]}`;

        const movedProductToTrash = details.match(/Moved product to trash:? (.+)/);
        if (movedProductToTrash) return `${t('audit.movedProductToTrash') || 'Moved product to trash'}: ${movedProductToTrash[1]}`;

        const movedInvoiceToTrash = details.match(/Moved invoice to trash:? (.+)/);
        if (movedInvoiceToTrash) return `${t('audit.movedInvoiceToTrash')}: ${movedInvoiceToTrash[1]}`;

        const movedPaymentToTrash = details.match(/Moved payment (?:of )?(.+) to trash/);
        if (movedPaymentToTrash) return `${t('audit.movedPaymentToTrash')}: ${movedPaymentToTrash[1]}`;

        const permanentDeletedClient = details.match(/Permanently deleted client:? (.+)/);
        if (permanentDeletedClient) return `${t('audit.permanentDeletedClient')}: ${permanentDeletedClient[1]}`;

        const permanentDeletedProduct = details.match(/Permanently deleted product:? (.+)/);
        if (permanentDeletedProduct) return `${t('audit.permanentDeletedProduct') || 'Permanently deleted product'}: ${permanentDeletedProduct[1]}`;

        const permanentDeletedInvoice = details.match(/Permanently deleted invoice:? (.+)/);
        if (permanentDeletedInvoice) return `${t('audit.permanentDeletedInvoice')}: ${permanentDeletedInvoice[1]}`;

        const permanentDeletedPayment = details.match(/Permanently deleted payment (?:of )?(.+)/);
        if (permanentDeletedPayment) return `${t('audit.permanentDeletedPayment')}: ${permanentDeletedPayment[1]}`;

        // Invoice patterns
        const createdInvoice = details.match(/Created invoice: (.+)/);
        if (createdInvoice) return `${t('activity.createdInvoice')}: ${createdInvoice[1]}`;

        const deletedInvoice = details.match(/Deleted invoice: (.+)/);
        if (deletedInvoice) return `${t('activity.deletedInvoice')}: ${deletedInvoice[1]}`;

        const updatedInvoice = details.match(/Updated invoice: (.+)/);
        if (updatedInvoice) return `${t('activity.updatedInvoice')}: ${updatedInvoice[1]}`;

        const invoiceStatus = details.match(/Invoice (.+) status changed to (.+)/);
        if (invoiceStatus) return `${t('activity.updatedInvoice')}: ${invoiceStatus[1]} (${invoiceStatus[2]})`;

        const sentInvoice = details.match(/Sent invoice: (.+)/);
        if (sentInvoice) return `${t('status.sent')}: ${sentInvoice[1]}`;

        const duplicatedInvoice = details.match(/Duplicated from (.+) to (.+)/);
        if (duplicatedInvoice) return `${t('invoices.duplicate')}: ${duplicatedInvoice[1]} -> ${duplicatedInvoice[2]}`;

        // Client patterns
        const createdClient = details.match(/Created client: (.+)/);
        if (createdClient) return `${t('activity.createdClient')}: ${createdClient[1]}`;

        // Product patterns
        const createdProduct = details.match(/Created product: (.+)/);
        if (createdProduct) return `${t('activity.createdProduct')}: ${createdProduct[1]}`;

        // Payment patterns
        const payment = details.match(/Payment of (.+) for invoice (.+)/);
        if (payment) {
            return t('activity.paymentFor')
                .replace('{amount}', payment[1])
                .replace('{invoice}', payment[2]);
        }

        const refund = details.match(/Refund of (.+) for invoice (.+)/);
        if (refund) {
            return `${t('status.refund')}: ${refund[1]} - ${refund[2]}`;
        }

        const paymentRecorded = details.match(/Payment recorded: (.+)/);
        if (paymentRecorded) return `${t('payments.recordPayment')}: ${paymentRecorded[1]}`;

        const deletedPayment = details.match(/Deleted payment of (.+)/);
        if (deletedPayment) return `${t('common.delete')} ${t('status.payment')}: ${deletedPayment[1]}`;

        return details;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            <div>
                <h1 className="text-2xl font-bold text-foreground">{t('dashboard.title')}</h1>
                <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card">
                    <div className="flex items-center justify-between">
                        <div className="p-3 rounded-lg bg-green-500/10">
                            <DollarSign className="w-6 h-6 text-green-500" />
                        </div>
                        {stats?.revenueThisMonth > stats?.revenueLastMonth ? (
                            <TrendingUp className="w-5 h-5 text-green-500" />
                        ) : (
                            <TrendingDown className="w-5 h-5 text-red-500" />
                        )}
                    </div>
                    <p className="stat-card-value mt-4">{formatCurrency(stats?.revenueThisMonth || 0)}</p>
                    <p className="stat-card-label">{t('dashboard.revenueThisMonth')}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        {t('dashboard.lastMonth')}: {formatCurrency(stats?.revenueLastMonth || 0)}
                    </p>
                </div>

                <div className="stat-card">
                    <div className="flex items-center justify-between">
                        <div className="p-3 rounded-lg bg-blue-500/10">
                            <Clock className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>
                    <p className="stat-card-value mt-4">{formatCurrency(stats?.outstandingReceivables || 0)}</p>
                    <p className="stat-card-label">{t('dashboard.outstanding')}</p>
                </div>

                <div className="stat-card">
                    <div className="flex items-center justify-between">
                        <div className="p-3 rounded-lg bg-red-500/10">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                    </div>
                    <p className="stat-card-value mt-4">{formatCurrency(stats?.overdueAmount || 0)}</p>
                    <p className="stat-card-label">{t('dashboard.overdue')}</p>
                </div>

                <div className="stat-card">
                    <div className="flex items-center justify-between">
                        <div className="p-3 rounded-lg bg-purple-500/10">
                            <ArrowUpRight className="w-6 h-6 text-purple-500" />
                        </div>
                    </div>
                    <p className="stat-card-value mt-4">{formatCurrency(stats?.netProfit || 0)}</p>
                    <p className="stat-card-label">{t('dashboard.netProfit')}</p>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 bg-card rounded-xl border border-border p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">{t('dashboard.revenueOverview')}</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueChart}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="name"
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                />
                                <YAxis
                                    stroke="hsl(var(--muted-foreground))"
                                    fontSize={12}
                                    tickFormatter={(value) => `${settings?.currencySymbol || '$'}${value}`}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                    }}
                                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                                />
                                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Pie Chart */}
                <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">{t('dashboard.invoiceStatus')}</h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusChart}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {statusChart.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap justify-center gap-4 mt-4">
                        {statusChart.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-sm text-muted-foreground">
                                    {entry.name}: {entry.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Clients */}
                <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">{t('dashboard.topClients')}</h3>
                    <div className="space-y-4">
                        {clientChart.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">{t('dashboard.noDataYet')}</p>
                        ) : (
                            clientChart.map((client, index) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="text-primary font-semibold">
                                                {client.name?.charAt(0) || '?'}
                                            </span>
                                        </div>
                                        <span className="font-medium">{client.name}</span>
                                    </div>
                                    <span className="font-semibold">{formatCurrency(client.value)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">{t('dashboard.recentActivity')}</h3>
                    <div className="space-y-4">
                        {activity.length === 0 ? (
                            <p className="text-muted-foreground text-center py-8">{t('dashboard.noRecentActivity')}</p>
                        ) : (
                            activity.map((item, index) => (
                                <div key={index} className="flex items-start gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                                    <div className="flex-1">
                                        <p className="text-foreground">{formatActivity(item.details)}</p>
                                        <p className="text-muted-foreground text-xs">{formatDate(item.createdAt)}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
