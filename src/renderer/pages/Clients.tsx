import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClientSchema, type CreateClientInput } from '@shared/schemas/client.schema';
import { Plus, Search, Edit, Trash, X, Users } from 'lucide-react';
import { useToast } from '../components/Toast';
import { ConfirmButton } from '../components/ConfirmButton';
import { useLanguage } from '../contexts/LanguageContext';

export default function Clients() {
    const { profileId } = useApp();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<CreateClientInput>({
        resolver: zodResolver(createClientSchema),
    });

    useEffect(() => {
        loadClients();
    }, [profileId]);

    useEffect(() => {
        const timer = setTimeout(() => loadClients(), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const loadClients = async () => {
        try {
            const data = await window.electronAPI.listClients(profileId, search || undefined);
            setClients(data);
        } catch (error) {
            console.error('Failed to load clients:', error);
        } finally {
            setLoading(false);
        }
    };

    const openModal = (client?: any) => {
        if (client) {
            setEditingId(client.id);
            reset({
                name: client.name,
                email: client.email || '',
                phone: client.phone || '',
                billingAddress: client.billingAddress,
                shippingAddress: client.shippingAddress || '',
                taxNumber: client.taxNumber || '',
                notes: client.notes || '',
            });
        } else {
            setEditingId(null);
            reset({ name: '', email: '', phone: '', billingAddress: '', shippingAddress: '', taxNumber: '', notes: '' });
        }
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingId(null);
        reset();
    };

    const onSubmit = async (data: CreateClientInput) => {
        try {
            if (editingId) {
                await window.electronAPI.updateClient(editingId, data);
                showToast('Client updated successfully', 'success');
            } else {
                await window.electronAPI.createClient(profileId, data);
                showToast('Client created successfully', 'success');
            }
            closeModal();
            loadClients();
        } catch (error: any) {
            showToast(error.message || 'Failed to save client', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await window.electronAPI.deleteClient(id);
            showToast('Client deleted successfully', 'success');
            loadClients();
        } catch (error: any) {
            showToast(error.message || 'Failed to delete client', 'error');
        }
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">{t('clients.title')}</h1>
                    <p className="text-muted-foreground">{t('clients.subtitle')}</p>
                </div>
                <button onClick={() => openModal()} className="btn-primary">
                    <Plus className="w-4 h-4" />
                    {t('clients.addClient')}
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
            ) : clients.length === 0 ? (
                <div className="text-center py-16">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">{t('empty.noClients')}</h3>
                    <p className="text-muted-foreground mb-4">{t('empty.addFirstClient')}</p>
                    <button onClick={() => openModal()} className="btn-primary">
                        <Plus className="w-4 h-4" />
                        {t('clients.addClient')}
                    </button>
                </div>
            ) : (
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('table.name')}</th>
                                <th>{t('table.email')}</th>
                                <th>{t('table.phone')}</th>
                                <th>{t('table.address')}</th>
                                <th className="w-24">{t('table.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clients.map((client) => (
                                <tr key={client.id}>
                                    <td className="font-medium">{client.name}</td>
                                    <td>{client.email || '-'}</td>
                                    <td>{client.phone || '-'}</td>
                                    <td className="max-w-xs truncate">{client.billingAddress}</td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => openModal(client)} className="btn-icon">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <ConfirmButton
                                                onConfirm={() => handleDelete(client.id)}
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
                            <h2 className="text-xl font-semibold">{editingId ? t('clients.editClient') : t('clients.addClient')}</h2>
                            <button onClick={closeModal} className="btn-icon">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="form-group">
                                <label className="form-label">{t('common.name')} *</label>
                                <input {...register('name')} className="form-input" placeholder={t('clients.title')} />
                                {errors.name && <p className="form-error">{errors.name.message}</p>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">{t('common.email')}</label>
                                    <input {...register('email')} type="email" className="form-input" placeholder="email@example.com" />
                                    {errors.email && <p className="form-error">{errors.email.message}</p>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('common.phone')}</label>
                                    <input {...register('phone')} className="form-input" placeholder="+1 234 567 890" />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('form.billingAddress')} *</label>
                                <textarea {...register('billingAddress')} className="form-input h-20 resize-none" placeholder={t('common.address')} />
                                {errors.billingAddress && <p className="form-error">{errors.billingAddress.message}</p>}
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('form.shippingAddress')}</label>
                                <textarea {...register('shippingAddress')} className="form-input h-20 resize-none" placeholder={t('form.shippingAddress')} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="form-group">
                                    <label className="form-label">{t('form.taxNumber')}</label>
                                    <input {...register('taxNumber')} className="form-input" placeholder={t('form.taxNumber')} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">{t('common.notes')}</label>
                                <textarea {...register('notes')} className="form-input h-16 resize-none" placeholder={t('common.notes')} />
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={closeModal} className="btn-secondary">
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" disabled={isSubmitting} className="btn-primary">
                                    {isSubmitting ? t('settings.saving') : editingId ? t('form.update') : t('common.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

