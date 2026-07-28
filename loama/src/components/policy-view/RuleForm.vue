<template>
    <div class="rule-form card" :class="internalMode">
        <h2>{{ heading }}</h2>

        <label :for="`subject`">Subject</label>
        <input :id="`subject`" v-model="form.subjectId" :disabled="!editable"
            :class="{ error: errors.subjectId }" placeholder="webId of the person or app" />

        <label :for="`resource`">Resource</label>
        <input :id="`resource`" v-model="form.resourceIdentifier" :disabled="!editable"
            :class="{ error: errors.resourceIdentifier }" placeholder="resource url" />


        <span class="field-label">Access level</span>
        <div class="action-options" :class="{ error: errors.action }">
            <label v-for="action in AVAILABLE_ACTIONS" :key="action" class="action-pill"
                :class="{ checked: form.action.includes(action), disabled: !editable }"
                :style="form.action.includes(action) ? actionStyle(action) : undefined">
                <input type="checkbox" :value="action" v-model="form.action" :disabled="!editable" />
                {{ action }}
            </label>
        </div>

        <label :for="`purpose`">Purpose</label>
        <select :id="`purpose`" ref="purposeSelectEl" multiple></select>

        <label :for="`startTime`">Start Time</label>
        <input type="datetime-local" :id="`startTime`" v-model="form.startTime" :disabled="!editable" />

        <label :for="`endTime`">End Time</label>
        <input type="datetime-local" :id="`endTime`" v-model="form.endTime" :disabled="!editable" />

        <div class="actions">
            <template v-if="internalMode === 'view'">
                <template v-if="!confirmingDelete">
                    <button type="button" class="secondary" @click="startEdit">Edit</button>
                    <button type="button" class="danger" @click="confirmingDelete = true">Delete</button>
                </template>
                <template v-else>
                    <span class="confirm-text">Delete this rule?</span>
                    <button type="button" class="danger" @click="handleDelete">Yes, delete</button>
                    <button type="button" class="secondary" @click="confirmingDelete = false">Cancel</button>
                </template>
            </template>
            <template v-else>
                <button type="button" class="primary" @click.prevent="handleSave">
                    {{ internalMode === 'create' ? 'Create rule' : 'save' }}
                </button>
                <button type="button" class="secondary" @click.prevent="cancel">cancel</button>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import type { Rule, Constraint, RuleUpdate, Policy } from 'loama-controller';
import { levelForAction } from '@/lib/Accesslevel';
import { PURPOSES } from '@/lib/Purposes';
import { useTomSelectMultiple } from '@/lib/Usetomselect'
import { usePodStore } from '@/lib/state';
import { useControllerStore } from '@/stores/useControllerStore';
import 'tom-select/dist/css/tom-select.css';

const podStore = usePodStore();
const controllerStore = useControllerStore()

const AVAILABLE_ACTIONS = ['read', 'append', 'write', 'create', 'control'];

const props = withDefaults(defineProps<{
    rule?: Rule | null;
    mode?: 'view' | 'edit' | 'create';
    policyId?: string | null;
}>(), {
    rule: null,
    mode: 'view',
    policyId: null
});

const emit = defineEmits(['close']);

const internalMode = ref<'view' | 'edit' | 'create'>(props.mode);

const form = reactive({
    subjectId: '',
    resourceIdentifier: '',
    type: 'Permission' as Rule['type'],
    action: [] as string[],
    purposes: [] as string[],
    startTime: '',
    endTime: '',
});

const errors = ref({ subjectId: false, resourceIdentifier: false, action: false });
const confirmingDelete = ref(false);

const editable = computed(() => internalMode.value !== 'view');

const purposeSelectEl = ref<HTMLSelectElement | null>(null);
const purposesModel = computed<string[]>({
    get: () => form.purposes,
    set: (value) => { form.purposes = value; },
});

useTomSelectMultiple(purposeSelectEl, purposesModel, editable, {
    options: PURPOSES.options,
    optgroups: PURPOSES.groups,
    optgroupField: 'group',
    labelField: 'name',
    valueField: 'value',
    searchField: ['name', 'desc', 'value'],
    render: {
        optgroup_header: (data: { label: string }) => `<div class="optgroup-header">${data.label}</div>`,
        option: (data: { name: string; desc: string }) => `<div><strong>${data.name}</strong><div>${data.desc}</div></div>`,
    },
});

const heading = computed(() => {
    if (internalMode.value === 'create') return 'Create rule';
    if (internalMode.value === 'edit') return 'Edit rule';
    return 'Rule';
});

const resetForm = () => {
    internalMode.value = props.mode;

    if (props.rule) {
        form.subjectId = props.rule.subjectId ?? '';
        form.resourceIdentifier = props.rule.resourceIdentifier ?? '';
        form.type = props.rule.type ?? 'permission';
        form.action = props.rule.action 
            ? props.rule.action
                .map(actionUri => actionUri.split('/').pop())
                .filter((action): action is string => Boolean(action))
            : [];

        props.rule.constraint.forEach(c =>{
            if (c.leftOperand == "http://www.w3.org/ns/odrl/2/purpose") {
                    c.rightOperand.forEach(p => {
                        const extracted = p.split('/').pop();
                        if (extracted) {
                            const formattedPurpose = extracted.replace('#', ':');
                            form.purposes.push(formattedPurpose);
                        }
                    });
                }
            else if(c.leftOperand == "http://www.w3.org/ns/odrl/2/dateTime"){
                const isoStr = c.rightOperand[0].match(/^[^"]+/)?.[0];

                if (isoStr) {
                    // Format required by <input type="datetime-local">
                    const formattedDate = isoStr.slice(0, 16); 

                    if (c.operator == "http://www.w3.org/ns/odrl/2/gt") {
                        form.startTime = formattedDate;
                    } else if (c.operator == "http://www.w3.org/ns/odrl/2/lt") {
                        form.endTime = formattedDate;
                    }
                }
            }
        });

    } else {
        form.subjectId = '';
        form.resourceIdentifier = '';
        form.type = 'Permission';
        form.action = [];
        form.purposes = [];
        form.startTime = '';
        form.endTime = '';
    }

    errors.value = { subjectId: false, resourceIdentifier: false, action: false };
    confirmingDelete.value = false;
};

// Reset form whenever the passed-in rule or mode prop changes
watch(() => [props.rule, props.mode], resetForm, { immediate: true });

const actionStyle = (action: string) => {
    const level = levelForAction(action);
    return { backgroundColor: level.color, color: level.textColor };
};

const validate = () => {
    errors.value.subjectId = !form.subjectId.trim();
    errors.value.resourceIdentifier = !form.resourceIdentifier.trim();
    errors.value.action = form.action.length === 0;
    return !(errors.value.subjectId || errors.value.resourceIdentifier || errors.value.action);
};

const startEdit = () => {
    internalMode.value = 'edit';
};

const handleSave = async () => {
    if (!validate()) return;

      const constraints: Constraint[] = [];

        form.purposes.forEach(purpose => {
            constraints.push({
            leftOperand: 'http://www.w3.org/ns/odrl/2/purpose',
            operator: 'http://www.w3.org/ns/odrl/2/eq',
            rightOperand: purpose.startsWith('http') ? [purpose] : [`https://w3id.org/dpv#${purpose.replace('dpv:', '')}`]
            });
        });

        if (form.startTime) {
            const startIso = new Date(form.startTime).toISOString();
            constraints.push({
            leftOperand: 'http://www.w3.org/ns/odrl/2/dateTime',
            operator: 'http://www.w3.org/ns/odrl/2/gt',
            rightOperand: [`"${startIso}""^^xsd:dateTime"`]
            });
        }

        if (form.endTime) {
            const endIso = new Date(form.endTime).toISOString();
            constraints.push({
            leftOperand: 'http://www.w3.org/ns/odrl/2/dateTime',
            operator: 'http://www.w3.org/ns/odrl/2/lt',
            rightOperand: [`"${endIso}""^^xsd:dateTime"`]
            });
        }

    const updatedRule: Rule = {
        id: props.rule?.id ?? `urn:uuid:${crypto.randomUUID()}`,
        type: form.type,
        subjectId: form.subjectId.trim(),
        resourceIdentifier: form.resourceIdentifier.trim(),
        action: [...form.action],
        constraint: constraints,
    };

    const payload: RuleUpdate = {
        updateType: internalMode.value === 'create' ? 'add' : 'edit',
        rule: updatedRule,
        policyId: props.policyId,
    };

    podStore.updatePolicy([payload], controllerStore.current);
    emit('close');
};

const cancel = () => {
    resetForm();
};

const handleDelete = async () => {
    if (!props.rule) return;

    const deleteRule: Rule = {
        id: props.rule.id,
        type: form.type,
        subjectId: props.rule.subjectId,
        resourceIdentifier: props.rule.resourceIdentifier,
        action: props.rule.action,
        constraint: props.rule.constraint,
    };


    const payload: RuleUpdate = {
        updateType: "remove",
        rule: deleteRule,
        policyId: props.policyId,
    };

    console.log(payload);

    podStore.updatePolicy([payload], controllerStore.current);
    confirmingDelete.value = false;
    emit('close');
};
</script>

<style scoped>
.rule-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1.5rem;
    border: 0.125rem solid var(--lama-gray);
    border-radius: var(--base-corner);
    background-color: var(--off-white);
}

.rule-form h2 {
    margin: 0 0 0.5rem;
    font-size: calc(var(--base-unit) * 3);
    color: var(--off-black);
}

.field-label {
    margin-top: 0.5rem;
    font-size: calc(var(--base-unit) * 2);
    font-weight: 500;
    color: var(--off-black);
}

label {
    margin-top: 0.5rem;
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

:deep(.ts-wrapper) {
    font-size: calc(var(--base-unit) * 2);
}

:deep(.ts-control) {
    padding: 0.5rem 0.75rem;
    border: 0.125rem solid var(--lama-gray);
    border-radius: var(--base-corner);
    background-color: var(--off-white);
    transition: border-color 0.2s ease;
}

:deep(.ts-wrapper.focus .ts-control) {
    border-color: var(--solid-purple);
}

:deep(.ts-wrapper.disabled .ts-control) {
    background-color: color-mix(in srgb, var(--lama-gray) 40%, white);
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
    cursor: not-allowed;
}

:deep(.ts-dropdown) {
    border: 0.125rem solid var(--lama-gray);
    border-radius: var(--base-corner);
    background-color: var(--off-white);
}

:deep(.ts-dropdown .optgroup-header) {
    font-weight: 700;
    color: var(--off-black);
    padding: 0.4rem 0.75rem 0.1rem;
    font-size: calc(var(--base-unit) * 1.5);
    text-transform: uppercase;
    opacity: 0.6;
}

:deep(.ts-dropdown .option strong) {
    color: var(--off-black);
}

:deep(.ts-dropdown .option div div) {
    font-size: calc(var(--base-unit) * 1.5);
    opacity: 0.7;
}

:deep(.ts-wrapper .item) {
    background-color: color-mix(in srgb, var(--solid-purple) 15%, white);
    color: var(--solid-purple);
    border-radius: 999px;
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

.action-pill input:focus-visible {
    outline: none;
}

.action-pill:has(input:focus-visible) {
    outline: 0.125rem solid var(--solid-purple);
    outline-offset: 0.1875rem;
}

.actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.5rem;
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