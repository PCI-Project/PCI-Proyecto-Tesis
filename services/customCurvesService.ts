import { Severity } from '../types';

export interface Point {
    x: number;
    y: number;
}

export interface CurveData {
    [Severity.LOW]?: Point[];
    [Severity.MEDIUM]?: Point[];
    [Severity.HIGH]?: Point[];
}

export interface CDVCurvesData {
    [q: number]: Point[];
}

const STORAGE_KEY_FLEXIBLE_DISTRESS = 'custom_flexible_distress_curves';
const STORAGE_KEY_FLEXIBLE_CDV = 'custom_flexible_cdv_curves';

export const saveCustomDistressCurve = (distressId: string, data: CurveData | null) => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_FLEXIBLE_DISTRESS);
        const parsed = stored ? JSON.parse(stored) : {};
        if (data === null) {
            delete parsed[distressId];
        } else {
            parsed[distressId] = data;
        }
        localStorage.setItem(STORAGE_KEY_FLEXIBLE_DISTRESS, JSON.stringify(parsed));
    } catch (e) {
        console.error('Failed to save custom distress curve', e);
    }
};

export const getCustomDistressCurve = (distressId: string): CurveData | null => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_FLEXIBLE_DISTRESS);
        if (stored) {
            const parsed = JSON.parse(stored);
            return parsed[distressId] || null;
        }
    } catch (e) {
        console.error('Failed to get custom distress curve', e);
    }
    return null;
};

export const saveCustomCDVCurves = (data: CDVCurvesData | null) => {
    try {
        if (data === null) {
            localStorage.removeItem(STORAGE_KEY_FLEXIBLE_CDV);
        } else {
            localStorage.setItem(STORAGE_KEY_FLEXIBLE_CDV, JSON.stringify(data));
        }
    } catch (e) {
        console.error('Failed to save custom CDV curves', e);
    }
};

export const getCustomCDVCurves = (): CDVCurvesData | null => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY_FLEXIBLE_CDV);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to get custom CDV curves', e);
    }
    return null;
};