import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useTranslations } from '../../hooks/useTranslations';

// Muestra una sola vez el código de recuperación recién generado (al registrarse, al restablecer
// la contraseña o desde el perfil). Se monta en <body> para no quedar dentro de tarjetas transformadas.
export const RecoveryCodeDialog: React.FC<{ code: string | null; onClose: () => void }> = ({ code, onClose }) => {
  const { t } = useTranslations();
  const [copied, setCopied] = useState(false);

  useEffect(() => { setCopied(false); }, [code]);

  if (!code) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([`AsphaltPCI Pro\n${t('auth.recoveryCodeTitle')}: ${code}\n`], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'codigo-recuperacion-asphaltpci.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return createPortal(
    <Modal isOpen onClose={onClose} title={t('auth.recoveryCodeTitle')} containerClassName="max-w-lg">
      <p className="mb-4 text-sm text-text-muted">{t('auth.recoveryCodeIntro')}</p>
      <div className="mb-4 select-all rounded-xl border-2 border-dashed border-primary bg-primary/10 py-4 text-center font-mono text-2xl font-bold tracking-widest text-text-base">
        {code}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={copy}>{copied ? t('auth.recoveryCodeCopied') : t('auth.recoveryCodeCopy')}</Button>
        <Button type="button" variant="ghost" onClick={download}>{t('auth.recoveryCodeDownload')}</Button>
        <Button type="button" variant="primary" onClick={onClose}>{t('auth.recoveryCodeSaved')}</Button>
      </div>
    </Modal>,
    document.body,
  );
};
