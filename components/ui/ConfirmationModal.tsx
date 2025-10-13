import React from 'react';
import { Button } from './Button';
import { useTranslations } from '../../hooks/useTranslations';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'secondary' | 'danger';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmText,
  cancelText,
  confirmVariant = 'danger',
}) => {
  const { t } = useTranslations();
  
  // Prevent body scroll when modal is open. This must be at the top level.
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Return cleanup function
      return () => {
          document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-text-base bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="bg-bg-surface rounded-xl shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-bold text-text-base mb-4">{title}</h2>
          <div className="text-text-muted mb-6">
            {children}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={onClose} className="bg-border-muted text-text-base hover:bg-opacity-80">
              {cancelText || t('modal.cancel')}
            </Button>
            <Button variant={confirmVariant} onClick={onConfirm}>
              {confirmText || t('modal.confirm')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};