import React, { useState } from 'react';
import { Project } from '../types';
import { useTranslations } from '../hooks/useTranslations';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { generateCsvZip, generatePdfReport } from '../services/exportService';

const CsvIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>;
const PdfIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3.707 5.707a1 1 0 00-1.414 1.414l1.5 1.5a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293z" clipRule="evenodd" /></svg>;
const LoadingSpinner: React.FC = () => (
    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-text-inverted" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    project: Project;
}

export interface ExportOptions {
    projectSummary: boolean;
    sectionResults: boolean;
    distressData: boolean;
    calculationDetails: boolean;
    locationData: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, project }) => {
    const { t } = useTranslations();
    const [format, setFormat] = useState<'csv' | 'pdf'>('pdf');
    const [options, setOptions] = useState<ExportOptions>({
        projectSummary: true,
        sectionResults: true,
        distressData: true,
        calculationDetails: false,
        locationData: true,
    });
    const [isGenerating, setIsGenerating] = useState(false);

    const handleOptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setOptions({ ...options, [e.target.name]: e.target.checked });
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            if (format === 'csv') {
                await generateCsvZip(project, options, t);
            } else {
                await generatePdfReport(project, options, t);
            }
        } catch (error) {
            console.error("Failed to generate report:", error);
            alert(t('exportModal.generationError'));
        }
        setIsGenerating(false);
        onClose();
    };

    const contentOptions = [
        { key: 'projectSummary', label: t('exportModal.projectSummary') },
        { key: 'sectionResults', label: t('exportModal.sectionResults') },
        { key: 'distressData', label: t('exportModal.distressData') },
        { key: 'calculationDetails', label: t('exportModal.calculationDetails') },
        { key: 'locationData', label: t('exportModal.locationData') },
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('exportModal.title')}>
            <div className="space-y-6">
                <div>
                    <h4 className="font-semibold text-text-base mb-2">{t('exportModal.selectFormat')}</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setFormat('csv')} className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all ${format === 'csv' ? 'border-primary bg-primary/10 shadow-lg' : 'border-border-muted bg-bg-base/60 hover:border-border-base'}`}>
                            <CsvIcon /> <span className="font-bold text-sm">{t('exportModal.csvZip')}</span>
                        </button>
                        <button onClick={() => setFormat('pdf')} className={`p-4 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all ${format === 'pdf' ? 'border-primary bg-primary/10 shadow-lg' : 'border-border-muted bg-bg-base/60 hover:border-border-base'}`}>
                            <PdfIcon /> <span className="font-bold text-sm">{t('exportModal.pdf')}</span>
                        </button>
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold text-text-base mb-2">{t('exportModal.selectContent')}</h4>
                    <div className="space-y-2 bg-bg-base/60 p-4 rounded-lg border border-border-muted">
                        {contentOptions.map(opt => (
                            <label key={opt.key} className="flex items-center gap-3 cursor-pointer p-2 rounded-md hover:bg-bg-muted">
                                <input
                                    type="checkbox"
                                    name={opt.key}
                                    checked={options[opt.key as keyof ExportOptions]}
                                    onChange={handleOptionChange}
                                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="text-sm font-medium text-text-base">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-border-muted">
                    <Button variant="ghost" onClick={onClose}>{t('modal.cancel')}</Button>
                    <Button onClick={handleGenerate} disabled={isGenerating} className="flex items-center min-w-[180px] justify-center">
                        {isGenerating ? (
                            <>
                                <LoadingSpinner/>
                                {t('exportModal.generatingMessage')}
                            </>
                        ) : (
                            t('exportModal.generateButton')
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
