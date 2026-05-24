import React, { useState, useRef } from 'react';
import { useTranslations } from '../hooks/useTranslations';
import { getDistressOptions } from '../constants';
import { saveCustomDistressCurve, saveCustomCDVCurves, CurveData, CDVCurvesData, Point } from '../services/customCurvesService';
import { Severity } from '../types';

export const CurvesSettingsView: React.FC = () => {
    const { t } = useTranslations();
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

    const parseCSV = (text: string) => {
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) throw new Error('File is empty or has no data');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const dataRows = lines.slice(1).map(l => l.split(',').map(v => parseFloat(v.trim())));
        return { headers, dataRows };
    };

    const handleCDVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const { headers, dataRows } = parseCSV(text);
                
                // Assuming first column is TDV, headers might be tdv, q1, q2... or x, y1, y2
                const newCdv: CDVCurvesData = {};
                
                // Find all columns for qs
                const qIndices: { q: number, index: number }[] = [];
                for (let i = 1; i < headers.length; i++) {
                    const match = headers[i].match(/\d+/);
                    if (match) {
                        qIndices.push({ q: parseInt(match[0], 10), index: i });
                    } else {
                        qIndices.push({ q: i, index: i });
                    }
                }

                qIndices.forEach(({ q }) => {
                    newCdv[q] = [];
                });

                dataRows.forEach(row => {
                    const tdv = row[0];
                    if (isNaN(tdv)) return;

                    qIndices.forEach(({ q, index }) => {
                        const val = row[index];
                        if (!isNaN(val)) {
                            newCdv[q].push({ x: tdv, y: val });
                        }
                    });
                });

                Object.keys(newCdv).forEach(qKey => {
                    newCdv[Number(qKey)].sort((a,b) => a.x - b.x);
                });

                saveCustomCDVCurves(newCdv);
                setMessage({ text: 'Curva CDV importada exitosamente.', type: 'success' });
            } catch (err) {
                console.error(err);
                setMessage({ text: 'Error al procesar el archivo CSV.', type: 'error' });
            }
        };
        reader.readAsText(file);
    };

    const handleDistressImport = (distressId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const { headers, dataRows } = parseCSV(text);
                
                const getColIndex = (names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));
                
                const lowIdx = getColIndex(['low', 'bajo', 'l']);
                const medIdx = getColIndex(['medium', 'medio', 'm', 'med']);
                const highIdx = getColIndex(['high', 'alto', 'h']);

                if (lowIdx === -1 && medIdx === -1 && highIdx === -1) {
                    throw new Error('Could not find severity columns (L, M, H)');
                }

                const newCurve: CurveData = {};
                if (lowIdx !== -1) newCurve[Severity.LOW] = [];
                if (medIdx !== -1) newCurve[Severity.MEDIUM] = [];
                if (highIdx !== -1) newCurve[Severity.HIGH] = [];

                dataRows.forEach(row => {
                    const density = row[0]; // assume 1st column is x
                    if (isNaN(density)) return;

                    if (lowIdx !== -1 && !isNaN(row[lowIdx])) newCurve[Severity.LOW]!.push({ x: density, y: row[lowIdx] });
                    if (medIdx !== -1 && !isNaN(row[medIdx])) newCurve[Severity.MEDIUM]!.push({ x: density, y: row[medIdx] });
                    if (highIdx !== -1 && !isNaN(row[highIdx])) newCurve[Severity.HIGH]!.push({ x: density, y: row[highIdx] });
                });

                if (newCurve[Severity.LOW]) newCurve[Severity.LOW]!.sort((a,b) => a.x - b.x);
                if (newCurve[Severity.MEDIUM]) newCurve[Severity.MEDIUM]!.sort((a,b) => a.x - b.x);
                if (newCurve[Severity.HIGH]) newCurve[Severity.HIGH]!.sort((a,b) => a.x - b.x);

                saveCustomDistressCurve(distressId, newCurve);
                setMessage({ text: 'Curva de falla importada exitosamente.', type: 'success' });
            } catch (err) {
                console.error(err);
                setMessage({ text: 'Error al procesar el archivo CSV. Asegúrate de tener columnas para L, M, H.', type: 'error' });
            }
        };
        reader.readAsText(file);
    };

    const handleCDVReset = () => {
        saveCustomCDVCurves(null);
        setMessage({ text: 'Curva CDV restablecida a los valores por defecto (ASTM).', type: 'success' });
    };

    const handleDistressReset = (distressId: string) => {
        saveCustomDistressCurve(distressId, null);
        setMessage({ text: `Curva de falla ${distressId} restablecida a los valores por defecto.`, type: 'success' });
    };

    const distresses = getDistressOptions();

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-simple-fade-in">
            <h1 className="text-3xl font-bold text-text-base mb-6">Configuración de Curvas (Administrador)</h1>
            <p className="text-text-muted mb-8">
                Importa archivos CSV para sobreescribir las curvas de deducción. 
                Para la curva CDV, el CSV debe tener la primera columna con TDV y las siguientes columnas pors los qs (ej. TDV, q1, q2...). 
                Para fallas, la primera columna debe ser Densidad y las siguientes deben llamarse L, M, H.
            </p>

            {message && (
                <div className={`p-4 mb-6 rounded border ${message.type === 'error' ? 'bg-danger/10 border-danger/20 text-danger-dark' : 'bg-primary/10 border-primary/20 text-primary-dark'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-bg-surface border border-border-base rounded-xl p-6 mb-8 shadow-sm">
                <div className="flex justify-between items-center flex-wrap gap-4 mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-text-base">Curvas de Corrección CDV (Flexible)</h2>
                        <p className="text-sm text-text-muted">Actualiza la matriz completa de q.</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleCDVReset}
                            className="bg-bg-base text-text-base border border-border-muted px-4 py-2 rounded-lg font-medium hover:bg-border-muted transition-colors inline-block"
                        >
                            Restablecer
                        </button>
                        <div>
                            <input
                                type="file"
                                accept=".csv"
                                id="cdv-upload"
                                className="hidden"
                                onChange={handleCDVImport}
                            />
                            <label
                                htmlFor="cdv-upload"
                                className="bg-primary text-text-inverted px-4 py-2 rounded-lg font-medium cursor-pointer hover:opacity-90 inline-block"
                            >
                                Importar CSV
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <h2 className="text-xl font-bold text-text-base mb-4">Curvas de Deducción de Fallas</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {distresses.map(d => (
                    <div key={d.id} className="bg-bg-surface border border-border-base p-4 rounded-xl shadow-sm flex flex-col justify-between">
                        <div className="mb-4">
                            <span className="inline-block bg-primary/10 text-primary-dark font-mono text-sm px-2 py-1 rounded mb-2">Falla {d.id}</span>
                            <h3 className="font-bold text-text-base">{t(d.nameKey)}</h3>
                        </div>
                        <div className="flex gap-2 w-full">
                            <button
                                type="button"
                                onClick={() => handleDistressReset(d.id)}
                                title="Restablecer"
                                className="bg-bg-base text-text-muted border border-border-muted px-4 py-2 rounded-lg hover:bg-border-muted transition-colors flex-shrink-0"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <input
                                type="file"
                                accept=".csv"
                                id={`distress-upload-${d.id}`}
                                className="hidden"
                                onChange={(e) => handleDistressImport(d.id, e)}
                            />
                            <label
                                htmlFor={`distress-upload-${d.id}`}
                                className="bg-secondary/20 text-secondary-dark border border-secondary/30 px-4 py-2 rounded-lg font-medium cursor-pointer hover:bg-secondary/30 transition-colors flex-grow text-center block"
                            >
                                Importar CSV
                            </label>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};