import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useTranslations } from '../../hooks/useTranslations';

const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-text-inverted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export const SignUp: React.FC = () => {
    const { t } = useTranslations();
    const { signup, isLoading, error } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [formError, setFormError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        if (!name.trim()) {
            setFormError(t('auth.errorNameRequired'));
            return;
        }
        if (password.length < 6) {
            setFormError(t('auth.errorPasswordLength'));
            return;
        }
        if (password !== confirmPassword) {
            setFormError(t('auth.errorPasswordMatch'));
            return;
        }
        await signup({ name, email, pass: password });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <Input
                type="text"
                name="name"
                id="signup-name"
                autoComplete="name"
                placeholder={t('auth.fullName')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
            />
            <Input
                type="email"
                name="email"
                id="signup-email"
                autoComplete="email"
                placeholder={t('auth.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
            />
             <Input
                type="password"
                name="password"
                id="signup-password"
                autoComplete="new-password"
                placeholder={t('auth.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
            />
            <Input
                type="password"
                name="confirmPassword"
                id="signup-confirm-password"
                autoComplete="new-password"
                placeholder={t('auth.confirmPassword')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
            />
            {(error || formError) && <p className="text-sm text-danger text-center">{error || formError}</p>}
            <Button type="submit" className="w-full flex justify-center !text-lg !font-bold" disabled={isLoading}>
                {isLoading ? <LoadingSpinner /> : t('auth.signupButton')}
            </Button>
        </form>
    );
};
