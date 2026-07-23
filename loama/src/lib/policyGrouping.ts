import { computed, type ComputedRef } from 'vue';
import type { Policy, Rule, Constraint } from 'loama-controller';

export type RawConstraint = Constraint;

// A rule "lifted" out of its policy, with the policy id attached so
// you can still trace it back if two rules ever need disambiguating.
export interface FlatRule {
    ruleId: string;
    policyId: string;
    type: Rule['type'];
    subjectId: string;
    resourceIdentifier: string;
    action: string[];
    constraint: Constraint[];
    podName?: string;
}

export type GroupKey = 'subjectId' | 'resourceIdentifier' | 'policyId';
export type GroupedRules = Map<string, FlatRule[]>;

// The pod is just the first path segment of the resource's URL, e.g.
// "http://localhost:3000/bob/..." lives in the "bob" pod. Falls back to
// undefined for anything that isn't a resolvable URL.
function extractPod(resourceIdentifier: string): string | undefined {
    try {
        const { pathname } = new URL(resourceIdentifier);
        const [firstSegment] = pathname.split('/').filter(Boolean);
        return firstSegment;
    } catch {
        return undefined;
    }
}

function flattenPolicies(policies: Policy[]): FlatRule[] {
    return policies.flatMap((policy) =>
        policy.rules.map((rule: Rule) => ({
            ruleId: rule.id,
            policyId: policy.id,
            type: rule.type,
            subjectId: rule.subjectId,
            resourceIdentifier: rule.resourceIdentifier,
            action: rule.action,
            constraint: rule.constraint,
            podName: extractPod(rule.resourceIdentifier),
        })),
    );
}

function groupBy(rules: FlatRule[], key: GroupKey): GroupedRules {
    const map: GroupedRules = new Map();
    for (const rule of rules) {
        const groupKey = rule[key];
        const existing = map.get(groupKey);
        if (existing) {
            existing.push(rule);
        } else {
            map.set(groupKey, [rule]);
        }
    }
    return map;
}

export function sortedGroupEntries(map: GroupedRules, filter = ''): [string, FlatRule[]][] {
    const query = filter.trim().toLowerCase();
    return [...map.entries()]
        .filter(([key]) => key.toLowerCase().includes(query))
        .sort(([a], [b]) => a.localeCompare(b));
}

export function usePolicyGrouping(policies: ComputedRef<Policy[]>) {
    const flatRules = computed(() => flattenPolicies(policies.value));
    const bySubject = computed(() => groupBy(flatRules.value, 'subjectId'));
    const byResource = computed(() => groupBy(flatRules.value, 'resourceIdentifier'));
    const byPolicy = computed(() => groupBy(flatRules.value, 'policyId'));

    return { flatRules, bySubject, byResource, byPolicy };
}