import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useLanguage } from '../contexts/LanguageContext';
import { useApp } from '../App';
import { useTheme } from '../contexts/ThemeContext';

export default function Tutorial() {
    const { t, language } = useLanguage();
    const { settings, profileId, refreshSettings } = useApp();
    const { theme } = useTheme();

    useEffect(() => {
        // Only show if settings loaded and not seen yet
        if (!settings || settings.hasSeenTutorial) return;

        const driverObj = driver({
            showProgress: true,
            animate: true,
            allowClose: true,
            // Adjust overlay color based on theme if needed, but default is usually fine
            // theme === 'dark' ? ...
            nextBtnText: t('tutorial.next'),
            prevBtnText: t('tutorial.prev'),
            doneBtnText: t('tutorial.done'),
            steps: [
                {
                    element: '#root', // Fallback or center
                    popover: {
                        title: t('tutorial.welcome.title'),
                        description: t('tutorial.welcome.desc'),
                        side: 'center',
                        align: 'center'
                    }
                },
                {
                    element: '#sidebar-dashboard',
                    popover: {
                        title: t('tutorial.dashboard.title'),
                        description: t('tutorial.dashboard.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                },
                {
                    element: '#sidebar-invoices',
                    popover: {
                        title: t('tutorial.invoices.title'),
                        description: t('tutorial.invoices.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                },
                {
                    element: '#sidebar-clients',
                    popover: {
                        title: t('tutorial.clients.title'),
                        description: t('tutorial.clients.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                },
                {
                    element: '#sidebar-products',
                    popover: {
                        title: t('tutorial.products.title'),
                        description: t('tutorial.products.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                },
                {
                    element: '#sidebar-payments',
                    popover: {
                        title: t('tutorial.payments.title'),
                        description: t('tutorial.payments.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                },
                {
                    element: '#sidebar-expenses',
                    popover: {
                        title: t('tutorial.expenses.title'),
                        description: t('tutorial.expenses.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                },
                {
                    element: '#sidebar-reports',
                    popover: {
                        title: t('tutorial.reports.title'),
                        description: t('tutorial.reports.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                },
                {
                    element: '#sidebar-settings',
                    popover: {
                        title: t('tutorial.settings.title'),
                        description: t('tutorial.settings.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                },
                {
                    element: '#sidebar-backup',
                    popover: {
                        title: t('tutorial.backup.title'),
                        description: t('tutorial.backup.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                },
                {
                    element: '#sidebar-trash',
                    popover: {
                        title: t('tutorial.trash.title'),
                        description: t('tutorial.trash.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                },
                {
                    element: '#sidebar-conflicts',
                    popover: {
                        title: t('tutorial.conflicts.title'),
                        description: t('tutorial.conflicts.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                },
                {
                    element: '#sidebar-users',
                    popover: {
                        title: t('tutorial.users.title'),
                        description: t('tutorial.users.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                },
                {
                    element: '#sidebar-sync',
                    popover: {
                        title: t('tutorial.sync.title'),
                        description: t('tutorial.sync.desc'),
                        side: language === 'fa' ? 'left' : 'right'
                    }
                }
            ],
            onDestroyStarted: async () => {
                // If user clicks close or finishes, mark as seen
                // Check if driverObj is currently active or if this is called on destroy
                driverObj.destroy();
            },
            onDestroyed: async () => {
                // Mark as seen in DB
                try {
                    await window.electronAPI.updateSettings(profileId, {
                        ...settings,
                        hasSeenTutorial: true
                    });
                    await refreshSettings();
                } catch (err) {
                    console.error('Failed to mark tutorial as seen', err);
                }
            }
        });

        // Small timeout to ensure DOM is ready
        const timer = setTimeout(() => {
            driverObj.drive();
        }, 1000);

        return () => {
            clearTimeout(timer);
            // Don't destroy here automatically as it might trigger the save on unmount of component
            // But strict mode might trigger this double.
            // We only want to save if the User finished it.
            // Actually, `onDestroyed` handles it.
        };
    }, [settings, t, language, profileId, refreshSettings]);

    return null; // Logic only component
}
