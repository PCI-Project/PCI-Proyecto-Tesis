import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useTranslations } from '../../hooks/useTranslations';
import { validateNewPassword } from '../../services/passwordPolicy';
import { EMAIL_DELIVERY_ENABLED, RESEND_COOLDOWN_SECONDS, RESET_LINK_MINUTES } from '../../services/authConfig';

type Step = 'request' | 'sent' | 'code' | 'done';

const MailIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
  </svg>
);

// Recuperación de contraseña según OWASP (Forgot Password Cheat Sheet):
// - se pide solo el correo y la respuesta es siempre la misma, exista o no la cuenta;
// - el enlace lo enviará el servidor (token de un solo uso y con vencimiento) cuando la app se despliegue;
// - no se usan preguntas de seguridad (NIST SP 800-63B no las admite para recuperar cuentas);
// - en modo local queda como alternativa el código de recuperación de la cuenta.
export const ForgotPassword: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { t } = useTranslations();
  const { requestPasswordReset, resetPassword, error } = useAuth();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const sendLink = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setSubmitting(true);
    await requestPasswordReset(email);
    setSubmitting(false);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStep('sent');
  };

  const submitCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const problem = validateNewPassword(password, { email });
    if (problem) { setFormError(t(problem)); return; }
    if (password !== confirm) { setFormError(t('auth.errorPasswordMatch')); return; }
    setSubmitting(true);
    const ok = await resetPassword(email, code, password);
    setSubmitting(false);
    if (ok) setStep('done');
  };

  const backLink = (
    <div className="text-center">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-text-muted hover:text-primary hover:underline">{t('auth.backToLogin')}</button>
    </div>
  );

  if (step === 'sent') {
    return (
      <div className="space-y-5 text-center" role="status" aria-live="polite">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary"><MailIcon /></div>
        <h3 className="text-xl font-bold text-text-base">{t('auth.sentTitle')}</h3>
        <p className="text-sm text-text-muted">{t('auth.sentText', { email })}</p>
        <p className="text-xs text-text-muted">{t('auth.sentExpiry', { minutes: RESET_LINK_MINUTES })}</p>
        {!EMAIL_DELIVERY_ENABLED && (
          <div className="rounded-xl border border-dashed border-border-base bg-bg-base/60 p-3 text-left text-xs text-text-muted">
            <p>{t('auth.localModeNote')}</p>
            <button type="button" onClick={() => setStep('code')} className="mt-1 font-semibold text-primary hover:underline">{t('auth.useCode')}</button>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button type="button" variant="primary" className="w-full" onClick={onBack}>{t('auth.backToLogin')}</Button>
          <button type="button" disabled={cooldown > 0 || submitting} onClick={() => sendLink()} className="text-sm font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:text-text-muted disabled:no-underline">
            {cooldown > 0 ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resend')}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="space-y-6 text-center">
        <p className="rounded-xl bg-primary/10 p-4 text-sm font-semibold text-text-base">{t('auth.resetSuccess')}</p>
        <Button type="button" variant="primary" className="w-full" onClick={onBack}>{t('auth.backToLogin')}</Button>
      </div>
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={submitCode} className="space-y-4">
        <p className="text-sm text-text-muted">{t('auth.forgotIntro')}</p>
        <Input type="email" name="email" id="forgot-email" autoComplete="email" placeholder={t('auth.email')} value={email} onChange={e => setEmail(e.target.value)} required />
        <Input type="text" name="recoveryCode" id="forgot-code" autoComplete="off" placeholder={`${t('auth.recoveryCode')} (XXXX-XXXX-XXXX)`} value={code} onChange={e => setCode(e.target.value)} className="font-mono uppercase tracking-wider" required />
        <Input type="password" name="newPassword" id="forgot-password" autoComplete="new-password" placeholder={t('auth.newPassword')} value={password} onChange={e => setPassword(e.target.value)} required />
        <Input type="password" name="confirmNewPassword" id="forgot-confirm" autoComplete="new-password" placeholder={t('auth.confirmNewPassword')} value={confirm} onChange={e => setConfirm(e.target.value)} required />
        <p className="text-xs text-text-muted">{t('auth.passwordHint')}</p>
        {(formError || error) && <p className="text-center text-sm text-danger">{formError || error}</p>}
        <Button variant="primary" type="submit" className="w-full !text-lg !font-bold" disabled={submitting}>{t('auth.resetButton')}</Button>
        <p className="text-center text-xs text-text-muted">{t('auth.noCodeHint')}</p>
        {backLink}
      </form>
    );
  }

  return (
    <form onSubmit={sendLink} className="space-y-4">
      <p className="text-sm text-text-muted">{t('auth.forgotIntroEmail')}</p>
      <Input type="email" name="email" id="forgot-request-email" autoComplete="email" placeholder={t('auth.email')} value={email} onChange={e => setEmail(e.target.value)} required />
      <Button variant="primary" type="submit" className="w-full !text-lg !font-bold" disabled={submitting}>{t('auth.sendLink')}</Button>
      <div className="text-center">
        <button type="button" onClick={() => setStep('code')} className="text-sm font-semibold text-primary hover:underline">{t('auth.haveCode')}</button>
      </div>
      {backLink}
    </form>
  );
};
