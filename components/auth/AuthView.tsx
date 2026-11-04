import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Logo } from '../ui/Logo';
import { Login } from './Login';
import { SignUp } from './SignUp';
import { ForgotPassword } from './ForgotPassword';
import { useTranslations } from '../../hooks/useTranslations';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';

type View = 'login' | 'signup' | 'forgot';

export const AuthView: React.FC = () => {
    const { t } = useTranslations();
    const [view, setView] = useState<View>('login');

    const toggleView = () => {
        setView(v => v === 'login' ? 'signup' : 'login');
    }
    
    const renderAuthContent = () => {
        if (view === 'login') return <Login onForgot={() => setView('forgot')} />;
        if (view === 'forgot') return <ForgotPassword onBack={() => setView('login')} />;
        if (view === 'signup') {
            return <SignUp />;
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-bg-base p-4">
            <div className="w-full max-w-5xl relative">
                <div className={`grid md:grid-cols-2 bg-bg-surface shadow-xl rounded-2xl overflow-hidden border border-border-muted transition-all duration-300`}>
                    {/* Left Panel: Branding */}
                    <div className="hidden md:flex flex-col items-center justify-center bg-primary p-12 text-center text-text-inverted">
                        <img src="/brand/emblema-sobre-turquesa.svg" alt="" aria-hidden="true" className="h-[190px] w-auto" />
                        <h1 className="mt-6 text-[44px] font-bold leading-none tracking-tight text-white">
                            Asphalt<span className="text-[#1D2A33]">PCI</span><small className="ml-2 font-mono text-[18px] font-semibold tracking-[0.04em] text-white/75">PRO</small>
                        </h1>
                        <p className="mt-4 text-lg text-white/80">{t('auth.welcome')}</p>
                    </div>

                    {/* Right Panel: Form */}
                    <div className="p-6 sm:p-10 flex flex-col justify-center">
                        <div className="md:hidden text-center mb-8">
                            <Logo variant="emblema" height={96} className="mx-auto" />
                            <h1 className="mt-3 text-[30px] font-bold leading-none tracking-tight text-text-base">
                                Asphalt<span className="text-primary-dark dark:text-primary">PCI</span><small className="ml-1.5 font-mono text-xs font-semibold tracking-[0.04em] text-text-base/70">PRO</small>
                            </h1>
                        </div>
                        <h2 className="text-2xl font-bold text-center text-text-base mb-6">
                            {view === 'login' ? t('auth.loginTitle') : view === 'forgot' ? t('auth.forgotTitle') : t('auth.signupTitle')}
                        </h2>
                        
                        {renderAuthContent()}
                        
                        {view !== 'forgot' && <div className="mt-6 text-center">
                            <button onClick={toggleView} className="text-sm font-semibold text-text-muted hover:text-primary hover:underline">
                                {view === 'login' ? t('auth.switchToSignup') : t('auth.switchToLogin')}
                            </button>
                        </div>}

                        <div className="mt-8 flex justify-center items-center gap-4">
                            <LanguageSwitcher />
                            <ThemeSwitcher />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
