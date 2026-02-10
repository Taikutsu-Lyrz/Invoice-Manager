import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Mail, Lock, AlertCircle, Loader, Globe, Eye, EyeOff, WifiOff, RefreshCw } from 'lucide-react';
import { parseFirebaseError, testFirebaseConnection } from '../utils/firebaseErrors';

interface LoginForm {
    email: string;
    password: string;
}

export default function Login() {
    const { login, resetPassword } = useAuth();
    const { t, isRTL, language, setLanguage } = useLanguage();
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [errorSuggestion, setErrorSuggestion] = useState('');
    const [isNetworkError, setIsNetworkError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [checkingConnection, setCheckingConnection] = useState(false);

    const { register, handleSubmit, formState: { errors }, watch } = useForm<LoginForm>();
    const email = watch('email');

    // Monitor online/offline status
    useEffect(() => {
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleRetryConnection = async () => {
        setCheckingConnection(true);
        setError('');
        setErrorSuggestion('');
        setIsNetworkError(false);

        const canConnect = await testFirebaseConnection();
        
        setCheckingConnection(false);
        
        if (canConnect) {
            setIsOffline(false);
        } else {
            const parsed = parseFirebaseError({ code: 'auth/network-request-failed' }, language);
            setError(parsed.message);
            setErrorSuggestion(parsed.suggestion || '');
            setIsNetworkError(true);
        }
    };

    const onSubmit = async (data: LoginForm) => {
        if (isOffline) {
            const parsed = parseFirebaseError({ code: 'auth/network-request-failed' }, language);
            setError(parsed.message);
            setErrorSuggestion(parsed.suggestion || '');
            setIsNetworkError(true);
            return;
        }

        setError('');
        setErrorSuggestion('');
        setIsNetworkError(false);
        setLoading(true);

        try {
            await login(data.email, data.password);
            navigate('/');
        } catch (err: any) {
            const parsed = parseFirebaseError(err, language);
            setError(parsed.message);
            setErrorSuggestion(parsed.suggestion || '');
            setIsNetworkError(parsed.isNetworkError);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            setError(t('auth.enterEmailFirst'));
            return;
        }

        if (isOffline) {
            const parsed = parseFirebaseError({ code: 'auth/network-request-failed' }, language);
            setError(parsed.message);
            setErrorSuggestion(parsed.suggestion || '');
            setIsNetworkError(true);
            return;
        }

        try {
            await resetPassword(email);
            setResetSent(true);
            setError('');
            setErrorSuggestion('');
            setIsNetworkError(false);
        } catch (err: any) {
            const parsed = parseFirebaseError(err, language);
            setError(parsed.message);
            setErrorSuggestion(parsed.suggestion || '');
            setIsNetworkError(parsed.isNetworkError);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <div className="w-full max-w-md">
                <div className="bg-card border border-border rounded-2xl p-8 shadow-xl relative">
                    {/* Language Switcher */}
                    <div className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'}`}>
                        <button
                            onClick={() => setLanguage(language === 'en' ? 'fa' : 'en')}
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Globe className="w-4 h-4" />
                            {language === 'en' ? 'فارسی' : 'English'}
                        </button>
                    </div>
                    {/* Logo/Title */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-primary mb-2">{t('auth.appName')}</h1>
                        <p className="text-muted-foreground">{t('auth.signInTitle')}</p>
                    </div>

                    {/* Offline Banner */}
                    {isOffline && (
                        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-yellow-500/10 text-yellow-500">
                            <WifiOff className="w-5 h-5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm font-medium">
                                    {language === 'fa' ? 'اتصال اینترنت قطع است' : 'You are offline'}
                                </p>
                            </div>
                            <button
                                onClick={handleRetryConnection}
                                disabled={checkingConnection}
                                className="p-1.5 rounded hover:bg-yellow-500/20 transition-colors"
                            >
                                <RefreshCw className={`w-4 h-4 ${checkingConnection ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className={`p-3 mb-4 rounded-lg ${isNetworkError ? 'bg-orange-500/10 text-orange-500' : 'bg-red-500/10 text-red-500'}`}>
                            <div className="flex items-start gap-2">
                                {isNetworkError ? (
                                    <WifiOff className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                ) : (
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{error}</p>
                                    {errorSuggestion && (
                                        <p className="text-xs mt-1 opacity-80">{errorSuggestion}</p>
                                    )}
                                </div>
                                {isNetworkError && (
                                    <button
                                        onClick={handleRetryConnection}
                                        disabled={checkingConnection}
                                        className="p-1.5 rounded hover:bg-orange-500/20 transition-colors"
                                        title={language === 'fa' ? 'تلاش مجدد' : 'Retry'}
                                    >
                                        <RefreshCw className={`w-4 h-4 ${checkingConnection ? 'animate-spin' : ''}`} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Reset Success */}
                    {resetSent && (
                        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-green-500/10 text-green-500">
                            <Mail className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm">Password reset email sent! Check your inbox.</p>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="form-group">
                            <label className="form-label">{t('common.email')}</label>
                            <div className="relative">
                                <Mail className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
                                <input
                                    type="email"
                                    {...register('email', { required: 'Email is required' })}
                                    className={`form-input ${isRTL ? '!pr-10 text-right' : '!pl-10'}`}
                                    placeholder={t('auth.emailPlaceholder')}
                                    dir="ltr"
                                />
                            </div>
                            {errors.email && <p className="form-error">{errors.email.message}</p>}
                        </div>

                        <div className="form-group">
                            <label className="form-label">{t('auth.password')}</label>
                            <div className="relative">
                                <Lock className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground ${isRTL ? 'right-3' : 'left-3'}`} />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    {...register('password', { required: 'Password is required' })}
                                    className={`form-input ${isRTL ? '!pr-10 !pl-10 text-right' : '!pl-10 !pr-10'}`}
                                    placeholder={t('auth.passwordPlaceholder')}
                                    dir="ltr"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${isRTL ? 'left-3' : 'right-3'}`}
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                            {errors.password && <p className="form-error">{errors.password.message}</p>}
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleResetPassword}
                                className="text-sm text-primary hover:underline"
                            >
                                {t('auth.forgotPassword')}
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-3"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader className="w-4 h-4 animate-spin" />
                                    {t('auth.signingIn')}
                                </span>
                            ) : (
                                t('auth.signIn')
                            )}
                        </button>
                    </form>

                    {/* Register Link */}
                    <div className="mt-6 text-center">
                        <span className="text-muted-foreground">{t('auth.noAccount')} </span>
                        <Link to="/register" className="text-primary hover:underline font-medium">
                            {t('auth.createAccount')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
