import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

interface ConfirmButtonProps {
    onConfirm: () => void;
    children: React.ReactNode;
    confirmText?: string;
    className?: string;
    confirmClassName?: string;
    timeout?: number; // Time in ms before reverting to normal state
}

export function ConfirmButton({
    onConfirm,
    children,
    confirmText = 'Click again to confirm',
    className = 'btn-icon text-red-500',
    confirmClassName = 'bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 transition-colors',
    timeout = 3000,
}: ConfirmButtonProps) {
    const { t } = useLanguage();
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        if (isConfirming) {
            const timer = setTimeout(() => {
                setIsConfirming(false);
            }, timeout);
            return () => clearTimeout(timer);
        }
    }, [isConfirming, timeout]);

    const handleClick = () => {
        if (isConfirming) {
            onConfirm();
            setIsConfirming(false);
        } else {
            setIsConfirming(true);
        }
    };

    return (
        <button
            onClick={handleClick}
            className={isConfirming ? confirmClassName : className}
            title={isConfirming ? 'Click to confirm' : undefined}
        >
            {isConfirming ? (confirmText || t('common.clickToConfirm')) : children}
        </button>
    );
}
