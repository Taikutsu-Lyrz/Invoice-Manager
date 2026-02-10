// Firebase error codes and their user-friendly messages
// https://firebase.google.com/docs/auth/admin/errors

interface FirebaseErrorInfo {
    message: string;
    messageFa: string;
    suggestion?: string;
    suggestionFa?: string;
}

const firebaseErrorMessages: Record<string, FirebaseErrorInfo> = {
    // Network errors
    'auth/network-request-failed': {
        message: 'Network connection failed. Please check your internet connection.',
        messageFa: 'اتصال به شبکه ناموفق بود. لطفا اتصال اینترنت خود را بررسی کنید.',
        suggestion: 'Try: 1) Check your internet connection 2) Disable VPN/proxy 3) Check firewall settings 4) Restart the app',
        suggestionFa: 'راهنما: ۱) اتصال اینترنت را بررسی کنید ۲) VPN/پروکسی را غیرفعال کنید ۳) تنظیمات فایروال را بررسی کنید ۴) برنامه را مجددا راه‌اندازی کنید'
    },
    'auth/timeout': {
        message: 'Connection timed out. Please try again.',
        messageFa: 'زمان اتصال به پایان رسید. لطفا دوباره تلاش کنید.'
    },
    
    // Authentication errors
    'auth/invalid-email': {
        message: 'Invalid email address format.',
        messageFa: 'فرمت آدرس ایمیل نامعتبر است.'
    },
    'auth/user-disabled': {
        message: 'This account has been disabled.',
        messageFa: 'این حساب کاربری غیرفعال شده است.'
    },
    'auth/user-not-found': {
        message: 'No account found with this email.',
        messageFa: 'حسابی با این ایمیل یافت نشد.'
    },
    'auth/wrong-password': {
        message: 'Incorrect password.',
        messageFa: 'رمز عبور اشتباه است.'
    },
    'auth/invalid-credential': {
        message: 'Invalid email or password.',
        messageFa: 'ایمیل یا رمز عبور نامعتبر است.'
    },
    'auth/email-already-in-use': {
        message: 'An account with this email already exists.',
        messageFa: 'حسابی با این ایمیل قبلا وجود دارد.'
    },
    'auth/weak-password': {
        message: 'Password is too weak. Use at least 6 characters.',
        messageFa: 'رمز عبور ضعیف است. حداقل ۶ کاراکتر استفاده کنید.'
    },
    'auth/operation-not-allowed': {
        message: 'This sign-in method is not enabled.',
        messageFa: 'این روش ورود فعال نیست.'
    },
    'auth/too-many-requests': {
        message: 'Too many failed attempts. Please try again later.',
        messageFa: 'تلاش‌های ناموفق زیاد. لطفا بعدا دوباره تلاش کنید.',
        suggestion: 'Wait a few minutes before trying again, or reset your password.',
        suggestionFa: 'چند دقیقه صبر کنید یا رمز عبور خود را بازنشانی کنید.'
    },
    'auth/requires-recent-login': {
        message: 'Please log out and log in again to perform this action.',
        messageFa: 'لطفا خارج شوید و دوباره وارد شوید تا این عملیات انجام شود.'
    },
    
    // Token/session errors
    'auth/expired-action-code': {
        message: 'This link has expired. Please request a new one.',
        messageFa: 'این لینک منقضی شده است. لطفا یک لینک جدید درخواست کنید.'
    },
    'auth/invalid-action-code': {
        message: 'This link is invalid. It may have been used already.',
        messageFa: 'این لینک نامعتبر است. ممکن است قبلا استفاده شده باشد.'
    },
    
    // Quota errors
    'auth/quota-exceeded': {
        message: 'Service temporarily unavailable. Please try again later.',
        messageFa: 'سرویس موقتا در دسترس نیست. لطفا بعدا دوباره تلاش کنید.'
    },
    
    // Internal errors
    'auth/internal-error': {
        message: 'An internal error occurred. Please try again.',
        messageFa: 'خطای داخلی رخ داد. لطفا دوباره تلاش کنید.'
    }
};

export interface ParsedFirebaseError {
    code: string;
    message: string;
    suggestion?: string;
    isNetworkError: boolean;
    isAuthError: boolean;
}

/**
 * Parse a Firebase error and return user-friendly information
 */
export function parseFirebaseError(error: any, language: 'en' | 'fa' = 'en'): ParsedFirebaseError {
    // Extract error code from Firebase error
    let code = 'unknown';
    
    if (error?.code) {
        code = error.code;
    } else if (typeof error?.message === 'string') {
        // Try to extract code from message like "Firebase: Error (auth/network-request-failed)."
        const match = error.message.match(/\(([^)]+)\)/);
        if (match) {
            code = match[1];
        }
    }
    
    const errorInfo = firebaseErrorMessages[code];
    const isNetworkError = code === 'auth/network-request-failed' || code === 'auth/timeout';
    const isAuthError = code.startsWith('auth/');
    
    if (errorInfo) {
        return {
            code,
            message: language === 'fa' ? errorInfo.messageFa : errorInfo.message,
            suggestion: language === 'fa' ? errorInfo.suggestionFa : errorInfo.suggestion,
            isNetworkError,
            isAuthError
        };
    }
    
    // Fallback for unknown errors
    return {
        code,
        message: language === 'fa' 
            ? 'خطایی رخ داد. لطفا دوباره تلاش کنید.'
            : 'An error occurred. Please try again.',
        isNetworkError,
        isAuthError
    };
}

/**
 * Check if the device is online
 */
export function isOnline(): boolean {
    return navigator.onLine;
}

/**
 * Test Firebase connectivity by checking if we can reach Firebase endpoints
 */
export async function testFirebaseConnection(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('https://identitytoolkit.googleapis.com/', {
            method: 'HEAD',
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        return response.ok || response.status === 400; // 400 means server is reachable
    } catch {
        return false;
    }
}
