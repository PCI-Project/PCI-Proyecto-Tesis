import React from 'react';
import { useTranslations } from '../../hooks/useTranslations';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface LegalViewProps {
  onBack: () => void;
}

const LegalSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div>
        <h4 className="text-lg font-semibold text-text-base mt-4 mb-2">{title}</h4>
        <div className="space-y-3 text-text-muted">{children}</div>
    </div>
);

export const PrivacyPolicy: React.FC<LegalViewProps> = ({ onBack }) => {
  const { t } = useTranslations();

  return (
    <Card className="max-h-[80vh] flex flex-col">
      <h3 className="text-2xl font-bold text-primary mb-4 text-center">{t('legal.policyTitle')}</h3>
      <div className="overflow-y-auto flex-grow pr-3 text-sm">
        <p className="text-xs text-text-muted mb-4">{t('legal.lastUpdated', { date: '2024-05-21' })}</p>

        <LegalSection title={t('legal.policy.section1.title')}>
            <p>{t('legal.policy.section1.content')}</p>
        </LegalSection>
        <LegalSection title={t('legal.policy.section2.title')}>
            <p>{t('legal.policy.section2.content.p1')}</p>
            <ul className="list-disc pl-5 space-y-1">
                <li><span className="font-semibold">{t('legal.policy.section2.content.item1.title')}</span>: {t('legal.policy.section2.content.item1.text')}</li>
                <li><span className="font-semibold">{t('legal.policy.section2.content.item2.title')}</span>: {t('legal.policy.section2.content.item2.text')}</li>
            </ul>
        </LegalSection>
        <LegalSection title={t('legal.policy.section3.title')}>
            <p>{t('legal.policy.section3.content')}</p>
        </LegalSection>
        <LegalSection title={t('legal.policy.section4.title')}>
            <p>{t('legal.policy.section4.content')}</p>
        </LegalSection>
        
        <p className="font-semibold mt-6 bg-accent/20 text-accent-text p-3 rounded-lg text-xs">{t('legal.disclaimer')}</p>
      </div>
      <div className="mt-6 text-center border-t border-border-muted pt-4">
        <Button onClick={onBack} variant="secondary">{t('legal.backButton')}</Button>
      </div>
    </Card>
  );
};
