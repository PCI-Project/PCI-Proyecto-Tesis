import React, { useState, useEffect } from 'react';
import { Project, AppView, ProjectView } from '../types';
import { useTranslations } from '../hooks/useTranslations';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useAuth } from '../contexts/AuthContext';
import { ThemeSwitcher } from './ui/ThemeSwitcher';
import { Avatar } from './ui/Avatar';

// Icons
const HamburgerIcon: React.FC = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const CloseIcon: React.FC = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const LogoutIcon: React.FC = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" /></svg>);
const HomeIcon: React.FC = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>);
const ProfileIcon: React.FC = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>);
const SetupIcon: React.FC = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0L8 5.69 5.69 5.25c-1.56-.38-2.62 1.06-1.16 2.16L6.69 9.5 5.25 11.81c-.38 1.56 1.06 2.62 2.16 1.16L9.5 13.31l2.31 1.44c1.56.38 2.62-1.06 1.16-2.16L13.31 10.5l1.44-2.31c.38-1.56-1.06-2.62-2.16-1.16L10.5 6.69l-1.44-2.31zM12 10a2 2 0 11-4 0 2 2 0 014 0z" clipRule="evenodd" /></svg>);
const DataIcon: React.FC = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>);
const CalcIcon: React.FC = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zM6 7a1 1 0 011-1h2a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h2a1 1 0 110 2H7a1 1 0 01-1-1zm6-4a1 1 0 100 2h2a1 1 0 100-2h-2zm-3 4a1 1 0 110 2h2a1 1 0 110-2h-2z" clipRule="evenodd" /></svg>);
const ResultsIcon: React.FC = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" /><path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" /></svg>);
const InstallIcon: React.FC = () => (<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>);


interface AppHeaderProps {
  project: Project | null;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onGoHome: () => void;
}

const VIEW_ORDER: ProjectView[] = ['SETUP', 'DATA_ENTRY', 'CALCULATION_DETAILS', 'RESULTS'];

const STEP_DEFINITIONS: { view: ProjectView, labelKey: string, icon: React.FC }[] = [
    { view: 'SETUP', labelKey: 'stepper.step1', icon: SetupIcon },
    { view: 'DATA_ENTRY', labelKey: 'stepper.step2', icon: DataIcon },
    { view: 'CALCULATION_DETAILS', labelKey: 'stepper.step3', icon: CalcIcon },
    { view: 'RESULTS', labelKey: 'stepper.step4', icon: ResultsIcon },
];

export const AppHeader: React.FC<AppHeaderProps> = ({ project, currentView, onNavigate, onGoHome }) => {
    const { t } = useTranslations();
    const { user, logout } = useAuth();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallClick = async () => {
        if (!installPrompt) return;
        (installPrompt as any).prompt();
        const { outcome } = await (installPrompt as any).userChoice;
        if (outcome === 'accepted') {
            setInstallPrompt(null);
        }
    };

    const isProjectView = project && VIEW_ORDER.includes(currentView as ProjectView);
    
    const renderSideMenu = () => (
        <div className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMenuOpen(false)}>
            <div className={`fixed top-0 left-0 h-full w-full max-w-sm bg-bg-surface shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-border-muted">
                    <h2 className="font-bold text-primary text-lg">{t('header.menuTitle')}</h2>
                    <button onClick={() => setIsMenuOpen(false)} className="p-2 rounded-full hover:bg-bg-muted"><CloseIcon /></button>
                </div>
                <div className="p-4 space-y-6">
                    {user && (
                         <div className='p-4 bg-bg-base/60 rounded-lg flex items-center gap-4'>
                            <Avatar name={user.name} className="h-12 w-12 text-lg shrink-0" />
                             <div>
                                <p className='font-bold text-text-base truncate'>{user.name}</p>
                                <p className='text-sm text-text-muted truncate'>{user.email}</p>
                             </div>
                         </div>
                    )}
                    
                    {isProjectView && project && (
                         <div>
                            <p className="px-4 text-xs font-bold uppercase text-text-muted mb-2">{t('header.projectSteps')}</p>
                            <div className="space-y-2">
                               {STEP_DEFINITIONS.map((step) => {
                                   const isEnabled = true; // Unlock all navigation steps as requested by user
                                   const isActive = currentView === step.view;
                                   
                                   return (
                                        <button key={step.view} disabled={!isEnabled} onClick={() => { onNavigate(step.view); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-left font-semibold disabled:opacity-50 ${isActive ? 'bg-primary text-text-inverted' : 'hover:bg-primary/10'}`}>
                                            <step.icon />
                                            {t(step.labelKey)}
                                        </button>
                                   )
                               })}
                           </div>
                        </div>
                    )}

                    <div className="border-t border-border-muted pt-6 space-y-4">
                        <button onClick={() => { onGoHome(); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-left font-semibold ${currentView === 'DASHBOARD' ? 'bg-primary text-text-inverted' : 'hover:bg-primary/10'}`}>
                            <HomeIcon />
                            {t('header.dashboard')}
                        </button>
                        <button onClick={() => { onNavigate('PROFILE'); setIsMenuOpen(false); }} className={`w-full flex items-center gap-3 p-3 rounded-lg text-left font-semibold ${currentView === 'PROFILE' ? 'bg-primary text-text-inverted' : 'hover:bg-primary/10'}`}>
                            <ProfileIcon />
                            {t('header.profile')}
                        </button>
                        
                        {installPrompt && (
                             <button onClick={handleInstallClick} className="w-full flex items-center gap-3 p-3 rounded-lg text-left font-semibold bg-secondary/20 text-secondary-dark hover:bg-secondary/30">
                                <InstallIcon /> {t('header.installApp')}
                            </button>
                        )}
                        
                        <button onClick={logout} className="w-full flex items-center gap-3 p-3 rounded-lg text-left font-semibold text-danger hover:bg-danger/10">
                            <LogoutIcon />
                            {t('auth.logout')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <header className="sticky top-0 bg-bg-surface border-b border-border-base z-30 shadow-sm">
            <div className="container mx-auto px-4 sm:px-6 md:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsMenuOpen(true)} className="p-2 text-text-base" aria-label={t('header.openMenu')}>
                            <HamburgerIcon />
                        </button>
                        <button onClick={onGoHome} className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity">
                            <h1 className="text-xl font-bold">AsphaltPCI Pro</h1>
                        </button>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Intentionally empty. All controls are in the side menu. */}
                    </div>
                </div>
            </div>
            {renderSideMenu()}
        </header>
    );
};