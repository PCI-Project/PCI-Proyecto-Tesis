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
    const [company, setCompany] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [acceptedTerms, setAcceptedTerms] = useState(false);
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

        if (!acceptedTerms) {
            setFormError(t('auth.errorTermsRequired'));
            return;
        }

        await signup({
            name,
            email,
            pass: password,
            company,
            jobTitle
        });
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

            <div className="grid grid-cols-2 gap-4">
                <Input
                    type="text"
                    name="company"
                    id="signup-company"
                    placeholder={t('auth.company')}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                />

                <Input
                    type="text"
                    name="role"
                    id="signup-role"
                    placeholder={t('auth.role')}
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                />
            </div>

            <div className="flex items-start">
                <div className="flex items-center h-5">
                    <input
                        id="terms"
                        name="terms"
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="focus:ring-primary h-4 w-4 text-primary border-border-color rounded"
                    />
                </div>
                <div className="ml-3 text-sm">
                    <label htmlFor="terms" className="font-medium text-text-primary">
                        {t('auth.acceptTerms')}
                    </label>
                </div>
            </div>

            {(error || formError) && (
                <p className="text-sm text-danger text-center">
                    {error || formError}
                </p>
            )}

            <Button
                type="submit"
                className="w-full flex justify-center !text-lg !font-bold"
                disabled={isLoading}
            >
                {isLoading ? <LoadingSpinner /> : t('auth.signupButton')}
            </Button>
        </form>
    );
};