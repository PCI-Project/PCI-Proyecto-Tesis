import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  containerClassName?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, containerClassName = 'max-w-2xl' }) => {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = 'unset';
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-text-base bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 p-4 modal-enter"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
    >
      <div
        className={`bg-bg-surface rounded-xl shadow-xl w-full modal-content-enter ${containerClassName}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 id="modal-title" className="text-xl font-bold text-text-base mb-4">{title}</h2>
          <div className="text-text-muted">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};