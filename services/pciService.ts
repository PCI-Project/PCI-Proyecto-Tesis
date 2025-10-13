
import { Project, Sample, Distress, PavementType, Severity, Section, DistressSummary, PCICalculationDetails } from '../types';
import { getDistressOptions } from '../constants';
import { calculatePCIForSample, getSummaries, calculateSectionParameters as calculateParams, calculateSectionPCI, calculateProjectWeightedPCI } from './pci/calculation';


/**
 * Calculates the summaries of distresses for a given sample, including deduct values.
 * This is a lighter version intended for review purposes before full calculation.
 * @param sample The sample to analyze.
 * @returns An array of distress summaries.
 */
export const getDistressSummaries = (sample: Sample): DistressSummary[] => {
    return getSummaries(sample);
}

/**
 * Calculates all PCI-related values for an entire project.
 * It processes each section and sample, calculates their PCI, and then computes the weighted PCI for the project.
 * The original project object is not mutated; a new object with calculation results is returned.
 * @param project The project to calculate.
 * @returns A new project object with all PCI values calculated and attached.
 */
export const calculateProjectPCI = (project: Project): Project => {
    // Deep copy to avoid mutations of the original state
    const projectWithCalculations = JSON.parse(JSON.stringify(project)) as Project;

    // 1. Calculate PCI for each sample in each section
    projectWithCalculations.sections.forEach(section => {
        section.samples.forEach(sample => {
            const pciDetails = calculatePCIForSample(sample);
            sample.calculationDetails = pciDetails;
        });
    });

    // 2. Calculate PCI for each section
    projectWithCalculations.sections.forEach(section => {
        section.pci = calculateSectionPCI(section);
    });

    // 3. Calculate weighted PCI for the project
    projectWithCalculations.weightedPCI = calculateProjectWeightedPCI(projectWithCalculations.sections);
    
    return projectWithCalculations;
};


/**
 * Calculates section parameters based on ASTM D6433 for sampling.
 * @param area Total area of the section.
 * @param sampleUnitArea Area of a single sample unit.
 * @param stdDev Assumed standard deviation of PCI.
 * @param allowableError Allowable error in PCI calculation.
 * @param evaluateAllSamples If true, all units will be marked for evaluation.
 * @returns Calculated parameters for the section.
 */
export const calculateSectionParameters = (
    area: number,
    sampleUnitArea: number,
    stdDev: number,
    allowableError: number,
    evaluateAllSamples: boolean
) => {
    return calculateParams(area, sampleUnitArea, stdDev, allowableError, evaluateAllSamples);
};
