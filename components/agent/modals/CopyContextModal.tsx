import React, { useEffect, useState } from 'react';
import type { Project } from '../../../types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useTranslations } from '../../../hooks/useTranslations';
import { checkClasses } from '../controls';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  sourceId: string;
  onCopy: (targetIds: string[]) => void;
}

export const CopyContextModal: React.FC<Props> = ({ isOpen, onClose, project, sourceId, onCopy }) => {
  const { t } = useTranslations();
  const targets = project.sections.filter(s => s.id !== sourceId);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => { if (isOpen) setSelected([]); }, [isOpen]);
  const toggle = (id: string) => setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('agent.copy.title')} containerClassName="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-text-muted">{t('agent.copy.help')}</p>
        <label className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-bg-muted">
          <input type="checkbox" className={checkClasses} checked={targets.length > 0 && selected.length === targets.length} onChange={e => setSelected(e.target.checked ? targets.map(s => s.id) : [])} />
          <span className="text-sm font-semibold text-text-base">{t('agent.copy.all')}</span>
        </label>
        <div className="space-y-1 bg-bg-base/60 p-3 rounded-lg border border-border-muted">
          {targets.map(s => (
            <label key={s.id} className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-bg-muted">
              <input type="checkbox" className={checkClasses} checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
              <span className="text-sm text-text-base">{s.name}</span>
            </label>
          ))}
          {targets.length === 0 && <p className="text-sm text-text-muted">{t('agent.copy.none')}</p>}
        </div>
        <div className="flex justify-end gap-4 pt-4 border-t border-border-muted">
          <Button variant="ghost" onClick={onClose}>{t('modal.cancel')}</Button>
          <Button disabled={selected.length === 0} onClick={() => { onCopy(selected); onClose(); }}>{t('agent.copy.apply')}</Button>
        </div>
      </div>
    </Modal>
  );
};
