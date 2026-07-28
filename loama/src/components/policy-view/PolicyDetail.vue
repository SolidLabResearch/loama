<template>
    <div class="container">
        <header>
            <h2>{{ policyId }}</h2>
        </header>
        <section class="rule-section">
            <div v-if="!selectedPolicy" class="empty-cell">No matches</div>
            <table v-else class="rule-table">
                <thead>
                    <tr>
                        <th scope="col">Consumer</th>
                        <th scope="col">Resource</th>
                        <th scope="col">Actions</th>
                        <th scope="col">Constraints</th>
                        <th scope="col">Manage</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="rule in selectedPolicy.rules" :key="rule.id" class="rule-row" tabindex="0"
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
                        <!-- Delete Column -->
                        <td @click.stop>
                            <div v-if="deletingRuleId === rule.id" class="delete-confirm-box">
                                <span class="confirm-text">Delete this rule?</span>
                                <button type="button" class="danger" @click="handleDelete(rule)">Yes, delete</button>
                                <button type="button" class="secondary" @click="deletingRuleId = null">Cancel</button>
                            </div>
                            <button v-else type="button" class="danger" @click="deletingRuleId = rule.id">Delete</button>
                        </td>
                    </tr>
                </tbody>
            </table>

            <LoButton v-if="selectedPolicy" :left-icon="PhPlus" class="add-button" @click="addRuleVisible = true"
                aria-label="Add Rule">
                Add Rule
            </LoButton>

        </section>
        <Drawer style="width: 80vw" v-model:visible="ruleDetailsVisible" position="right">
            <RuleForm v-if="selectedRule" :rule="selectedRule" mode="view" :policy-id="selectedPolicy?.id" @close="ruleDetailsVisible = false"/>
        </Drawer>
        <Drawer style="width: 80vw" v-model:visible="addRuleVisible" position="right" class="policy-details-drawer">
            <RuleForm mode="create" :policy-id="policyId" @close="addRuleVisible = false"/>
        </Drawer>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Drawer from 'primevue/drawer';
import { PhPlus } from '@phosphor-icons/vue';
import type { Rule, RuleUpdate, Policy } from 'loama-controller';
import { levelForAction } from '@/lib/Accesslevel';
import type { RawConstraint } from '@/lib/policyGrouping';
import { usePodStore } from '@/lib/state';
import { useControllerStore } from '@/stores/useControllerStore';
import RuleForm from './RuleForm.vue';
import LoButton from '@/components/LoButton.vue';

const ruleDetailsVisible = ref(false);
const addRuleVisible = ref(false);
const selectedRule = ref<Rule | null>(null);

const podStore = usePodStore();
const controllerStore = useControllerStore();

const props = withDefaults(defineProps<{
    policyId?: string | null;
}>(), {
    policyId: null
});

// Reactively find the policy
const selectedPolicy = computed(() => {
    return podStore.policies.find((p) => p.id === props.policyId) ?? null;
});

const emit = defineEmits(['close']);

// Track which specific rule is being confirmed for deletion
const deletingRuleId = ref<string | null>(null);

const openRule = (rule: Rule) => {
    selectedRule.value = rule;
    ruleDetailsVisible.value = true;
};

const actionStyle = (action: string) => {
    const level = levelForAction(action);
    return { backgroundColor: level.color, color: level.textColor };
};

const shorten = (uri: string) => uri.split(/[/#]/).filter(Boolean).pop() ?? uri;

const formatConstraint = (constraint: RawConstraint) => {
    const left = shorten(constraint.leftOperand);
    const operator = shorten(constraint.operator);
    const right = constraint.rightOperand.map(shorten).join(', ');
    return `${left} ${operator} ${right}`;
};

const handleDelete = async (ruleToDelete: Rule) => {
    if (!props.policyId) return;

    const payload: RuleUpdate = {
        updateType: "remove",
        rule: ruleToDelete,
        policyId: props.policyId,
    };

    podStore.updatePolicy([payload], controllerStore.current);
    deletingRuleId.value = null;
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
    margin-bottom: 1em;
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

button {
    padding: 0.6rem 1.2rem;
    border: none;
    border-radius: var(--base-corner);
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

button.primary {
    background-color: var(--solid-purple);
    color: white;
}

button.primary:hover {
    background-color: #6b3be8;
}

button.secondary {
    background-color: var(--lama-gray);
    color: var(--off-black);
}

button.secondary:hover {
    background-color: #bfbfbf;
}

button.danger {
    background-color: color-mix(in srgb, var(--lama-red, #e5484d) 15%, white);
    color: var(--lama-red, #e5484d);
}

button.danger:hover {
    background-color: color-mix(in srgb, var(--lama-red, #e5484d) 25%, white);
}

button.add-button{
    background-color: green;
    border-color: green;
}
</style>