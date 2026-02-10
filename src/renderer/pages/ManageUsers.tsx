import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../components/Toast';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
    Users,
    UserPlus,
    Shield,
    User,
    Mail,
    X,
    Loader,
    Crown,
    AlertTriangle,
    Trash2,
    Lock
} from 'lucide-react';

interface ChildUser {
    uid: string;
    email: string;
    displayName: string;
    role: 'mother' | 'child';
    createdAt: any;
}

export default function ManageUsers() {
    const { userProfile, isMother, createChildUser, deleteUser } = useAuth();
    const { t, isRTL } = useLanguage();
    const { showToast } = useToast();
    const [users, setUsers] = useState<ChildUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    // Form state
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [motherPassword, setMotherPassword] = useState('');

    useEffect(() => {
        if (userProfile?.tenantId) {
            loadUsers();
        }
    }, [userProfile?.tenantId]);

    const loadUsers = async () => {
        if (!userProfile?.tenantId) return;

        try {
            const usersQuery = query(
                collection(db, 'userProfiles'),
                where('tenantId', '==', userProfile.tenantId)
            );
            const snapshot = await getDocs(usersQuery);
            const usersData = snapshot.docs.map(doc => doc.data() as ChildUser);
            setUsers(usersData);
        } catch (error) {
            console.error('Failed to load users:', error);
            showToast('Failed to load users', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserEmail || !newUserPassword || !newUserName || !motherPassword) {
            showToast('Please fill all fields including your password', 'error');
            return;
        }

        setCreating(true);
        try {
            await createChildUser(newUserEmail, newUserPassword, newUserName, motherPassword);
            showToast('Child user created successfully!', 'success');
            setModalOpen(false);
            setNewUserEmail('');
            setNewUserPassword('');
            setNewUserName('');
            setMotherPassword('');
            // Reload users list
            await loadUsers();
        } catch (error: any) {
            showToast(error.message || 'Failed to create user', 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user?')) return;

        setDeleting(userId);
        try {
            await deleteUser(userId);
            showToast('User deleted successfully', 'success');
            await loadUsers();
        } catch (error: any) {
            showToast(error.message || 'Failed to delete user', 'error');
        } finally {
            setDeleting(null);
        }
    };

    // Only mother can access this page
    if (!isMother) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
                    <p className="text-muted-foreground">Only admin accounts can manage users.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('users.title')}</h1>
                    <p className="text-muted-foreground">{t('users.subtitle')}</p>
                </div>
                <button onClick={() => setModalOpen(true)} className="btn-primary">
                    <UserPlus className="w-4 h-4" />
                    {t('users.addUser')}
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{users.length}</p>
                            <p className="text-sm text-muted-foreground">{t('users.totalUsers')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                            <Crown className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{users.filter(u => u.role === 'mother').length}</p>
                            <p className="text-sm text-muted-foreground">{t('users.admins')}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{users.filter(u => u.role === 'child').length}</p>
                            <p className="text-sm text-muted-foreground">{t('users.childUsers')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Users List */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-secondary/50 border-b border-border">
                        <tr>
                            <th className={`${isRTL ? 'text-right' : 'text-left'} p-4 text-sm font-medium text-muted-foreground`}>{t('users.user')}</th>
                            <th className={`${isRTL ? 'text-right' : 'text-left'} p-4 text-sm font-medium text-muted-foreground`}>{t('users.email')}</th>
                            <th className={`${isRTL ? 'text-right' : 'text-left'} p-4 text-sm font-medium text-muted-foreground`}>{t('users.role')}</th>
                            <th className={`${isRTL ? 'text-right' : 'text-left'} p-4 text-sm font-medium text-muted-foreground`}>{t('users.status')}</th>
                            <th className={`${isRTL ? 'text-left' : 'text-right'} p-4 text-sm font-medium text-muted-foreground`}>{t('users.actions')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center">
                                    <Loader className="w-6 h-6 animate-spin mx-auto text-primary" />
                                </td>
                            </tr>
                        ) : users.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                                    {t('users.noUsers') || 'No users yet'}
                                </td>
                            </tr>
                        ) : (
                            users.map((user) => (
                                <tr key={user.uid} className="border-b border-border hover:bg-secondary/30">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                {user.role === 'mother' ? (
                                                    <Crown className="w-5 h-5 text-yellow-500" />
                                                ) : (
                                                    <User className="w-5 h-5 text-primary" />
                                                )}
                                            </div>
                                            <span className="font-medium">{user.displayName}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-muted-foreground">{user.email}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'mother'
                                            ? 'bg-yellow-500/10 text-yellow-500'
                                            : 'bg-blue-500/10 text-blue-500'
                                            }`}>
                                            {user.role === 'mother' ? t('users.admin') : t('users.user')}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-500">
                                            {t('users.active')}
                                        </span>
                                    </td>
                                    <td className={`p-4 ${isRTL ? 'text-left' : 'text-right'}`}>
                                        {user.role !== 'mother' && (
                                            <button
                                                onClick={() => handleDeleteUser(user.uid)}
                                                disabled={deleting === user.uid}
                                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                                title="Delete user"
                                            >
                                                {deleting === user.uid ? (
                                                    <Loader className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Create User Modal */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 animate-slideUp">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold">{t('users.createChildUser')}</h2>
                            <button onClick={() => setModalOpen(false)} className="btn-icon">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div className="form-group">
                                <label className="form-label">{t('common.name')} *</label>
                                <div className="relative">
                                    <User className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none`} />
                                    <input
                                        type="text"
                                        value={newUserName}
                                        onChange={(e) => setNewUserName(e.target.value)}
                                        className={`w-full py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${isRTL ? 'pr-12 pl-3' : 'pl-12 pr-3'}`}
                                        placeholder={t('users.userNamePlaceholder')}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('common.email')} *</label>
                                <div className="relative">
                                    <Mail className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none`} />
                                    <input
                                        type="email"
                                        value={newUserEmail}
                                        onChange={(e) => setNewUserEmail(e.target.value)}
                                        className={`w-full py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${isRTL ? 'pr-12 pl-3' : 'pl-12 pr-3'}`}
                                        placeholder="user@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('users.userPassword')} *</label>
                                <div className="relative">
                                    <Shield className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none`} />
                                    <input
                                        type="password"
                                        value={newUserPassword}
                                        onChange={(e) => setNewUserPassword(e.target.value)}
                                        className={`w-full py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${isRTL ? 'pr-12 pl-3' : 'pl-12 pr-3'}`}
                                        placeholder="••••••••"
                                        minLength={6}
                                        required
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{t('users.minChars')}</p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('users.adminPassword')} *</label>
                                <div className="relative">
                                    <Lock className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none`} />
                                    <input
                                        type="password"
                                        value={motherPassword}
                                        onChange={(e) => setMotherPassword(e.target.value)}
                                        className={`w-full py-2 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all ${isRTL ? 'pr-12 pl-3' : 'pl-12 pr-3'}`}
                                        placeholder={t('users.adminPasswordPlaceholder')}
                                        required
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{t('users.reauthNote')}</p>
                            </div>

                            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 text-sm">
                                <p>{t('users.addUserNote')}</p>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" disabled={creating} className="btn-primary">
                                    {creating ? (
                                        <span className="flex items-center gap-2">
                                            <Loader className="w-4 h-4 animate-spin" />
                                            {t('users.creating')}
                                        </span>
                                    ) : (
                                        <>
                                            <UserPlus className="w-4 h-4" />
                                            {t('users.createUser')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
