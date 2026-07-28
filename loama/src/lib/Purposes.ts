/**
 * Purpose options for the ODRL "purpose" constraint, sourced from the
 * Data Privacy Vocabulary (DPV) and its Health Sector extension.
 *
 * Core purposes: https://w3id.org/dpv (prefix "dpv")
 * Health sector purposes: https://w3id.org/dpv/sector/health (prefix "sector-health")
 *
 * The `group` field is what TomSelect's optgroupField reads, and must
 * match the `value` of an entry in PURPOSE_GROUPS.
 */

export interface PurposeOption {
    group: string;
    value: string;
    name: string;
    desc: string;
}

export interface PurposeGroup {
    value: string;
    label: string;
}

export const PURPOSE_GROUPS: PurposeGroup[] = [
    { value: 'Core', label: 'Core' },
    { value: 'HealthcareManagement', label: 'Healthcare Management' },
];

export const PURPOSE_OPTIONS: PurposeOption[] = [
    // Core DPV purposes
    {
        group: 'Core',
        value: 'dpv:AccountManagement',
        name: 'AccountManagement',
        desc: 'Creating, providing, maintaining, and otherwise managing a user account.',
    },
    {
        group: 'Core',
        value: 'dpv:CommercialPurpose',
        name: 'CommercialPurpose',
        desc: 'Processing carried out in a commercial setting or with intent to commercialise.',
    },
    {
        group: 'Core',
        value: 'dpv:CommunicationManagement',
        name: 'CommunicationManagement',
        desc: 'Providing or managing communication activities, such as sending a notification email.',
    },
    {
        group: 'Core',
        value: 'dpv:CustomerManagement',
        name: 'CustomerManagement',
        desc: 'Managing activities related to past, current, and future customers.',
    },

    // Healthcare sector purposes, direct children of sector-health:HealthcareManagement
    {
        group: 'HealthcareManagement',
        value: 'sector-health:HealthcareServiceManagement',
        name: 'HealthcareServiceManagement',
        desc: 'Management of healthcare services themselves.',
    },
    {
        group: 'HealthcareManagement',
        value: 'sector-health:InsuranceManagement',
        name: 'InsuranceManagement',
        desc: 'Management of insurance as part of providing healthcare services.',
    },
    {
        group: 'HealthcareManagement',
        value: 'sector-health:Optimisation',
        name: 'Optimisation',
        desc: 'Identifying optimisations to the use and provision of healthcare services.',
    },
    {
        group: 'HealthcareManagement',
        value: 'sector-health:ResearchDevelopment',
        name: 'ResearchDevelopment',
        desc: 'Research and development regarding healthcare services.',
    },
    {
        group: 'HealthcareManagement',
        value: 'sector-health:ResourceManagement',
        name: 'ResourceManagement',
        desc: 'Management of resources related to healthcare services.',
    },
    {
        group: 'HealthcareManagement',
        value: 'sector-health:SecurityManagement',
        name: 'SecurityManagement',
        desc: 'Management of security in relation to healthcare services.',
    },
    {
        group: 'HealthcareManagement',
        value: 'sector-health:WorkforceManagement',
        name: 'WorkforceManagement',
        desc: 'Management of workforce involved in provision of healthcare services.',
    },
];

export const PURPOSES = {
    options: PURPOSE_OPTIONS,
    groups: PURPOSE_GROUPS,
};