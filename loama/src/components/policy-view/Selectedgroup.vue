<template>
    <div class="container">
        <header>
            <h2>{{ label }}</h2>
            <button type="button" class="close-button" @click="$emit('close')" aria-label="Close">
                <PhXCircle :size="32" />
            </button>
        </header>
        <section class="rule-section">
            <h3>{{ sortedRules.length }} rule{{ sortedRules.length === 1 ? '' : 's' }}</h3>
            <table class="rule-table">
                <caption class="sr-only">Rules for {{ label }}</caption>
                <thead>
                    <tr>
                        <th scope="col">{{ groupBy === 'subject' ? 'Resource' : 'Consumer' }}</th>
                        <th scope="col">Constraints</th>
                        <th scope="col">Pod</th>
                    </tr>
                </thead>
                <tbody>
                    <template v-for="[podLabel, rules] in rulesByPod" :key="podLabel">
                        <tr v-if="rulesByPod.length > 1" class="pod-header-row">
                            <td colspan="3">{{ podLabel }}</td>
                        </tr>
                        <tr v-for="rule in rules" :key="rule.ruleId" class="rule-row" tabindex="0"
                            @click="openPolicy(rule.policyId)" @keydown.enter.prevent="openPolicy(rule.policyId)"
                            @keydown.space.prevent="openPolicy(rule.policyId)">
                            <td>
                                <div class="target">{{ targetLabel(rule) }}</div>
                                <span class="type-chip" :class="rule.type">{{ rule.type }}</span>
                                <div class="actions">
                                    <span class="action-chip" v-for="action in rule.action" :key="action"
                                        :style="actionStyle(action)">{{ shorten(action) }}</span>
                                </div>
                            </td>
                            <td>
                                <ul class="constraints" v-if="rule.constraint.length">
                                    <li v-for="(constraint, index) in rule.constraint" :key="index">{{
                                        formatConstraint(constraint) }}</li>
                                </ul>
                                <span v-else class="no-constraints">No constraints</span>
                            </td>
                            <td class="pod-cell">{{ rule.podName ?? '—' }}</td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </section>
        <Drawer v-model:visible="detailsVisible" header="Policy details" position="right"
            class="policy-details-drawer">
            <RuleForm v-if="selectedPolicyId" :policy-id="selectedPolicyId" />
        </Drawer>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Drawer from 'primevue/drawer';
import { PhXCircle } from '@phosphor-icons/vue';
import RuleForm from './RuleForm.vue';
import { levelForAction } from '@/lib/accessLevel';
import type { FlatRule, RawConstraint } from '@/lib/policyGrouping';
import Ruleform from './Ruleform.vue';

const props = defineProps<{
    label: string;
    rules: FlatRule[];
    groupBy: 'subject' | 'resource';
}>();

defineEmits<{ close: [] }>();

const detailsVisible = ref(false);
const selectedPolicyId = ref<string | null>(null);

// when grouped by subject, the row should surface which resource the rule
// touches, and vice versa when grouped by resource.
const targetLabel = (rule: FlatRule) =>
    props.groupBy === 'subject' ? rule.resourceIdentifier : rule.subjectId;

const sortedRules = computed(() =>
    [...props.rules].sort((a, b) => targetLabel(a).localeCompare(targetLabel(b))),
);

// Rules that share a pod sit together. Falls back to a single unlabeled
// bucket (no header shown) when pod info isn't available on the rules.
const rulesByPod = computed(() => {
    const map = new Map<string, FlatRule[]>();
    for (const rule of sortedRules.value) {
        const key = rule.podName ?? 'Ungrouped';
        const existing = map.get(key);
        if (existing) existing.push(rule);
        else map.set(key, [rule]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
});

// ODRL terms are full URIs (http://www.w3.org/ns/odrl/2/read), only the
// last segment is meaningful to a person reading this.
const shorten = (uri: string) => uri.split(/[/#]/).filter(Boolean).pop() ?? uri;

const actionStyle = (action: string) => {
    const level = levelForAction(action);
    return { backgroundColor: level.color, color: level.textColor };
};

const formatConstraint = (constraint: RawConstraint) => {
    const left = shorten(constraint.leftOperand);
    const operator = shorten(constraint.operator);
    const right = constraint.rightOperand.map(shorten).join(', ');
    return `${left} ${operator} ${right}`;
};

const openPolicy = (policyId: string) => {
    selectedPolicyId.value = policyId;
    detailsVisible.value = true;
};
</script>

<style scoped>
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

.container {
    background-color: var(--solid-purple);
    height: 100%;
    display: flex;
    flex-direction: column;
}

header {
    display: flex;
    color: var(--off-white);
    flex-grow: 1;
    padding: 2rem;
    justify-content: space-between;
    align-items: center;
}

header h2 {
    margin: 0;
    font-size: calc(var(--base-unit) * 2.5);
    overflow-wrap: anywhere;
    color: var(--off-white);
}

.close-button {
    background: none;
    border: none;
    padding: 0;
    color: var(--off-white);
    cursor: pointer;
    display: flex;
}

.rule-section {
    background-color: var(--off-white);
    border-radius: var(--base-corner);
    height: 100%;
    padding: 2rem;
    overflow-y: auto;
}

.rule-section h3 {
    font-size: calc(var(--base-unit) * 2);
    margin: 0 0 1rem;
}

.rule-table {
    width: 100%;
    border-collapse: collapse;
}

.rule-table thead th {
    text-align: left;
    font-size: calc(var(--base-unit) * 1.5);
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid color-mix(in srgb, var(--off-black) 85%, transparent);
}

.pod-header-row td {
    padding: 0.75rem 0.6rem 0.25rem;
    font-weight: 700;
    font-size: calc(var(--base-unit) * 1.5);
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
}

.rule-row {
    cursor: pointer;
    outline-offset: -2px;
}

.rule-row:hover {
    background-color: color-mix(in srgb, var(--off-black) 10%, transparent);
}

.rule-row:focus-visible {
    outline: 2px solid var(--solid-purple);
}

.rule-row td {
    padding: 0.6rem;
    vertical-align: top;
    border-bottom: 1px solid color-mix(in srgb, var(--off-black) 10%, transparent);
}

.target {
    font-size: calc(var(--base-unit) * 1.5);
    overflow-wrap: anywhere;
    margin-bottom: 0.35rem;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.4rem;
}

.action-chip {
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: calc(var(--base-unit) * 1.5);
}

.type-chip {
    display: inline-block;
    font-weight: 700;
    text-transform: capitalize;
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: calc(var(--base-unit) * 1.5);
    background-color: var(--lama-gray);
}

.type-chip.prohibition {
    background-color: color-mix(in srgb, red 20%, transparent);
}

.constraints {
    margin: 0;
    padding-left: 1.1rem;
    font-size: calc(var(--base-unit) * 1.5);
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
}

.no-constraints {
    font-size: calc(var(--base-unit) * 1.5);
    font-style: italic;
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
}

.pod-cell {
    font-size: calc(var(--base-unit) * 1.5);
    white-space: nowrap;
}

:deep(.policy-details-drawer) {
    width: 28rem;
}
</style>