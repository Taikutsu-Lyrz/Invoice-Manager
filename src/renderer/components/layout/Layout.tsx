import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../../App';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useSync } from '../../contexts/SyncContext';
import {
    LayoutDashboard,
    FileText,
    Users,
    Package,
    CreditCard,
    Receipt,
    BarChart3,
    Settings,
    Database,
    Search,
    LogOut,
    Cloud,
    RefreshCw,
    AlertTriangle,
    Trash2,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

const navItems = [
    { path: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { path: '/invoices', icon: FileText, labelKey: 'nav.invoices' },
    { path: '/clients', icon: Users, labelKey: 'nav.clients' },
    { path: '/products', icon: Package, labelKey: 'nav.products' },
    { path: '/payments', icon: CreditCard, labelKey: 'nav.payments' },
    { path: '/expenses', icon: Receipt, labelKey: 'nav.expenses' },
    { path: '/reports', icon: BarChart3, labelKey: 'nav.reports' },
    { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
    { path: '/backup', icon: Database, labelKey: 'nav.backup' },
    { path: '/trash', icon: Trash2, labelKey: 'nav.trash' },
    { path: '/conflicts', icon: AlertTriangle, labelKey: 'nav.conflicts' },
    { path: '/users', icon: Users, labelKey: 'nav.users', motherOnly: true },
];

export default function Layout({ children }: { children: React.ReactNode }) {
    const { settings, profileId } = useApp();
    const { t } = useLanguage();
    const { userProfile, logout } = useAuth();
    const { isSyncing, lastSyncTime, syncAll } = useSync();
    const navigate = useNavigate();
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any>(null);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const handleSync = async () => {
        await syncAll(profileId);
    };

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Ctrl+K for search
        if (e.ctrlKey && e.key === 'k') {
            e.preventDefault();
            setSearchOpen(true);
        }
        // Ctrl+N for new invoice
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            navigate('/invoices/new');
        }
        // Escape to close search
        if (e.key === 'Escape') {
            setSearchOpen(false);
        }
    }, [navigate]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.trim().length >= 2) {
            const results = await window.electronAPI.globalSearch(profileId, query);
            setSearchResults(results);
        } else {
            setSearchResults(null);
        }
    };

    const handleResultClick = (type: string, id: string) => {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults(null);

        if (type === 'invoice') navigate(`/invoices/${id}`);
        else if (type === 'client') navigate('/clients');
        else if (type === 'product') navigate('/products');
    };

    return (
        <div className="flex h-screen bg-background">
            {/* Sidebar */}
            <aside className="w-64 bg-card border-r border-border flex flex-col">
                {/* Logo & Sync */}
                <div className="p-6 border-b border-border">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold text-primary">
                            {settings?.companyName || 'Invoice Manager'}
                        </h1>
                        <button
                            onClick={handleSync}
                            disabled={isSyncing}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                            title={lastSyncTime ? `Last synced: ${lastSyncTime.toLocaleTimeString()}` : 'Sync to cloud'}
                        >
                            {isSyncing ? (
                                <RefreshCw className="w-5 h-5 animate-spin" />
                            ) : (
                                <Cloud className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {navItems
                        .filter(item => !item.motherOnly || userProfile?.role === 'mother')
                        .map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                                    }`
                                }
                                id={`sidebar-${item.path.replace('/', '') || 'dashboard'}`}
                            >
                                <item.icon className="w-5 h-5" />
                                {t(item.labelKey)}
                            </NavLink>
                        ))}
                </nav>

                {/* Footer with User Info */}
                <div className="p-4 border-t border-border space-y-3">
                    {userProfile && (
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{userProfile.displayName}</p>
                                <p className="text-xs text-muted-foreground truncate">{userProfile.role === 'mother' ? 'Admin' : 'User'}</p>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Logout"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    <p className="text-xs text-muted-foreground text-center">
                        Invoice Manager v1.0.0
                    </p>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/50">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors w-64"
                        >
                            <Search className="w-4 h-4" />
                            <span className="text-sm">{t('common.searchPlaceholder')}</span>
                            <kbd className="ml-auto text-xs bg-background px-1.5 py-0.5 rounded">⌘K</kbd>
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/invoices/new')}
                            className="btn-primary text-sm"
                        >
                            {t('invoices.new')}
                        </button>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto p-6">
                    {children}
                </div>
            </main>

            {/* Search Modal */}
            {searchOpen && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-start justify-center pt-24 z-50"
                    onClick={() => setSearchOpen(false)}
                >
                    <div
                        className="w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl animate-slideUp"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 p-4 border-b border-border">
                            <Search className="w-5 h-5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search invoices, clients, products..."
                                className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                autoFocus
                            />
                            <kbd className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">ESC</kbd>
                        </div>

                        {searchResults && (
                            <div className="max-h-96 overflow-y-auto p-2">
                                {searchResults.invoices?.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-xs font-medium text-muted-foreground px-2 py-1">Invoices</p>
                                        {searchResults.invoices.map((item: any) => (
                                            <button
                                                key={item.id}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-left"
                                                onClick={() => handleResultClick('invoice', item.id)}
                                            >
                                                <FileText className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-sm font-medium">{item.title}</p>
                                                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {searchResults.clients?.length > 0 && (
                                    <div className="mb-4">
                                        <p className="text-xs font-medium text-muted-foreground px-2 py-1">Clients</p>
                                        {searchResults.clients.map((item: any) => (
                                            <button
                                                key={item.id}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-left"
                                                onClick={() => handleResultClick('client', item.id)}
                                            >
                                                <Users className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-sm font-medium">{item.title}</p>
                                                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {searchResults.products?.length > 0 && (
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground px-2 py-1">Products</p>
                                        {searchResults.products.map((item: any) => (
                                            <button
                                                key={item.id}
                                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary text-left"
                                                onClick={() => handleResultClick('product', item.id)}
                                            >
                                                <Package className="w-4 h-4 text-muted-foreground" />
                                                <div>
                                                    <p className="text-sm font-medium">{item.title}</p>
                                                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {!searchResults.invoices?.length && !searchResults.clients?.length && !searchResults.products?.length && (
                                    <p className="text-center text-muted-foreground py-8">No results found</p>
                                )}
                            </div>
                        )}

                        {!searchResults && (
                            <div className="p-8 text-center text-muted-foreground">
                                <p>Type to search across invoices, clients, and products</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
