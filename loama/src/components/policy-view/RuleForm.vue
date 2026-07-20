<template>
    <div class="rule-form" :class="mode">
        <div class="field">
            <label :for="`${idPrefix}-subject`">Subject</label>
            <input :id="`${idPrefix}-subject`" v-model="form.subjectId" :disabled="!editable"
                :class="{ error: errors.subjectId }" placeholder="webId of the person or app" />
        </div>

        <div class="field">
            <label :for="`${idPrefix}-resource`">Resource</label>
            <input :id="`${idPrefix}-resource`" v-model="form.resourceIdentifier" :disabled="!editable"
                :class="{ error: errors.resourceIdentifier }" placeholder="resource url" />
        </div>

        <div class="field">
            <label :for="`${idPrefix}-type`">Type</label>
            <select :id="`${idPrefix}-type`" v-model="form.type" :disabled="!editable">
                <option value="permission">permission</option>
                <option value="prohibition">prohibition</option>
            </select>
        </div>

        <div class="field">
            <span class="field-label">Actions</span>
            <div class="action-options" :class="{ error: errors.action }">
                <label v-for="action in AVAILABLE_ACTIONS" :key="action" class="action-pill"
                    :class="{ checked: form.action.includes(action), disabled: !editable }"
                    :style="form.action.includes(action) ? actionStyle(action) : undefined">
                    <input type="checkbox" :value="action" v-model="form.action" :disabled="!editable" />
                    {{ action }}
                </label>
            </div>
        </div>

        <div class="field">
            <span class="field-label">Constraints</span>
            <div v-if="form.constraint.length === 0 && !editable" class="no-constraints">No constraints</div>
            <div v-for="(constraint, index) in form.constraint" :key="index" class="constraint-row">
                <input v-model="constraint.leftOperand" :disabled="!editable" placeholder="left operand"
                    aria-label="Constraint left operand" />
                <input v-model="constraint.operator" :disabled="!editable" placeholder="operator"
                    aria-label="Constraint operator" />
                <input v-model="constraint.rightOperandText" :disabled="!editable"
                    placeholder="right operand(s), comma separated" aria-label="Constraint right operand" />
                <button v-if="editable" type="button" class="remove-constraint" @click="removeConstraint(index)"
                    aria-label="Remove constraint">
                    <PhX :size="16" />
                </button>
            </div>
            <button v-if="editable" type="button" class="add-constraint" @click="addConstraint">
                + Add constraint
            </button>
        </div>

        <div class="button-row">
            <template v-if="mode === 'view'">
                <template v-if="!confirmingDelete">
                    <button type="button" class="secondary" @click="$emit('edit')">Edit</button>
                    <button type="button" class="danger" @click="confirmingDelete = true">Delete</button>
                </template>
                <template v-else>
                    <span class="confirm-text">Delete this rule?</span>
                    <button type="button" class="danger" @click="confirmDelete">Yes, delete</button>
                    <button type="button" class="secondary" @click="confirmingDelete = false">Cancel</button>
                </template>
            </template>
            <template v-else>
                <button type="button" class="primary" @click="save">Save</button>
                <button type="button" class="secondary" @click="cancel">Cancel</button>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { Rule } from 'loama-controller';
import { PhX } from '@phosphor-icons/vue';
import { levelForAction } from '@/lib/accessLevel';
import type { FlatRule, RawConstraint } from '@/lib/policyGrouping';
import type { RuleUpdate } from '@/lib/ruleUpdate';

const AVAILABLE_ACTIONS = ['read', 'append', 'write', 'create', 'control'];

const props = defineProps<{
    // null in create mode, there's no existing rule yet
    rule: FlatRule | null;
    mode: 'view' | 'edit' | 'create';
    policyId: string | null;
}>();

const emit = defineEmits<{
    edit: [];
    cancel: [];
    save: [update: RuleUpdate];
    delete: [rule: FlatRule];
}>();

// Each row keeps its right operand as free text while editing (comma
// separated) and gets split back into an array on save.
interface EditableConstraint {
    leftOperand: string;
    operator: string;
    rightOperandText: string;
}

const idPrefix = `rule-${Math.random().toString(36).slice(2, 8)}`;

const form = reactive({
    subjectId: '',
    resourceIdentifier: '',
    type: 'permission' as Rule['type'],
    action: [] as string[],
    constraint: [] as EditableConstraint[],
});

const errors = ref({ subjectId: false, resourceIdentifier: false, action: false });
const confirmingDelete = ref(false);

const editable = computed(() => props.mode !== 'view');

const toEditableConstraint = (constraint: RawConstraint): EditableConstraint => ({
    leftOperand: constraint.leftOperand,
    operator: constraint.operator,
    rightOperandText: constraint.rightOperand.join(', '),
});

const resetForm = () => {
    form.subjectId = props.rule?.subjectId ?? '';
    form.resourceIdentifier = props.rule?.resourceIdentifier ?? '';
    form.type = props.rule?.type ?? 'permission';
    form.action = props.rule ? [...props.rule.action] : [];
    form.constraint = props.rule ? props.rule.constraint.map(toEditableConstraint) : [];
    errors.value = { subjectId: false, resourceIdentifier: false, action: false };
    confirmingDelete.value = false;
};

watch(() => props.rule, resetForm, { immediate: true });

const actionStyle = (action: string) => {
    const level = levelForAction(action);
    return { backgroundColor: level.color, color: level.textColor };
};

const addConstraint = () => {
    form.constraint.push({ leftOperand: '', operator: '', rightOperandText: '' });
};

const removeConstraint = (index: number) => {
    form.constraint.splice(index, 1);
};

const validate = () => {
    errors.value.subjectId = !form.subjectId.trim();
    errors.value.resourceIdentifier = !form.resourceIdentifier.trim();
    errors.value.action = form.action.length === 0;
    return !(errors.value.subjectId || errors.value.resourceIdentifier || errors.value.action);
};

const save = () => {
    if (!validate()) return;

    const rule: Rule = {
        id: props.rule?.ruleId ?? `urn:uuid:${crypto.randomUUID()}`,
        type: form.type,
        subjectId: form.subjectId.trim(),
        resourceIdentifier: form.resourceIdentifier.trim(),
        action: [...form.action],
        constraint: form.constraint
            .filter((c) => c.leftOperand.trim() && c.operator.trim())
            .map((c) => ({
                leftOperand: c.leftOperand.trim(),
                operator: c.operator.trim(),
                rightOperand: c.rightOperandText.split(',').map((v) => v.trim()).filter(Boolean),
            })),
    };

    emit('save', {
        updateType: props.mode === 'create' ? 'add' : 'edit',
        rule,
        policyId: props.policyId,
    });
};

const cancel = () => {
    resetForm();
    emit('cancel');
};

const confirmDelete = () => {
    if (!props.rule) return;
    emit('delete', props.rule);
};
</script>

<style scoped>
.rule-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem 0;
    border-bottom: 1px solid var(--lama-gray);
}

.rule-form:last-of-type {
    border-bottom: none;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.field-label {
    font-size: calc(var(--base-unit) * 2);
    font-weight: 500;
    color: var(--off-black);
}

label {
    font-size: calc(var(--base-unit) * 2);
    font-weight: 500;
    color: var(--off-black);
}

input,
select {
    padding: 0.75rem;
    border: 0.125rem solid var(--lama-gray);
    border-radius: var(--base-corner);
    font-size: calc(var(--base-unit) * 2);
    background-color: var(--off-white);
    transition: border-color 0.2s ease;
}

input:disabled,
select:disabled {
    background-color: color-mix(in srgb, var(--lama-gray) 40%, white);
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
    cursor: not-allowed;
}

input:focus,
select:focus {
    border-color: var(--solid-purple);
    outline: none;
}

input.error,
select.error,
.action-options.error {
    border-color: var(--lama-red, #e5484d);
}

.action-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.25rem;
    border-radius: var(--base-corner);
}

.action-pill {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.3rem 0.75rem;
    border-radius: 999px;
    border: 0.125rem solid var(--lama-gray);
    font-size: calc(var(--base-unit) * 1.5);
    cursor: pointer;
    background-color: var(--off-white);
}

.action-pill.checked {
    border-color: transparent;
}

.action-pill.disabled {
    cursor: not-allowed;
}

.action-pill input {
    margin: 0;
}

.no-constraints {
    font-size: calc(var(--base-unit) * 1.5);
    font-style: italic;
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
}

.constraint-row {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: 0.5rem;
    align-items: center;
}

.remove-constraint {
    background: none;
    border: none;
    padding: 0.4rem;
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
    cursor: pointer;
    display: flex;
}

.add-constraint {
    align-self: flex-start;
    background: none;
    border: none;
    padding: 0.25rem 0;
    color: var(--solid-purple);
    font-weight: 600;
    cursor: pointer;
}

.button-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.confirm-text {
    font-size: calc(var(--base-unit) * 1.5);
    color: var(--off-black);
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
</style>