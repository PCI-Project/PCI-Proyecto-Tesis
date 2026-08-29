import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslations } from '../hooks/useTranslations';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ui/ThemeSwitcher';
import { Avatar } from './ui/Avatar';

const LoadingSpinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-text-inverted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const UserIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>;
const LockIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 0118 8zm-6-4a4 4 0 100 8 4 4 0 000-8z" clipRule="evenodd" /></svg>;
const CogIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0L8 5.69 5.69 5.25c-1.56-.38-2.62 1.06-1.16 2.16L6.69 9.5 5.25 11.81c-.38 1.56 1.06 2.62 2.16 1.16L9.5 13.31l2.31 1.44c1.56.38 2.62-1.06 1.16-2.16L13.31 10.5l1.44-2.31c.38-1.56-1.06-2.62-2.16-1.16L10.5 6.69l-1.44-2.31zM12 10a2 2 0 11-4 0 2 2 0 014 0z" clipRule="evenodd" /></svg>;
const WarningIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>;


interface ProfileViewProps {
    onInitiateDelete: () => void;
    onNavigate?: (view: any) => void;
}

type ProfileTab = 'info' | 'password' | 'settings' | 'admin' | 'danger';

export const ProfileView: React.FC<ProfileViewProps> = ({ onInitiateDelete, onNavigate }) => {
    const { t } = useTranslations();
    const { user, updateUser, changePassword, isLoading, error } = useAuth();
    const [activeTab, setActiveTab] = useState<ProfileTab>('info');
    
    const [formData, setFormData] = useState({
        name: '', company: '', jobTitle: '', country: '', phone: ''
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '', newPassword: '', confirmNewPassword: ''
    });
    const [feedback, setFeedback] = useState<{type: 'success' | 'error', message: string} | null>(null);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                company: user.company || '',
                jobTitle: user.jobTitle || '',
                country: user.country || '',
                phone: user.phone || ''
            });
        }
    }, [user]);

    const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => setPasswordData({ ...passwordData, [e.target.name]: e.target.value });

    const handleInfoSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFeedback(null);
    const success = await updateUser({
        name: formData.name,
        company: formData.company,
        jobTitle: formData.jobTitle,
        country: formData.country,
        phone: formData.phone
    });
        setFeedback({ type: success ? 'success' : 'error', message: success ? t('profile.updateSuccess') : error || t('profile.updateError') });
    };

    
    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFeedback(null);
        if (passwordData.newPassword.length < 6) { return setFeedback({ type: 'error', message: t('auth.errorPasswordLength') }); }
        if (passwordData.newPassword !== passwordData.confirmNewPassword) { return setFeedback({ type: 'error', message: t('auth.errorPasswordMatch') }); }
        
        const success = await changePassword(passwordData.currentPassword, passwordData.newPassword);
        if (success) {
            setFeedback({ type: 'success', message: t('profile.passwordUpdateSuccess') });
            setPasswordData({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
        } else {
            setFeedback({ type: 'error', message: error || t('profile.passwordUpdateError') });
        }
    }

    if (!user) return null;

    const navItems: { id: ProfileTab, label: string, icon: React.FC }[] = [
        { id: 'info', label: t('profile.personalInfo'), icon: UserIcon },
        { id: 'password', label: t('profile.passwordAndSecurity'), icon: LockIcon },
        { id: 'settings', label: t('profile.settings'), icon: CogIcon },
        ...(user?.role === 'admin' ? [{ id: 'admin' as ProfileTab, label: 'Panel de Administración', icon: CogIcon }] : []),
        { id: 'danger', label: t('profile.dangerZone'), icon: WarningIcon },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'info':
                return (
                    <form onSubmit={handleInfoSubmit} className="space-y-4">
                        <h3 className="text-xl font-bold text-text-base mb-4">{t('profile.personalInfo')}</h3>
                        <div className="grid md:grid-cols-2 gap-4">
                            <Input label={t('auth.fullName')} name="name" value={formData.name} onChange={handleInfoChange} required />
                            <Input label={t('auth.email')} name="email" value={user.email} disabled />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <Input label={t('auth.company')} name="company" value={formData.company} onChange={handleInfoChange} />
                            <Input label={t('auth.role')} name="jobTitle" value={formData.jobTitle} onChange={handleInfoChange} />
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <Input label={t('auth.country')} name="country" value={formData.country} onChange={handleInfoChange} />
                            <Input label={t('auth.phone')} name="phone" type="tel" value={formData.phone} onChange={handleInfoChange} />
                        </div>
                        <div className="pt-2 flex justify-end">
                            <Button type="submit" disabled={isLoading} className="flex items-center">
                                {isLoading && <LoadingSpinner />} {t('profile.saveChanges')}
                            </Button>
                        </div>
                    </form>
                );
            case 'password':
                return (
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                        <h3 className="text-xl font-bold text-text-base mb-4">{t('profile.changePassword')}</h3>
                        <Input label={t('profile.currentPassword')} name="currentPassword" type="password" value={passwordData.currentPassword} onChange={handlePasswordChange} required />
                        <Input label={t('profile.newPassword')} name="newPassword" type="password" value={passwordData.newPassword} onChange={handlePasswordChange} required />
                        <Input label={t('profile.confirmNewPassword')} name="confirmNewPassword" type="password" value={passwordData.confirmNewPassword} onChange={handlePasswordChange} required />
                        <div className="pt-2 flex justify-end">
                            <Button type="submit" variant="secondary" disabled={isLoading} className="flex items-center">
                                {isLoading && <LoadingSpinner />} {t('profile.updatePasswordButton')}
                            </Button>
                        </div>
                    </form>
                );
            case 'settings':
                return (
                    <div>
                        <h3 className="text-xl font-bold text-text-base mb-4">{t('profile.settings')}</h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center p-3 bg-bg-base/60 rounded-lg border border-border-muted">
                                <p className="font-semibold text-text-base">{t('header.language')}</p>
                                <LanguageSwitcher />
                            </div>
                            <div className="flex justify-between items-center p-3 bg-bg-base/60 rounded-lg border border-border-muted">
                                <p className="font-semibold text-text-base">{t('header.theme')}</p>
                                <ThemeSwitcher />
                            </div>
                        </div>
                    </div>
                );
            case 'danger':
                return (
                    <div>
                        <h3 className="text-xl font-bold text-danger mb-2">{t('profile.dangerZone')}</h3>
                        <p className="text-text-muted mb-4">{t('profile.deleteAccountDescription')}</p>
                        <div className="flex justify-end">
                            <Button variant="danger" onClick={onInitiateDelete}>
                                {t('profile.deleteAccount')}
                            </Button>
                        </div>
                    </div>
                );
            case 'admin':
                return (
                    <div className="space-y-6">
                        <h3 className="text-xl font-bold text-primary mb-2">Panel de Administración</h3>
                        <p className="text-text-muted mb-4">Como administrador, puedes editar las configuraciones globales que afectan a todos los usuarios.</p>
                        
                        <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-text-base">Gestión de Curvas de Corrección</h4>
                                    <p className="text-sm text-text-muted mt-1">Configura las curvas de deducción para los distintos métodos de falla y la curva general de corrección.</p>
                                </div>
                                <Button onClick={() => onNavigate && onNavigate('ADMIN_SETTINGS')} variant="primary">
                                    Ir a Configuración
                                </Button>
                            </div>
                        </div>
                    </div>
                );     
            default:
                return null;   
            }
    }

    return (
        <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-primary mb-6">{t('profile.title')}</h2>
            
             {feedback && (
                <div className={`p-4 mb-6 rounded-lg text-center font-semibold ${feedback.type === 'success' ? 'bg-green-500/20 text-green-700' : 'bg-danger/20 text-danger'}`}>
                    {feedback.message}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 md:gap-8">
                {/* Navigation */}
                <aside className="md:col-span-4 lg:col-span-3 flex flex-col gap-4">
                    <div className="flex flex-col items-center md:items-start p-4 bg-bg-surface rounded-lg border border-border-muted text-center md:text-left">
                        <Avatar name={user.name} className="h-24 w-24 text-4xl mb-3" />
                        <h3 className="font-bold text-xl text-text-base break-words">{user.name}</h3>
                        <p className="text-text-muted text-sm break-words">{user.email}</p>
                    </div>

                    <div className="flex overflow-x-auto md:flex-col md:overflow-x-visible md:space-y-2 pb-2 md:pb-0">
                        {navItems.map(item => {
                            const isActive = activeTab === item.id;
                            const isDanger = item.id === 'danger';
                            const classes = `flex items-center gap-3 w-full p-3 rounded-lg text-left font-semibold transition-colors whitespace-nowrap text-sm
                                ${isActive 
                                    ? isDanger ? 'bg-danger text-text-inverted' : 'bg-primary text-text-inverted'
                                    : isDanger ? 'text-danger hover:bg-danger/10' : 'text-text-base hover:bg-primary/10'
                                }`;
                            return (
                                <button key={item.id} onClick={() => setActiveTab(item.id)} className={classes}>
                                    <item.icon /> <span>{item.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </aside>
                
                {/* Content */}
                <main className="md:col-span-8 lg:col-span-9 mt-6 md:mt-0">
                    <Card>
                        {renderContent()}
                    </Card>
                </main>
            </div>
        </div>
    );
};