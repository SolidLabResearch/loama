import { Parser, Store } from 'n3';

/**
 * Purpose options for the ODRL "purpose" constraint.
 *
 * The vocabulary is loaded lazily from Turtle files in `data/dpv` the first
 * time `loadPurposes()` is called (e.g. after login / when a form is opened).
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

const PURPOSE_TTL_MODULES = import.meta.glob('../../data/dpv/*.ttl', {
    query: '?raw',
    import: 'default',
});

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const SKOS_PREF_LABEL = 'http://www.w3.org/2004/02/skos/core#prefLabel';
const SKOS_DEFINITION = 'http://www.w3.org/2004/02/skos/core#definition';
const DPV_PURPOSE = 'https://w3id.org/dpv#Purpose';

let loadPromise: Promise<typeof PURPOSES> | null = null;

const GROUP_LABELS: Record<string, string> = {
    dpv: 'DPV',
    'sector-education': 'Education',
    'sector-finance': 'Finance',
    'sector-health': 'Health',
    'sector-infra': 'Infrastructure',
    'sector-law': 'Law Enforcement & Justice',
    'sector-publicservices': 'Public Services',
};

function filePathToGroupValue(filePath: string): string {
    const fileName = filePath.split('/').at(-1) ?? filePath;
    return fileName.replace(/\.ttl$/i, '');
}

function getLiteral(store: Store, subject: string, predicate: string): string | undefined {
    const matches = store.getObjects(subject, predicate, null);
    if (matches.length === 0) return;
    return matches[0].value;
}

function parsePurposeOptions(filePath: string, content: string): { group: PurposeGroup; options: PurposeOption[] } {
    const store = new Store(new Parser().parse(content));

    const groupValue = filePathToGroupValue(filePath);
    const options: PurposeOption[] = [];

    const purposeSubjects = store
        .getQuads(null, RDF_TYPE, DPV_PURPOSE, null)
        .map((quad) => quad.subject)
        .filter((term) => term.termType === 'NamedNode');

    for (const subject of purposeSubjects) {
        options.push({
            group: groupValue,
            value: subject.value,
            name: getLiteral(store, subject.value, SKOS_PREF_LABEL) ?? subject.value,
            desc: getLiteral(store, subject.value, SKOS_DEFINITION) ?? '',
        });
    }

    return {
        group: {
            value: groupValue,
            label: GROUP_LABELS[groupValue],
        },
        options,
    };
}

export const PURPOSE_GROUPS: PurposeGroup[] = [];

export const PURPOSE_OPTIONS: PurposeOption[] = [];

export const PURPOSES = {
    options: PURPOSE_OPTIONS,
    groups: PURPOSE_GROUPS,
};

async function parseAllTurtlePurposes(): Promise<{ groups: PurposeGroup[]; options: PurposeOption[] }> {
    const moduleEntries = Object.entries(PURPOSE_TTL_MODULES);

    const groups: PurposeGroup[] = [];
    const options: PurposeOption[] = [];

    for (const [filePath, loadModule] of moduleEntries) {
        const content = (await loadModule()) as string;
        const parsed = parsePurposeOptions(filePath, content);

        groups.push(parsed.group);
        options.push(...parsed.options);
    }

    return {
        groups,
        options,
    };
}

/**
 * Loads purposes once and keeps them in memory for the rest of the app session.
 */
export async function loadPurposes(): Promise<typeof PURPOSES> {
    if (!loadPromise) {
        loadPromise = (async () => {
            const { groups, options } = await parseAllTurtlePurposes();
            PURPOSE_GROUPS.splice(0, PURPOSE_GROUPS.length, ...groups);
            PURPOSE_OPTIONS.splice(0, PURPOSE_OPTIONS.length, ...options);
            return PURPOSES;
        })();
    }

    return loadPromise;
}
