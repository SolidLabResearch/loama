<template>
    <div class="container">
        <header>
            <h2>{{ label }}</h2>
            <button type="button" class="close-button" @click="$emit('close')" aria-label="Close">
                <PhXCircle :size="32" />
            </button>
        </header>
        <section class="rule-section">
            <h3>{{ rules.length }} rule{{ rules.length === 1 ? '' : 's' }}</h3>
            <div v-if="policyGroups.length === 0" class="empty-cell">No matches</div>
            <div v-for="group in policyGroups" :key="group.policyId" class="policy-group">
                <button type="button" class="policy-header" @click="openPolicy(group.policyId)">
                    <span class="policy-id">{{ group.policyId }}</span>
                </button>
                <table class="rule-table">
                    <caption class="sr-only">Rules in policy {{ group.policyId }}</caption>
                    <thead>
                        <tr>
                            <th scope="col">Consumer</th>
                            <th scope="col">Resource</th>
                            <th scope="col">Actions</th>
                            <th scope="col">Constraints</th>
                            <th scope="col">Pod</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="rule in group.rules" :key="rule.ruleId" class="rule-row" tabindex="0"
                            @click="openRule(rule)" @keydown.enter.prevent="openRule(rule)"
                            @keydown.space.prevent="openRule(rule)">
                            <td class="id-cell">{{ rule.subjectId }}</td>
                            <td class="id-cell">{{ rule.resourceIdentifier }}</td>
                            <td>
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
                    </tbody>
                </table>
            </div>
        </section>
        <Drawer style="width: 80vw"  v-model:visible="ruleDetailsVisible" header="Rule details" position="right">
            <RuleForm v-if="selectedRule" :rule="selectedRule" mode="view" :policy-id="selectedRule.policyId" @close="ruleDetailsVisible = false"/>
        </Drawer>
        <Drawer style="width: 90vw"  v-model:visible="policyDetailsVisible" header="Policy" position="right">
            <PolicyDetail v-if="selectedPolicy" :policyId="selectedPolicy" @close="policyDetailsVisible = false"/>
        </Drawer>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Drawer from 'primevue/drawer';
import { PhXCircle } from '@phosphor-icons/vue';
import RuleForm from './RuleForm.vue';
import PolicyDetail from './PolicyDetail.vue'
import { levelForAction } from '@/lib/accessLevel';
import type { FlatRule, RawConstraint } from '@/lib/policyGrouping';

const props = defineProps<{
    label: string;
    rules: FlatRule[];
    groupBy: 'subject' | 'resource' | 'policy';
}>();

const emit = defineEmits<{
    close: [];
}>();

const ruleDetailsVisible = ref(false);
const policyDetailsVisible = ref(false);
const selectedRule = ref<FlatRule | null>(null);
const selectedPolicy = ref<string | null>(null);

const policyGroups = computed(() => {
    const map = new Map<string, FlatRule[]>();
    for (const rule of props.rules) {
        const existing = map.get(rule.policyId);
        if (existing) existing.push(rule);
        else map.set(rule.policyId, [rule]);
    }
    return [...map.entries()]
        .map(([policyId, rules]) => ({ policyId, rules }))
        .sort((a, b) => a.policyId.localeCompare(b.policyId));
});

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
    selectedPolicy.value = policyId;
    policyDetailsVisible.value = true;
};

const openRule = (rule: FlatRule) => {
    selectedRule.value = rule;
    ruleDetailsVisible.value = true;
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

.empty-cell {
    padding: 1rem 0.75rem;
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
    font-style: italic;
    text-align: center;
}

.policy-group {
    margin-bottom: 1.5rem;
}

.policy-group:last-child {
    margin-bottom: 0;
}

.policy-header {
    display: block;
    width: 100%;
    text-align: left;
    background-color: var(--lama-gray);
    border: none;
    border-radius: var(--base-corner) var(--base-corner) 0 0;
    padding: 0.35rem 0.6rem;
    cursor: pointer;
}

.policy-header:hover {
    background-color: color-mix(in srgb, var(--solid-purple) 15%, var(--lama-gray));
}

.policy-header:focus-visible {
    outline: 2px solid var(--solid-purple);
    outline-offset: -2px;
}

.policy-id {
    font-size: calc(var(--base-unit) * 1.25);
    font-family: monospace;
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
    overflow-wrap: anywhere;
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

.id-cell {
    font-size: calc(var(--base-unit) * 1.5);
    overflow-wrap: anywhere;
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
</style>