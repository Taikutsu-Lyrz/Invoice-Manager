import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import Layout from './components/layout/Layout';
import { ToastProvider } from './components/Toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SyncProvider } from './contexts/SyncContext';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import InvoiceEditor from './pages/InvoiceEditor';
import Clients from './pages/Clients';
import Products from './pages/Products';
import Payments from './pages/Payments';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Backup from './pages/Backup';
import Login from './pages/Login';
import Register from './pages/Register';
import ManageUsers from './pages/ManageUsers';
import Conflicts from './pages/Conflicts';
import Trash from './pages/Trash';
import Tutorial from './components/Tutorial';

interface AppContextType {
    profileId: string;
    settings: any;
    refreshSettings: () => Promise<void>;
}

export const AppContext = createContext<AppContextType>({
    profileId: '',
    settings: null,
    refreshSettings: async () => { },
});

export const useApp = () => useContext(AppContext);

// Protected Route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const { t } = useLanguage();

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground">{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}

// Main App Content
function AppContent() {
    const [profileId, setProfileId] = useState<string>('');
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const { user, userProfile } = useAuth();
    const { t } = useLanguage();

    const loadProfile = async () => {
        try {
            if (!user || !userProfile) {
                setLoading(false);
                return;
            }

            // Use tenantId as profile to share data between mother and child users
            // This ensures all users within the same tenant/company see the same data
            const profile = await window.electronAPI.getOrCreateProfileForUser({
                firebaseUid: user.uid,
                tenantId: userProfile.tenantId,
                displayName: userProfile.displayName || 'My Company',
                useSharedTenantData: true // Use tenantId so mother and children share data
            });

            setProfileId(profile.id);
            const profileSettings = await window.electronAPI.getSettings(profile.id);
            setSettings(profileSettings);
        } catch (error) {
            console.error('Failed to load profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const refreshSettings = async () => {
        if (profileId) {
            const profileSettings = await window.electronAPI.getSettings(profileId);
            setSettings(profileSettings);
        }
    };

    useEffect(() => {
        if (user && userProfile) {
            loadProfile();
        } else if (!user) {
            setProfileId('');
            setSettings(null);
            setLoading(false);
        }
    }, [user, userProfile]);

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <h2 className="text-xl font-semibold text-foreground">{t('tutorial.welcome.title')}</h2>
                    <p className="text-muted-foreground">{t('common.loadingApp')}</p>
                </div>
            </div>
        );
    }

    if (!profileId && user) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-foreground mb-4">{t('tutorial.welcome.title')}</h1>
                    <p className="text-muted-foreground mb-6">{t('common.profileError')}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn-primary"
                    >
                        {t('common.retry')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <AppContext.Provider value={{ profileId, settings, refreshSettings }}>
            <Routes>
                {/* Auth Routes (public) */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Routes */}
                <Route path="/" element={
                    <ProtectedRoute>
                        <Layout><Dashboard /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/invoices" element={
                    <ProtectedRoute>
                        <Layout><Invoices /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/invoices/new" element={
                    <ProtectedRoute>
                        <Layout><InvoiceEditor /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/invoices/:id" element={
                    <ProtectedRoute>
                        <Layout><InvoiceEditor /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/clients" element={
                    <ProtectedRoute>
                        <Layout><Clients /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/products" element={
                    <ProtectedRoute>
                        <Layout><Products /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/payments" element={
                    <ProtectedRoute>
                        <Layout><Payments /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/expenses" element={
                    <ProtectedRoute>
                        <Layout><Expenses /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/reports" element={
                    <ProtectedRoute>
                        <Layout><Reports /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/settings" element={
                    <ProtectedRoute>
                        <Layout><Settings /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/backup" element={
                    <ProtectedRoute>
                        <Layout><Backup /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/users" element={
                    <ProtectedRoute>
                        <Layout><ManageUsers /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/conflicts" element={
                    <ProtectedRoute>
                        <Layout><Conflicts /></Layout>
                    </ProtectedRoute>
                } />
                <Route path="/trash" element={
                    <ProtectedRoute>
                        <Layout><Trash /></Layout>
                    </ProtectedRoute>
                } />

                {/* Catch all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <Tutorial />
        </AppContext.Provider>
    );
}

export default function App() {
    return (
        <ThemeProvider>
            <LanguageProvider>
                <AuthProvider>
                    <ToastProvider>
                        <SyncProvider>
                            <AppContent />
                        </SyncProvider>
                    </ToastProvider>
                </AuthProvider>
            </LanguageProvider>
        </ThemeProvider>
    );
}
