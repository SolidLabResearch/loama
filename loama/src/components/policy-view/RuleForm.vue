<template>
    <div class="rule-form card" :class="internalMode">
        <h2>{{ heading }}</h2>

        <label :for="`subject`">Subject</label>
        <input :id="`subject`" v-model="form.subjectId" :disabled="!subjectEditable"
            placeholder="webId of the person or app" />

        <label :for="`resource`">Resource</label>
        <select v-if="resourcesLoaded" :id="`resource`" ref="resourceSelectEl"
            :class="{ error: errors.resourceIdentifier }"></select>
        <input v-else :id="`resource`" value="Loading resources..." disabled />


        <span class="field-label">Access level</span>
        <div class="action-options" :class="{ error: errors.action }">
            <label v-for="action in AVAILABLE_ACTIONS" :key="action" class="action-pill"
                :class="{ checked: form.action.includes(action), disabled: !editable }"
                :style="form.action.includes(action) ? actionStyle(action) : undefined">
                <input type="checkbox" :value="action" v-model="form.action" :disabled="!editable" />
                {{ action }}
            </label>
        </div>

        <div class="constraints-section">
            <span class="constraints-label">
                Constraints
                <span v-if="activeConstraintCount > 0" class="constraint-badge">{{ activeConstraintCount }}</span>
            </span>

            <div class="constraints-body">
                <!-- Purpose -->
                <details class="constraint-item" :open="purposeOpen">
                    <summary class="constraint-item-summary" @click.prevent="purposeOpen = !purposeOpen">
                        <span class="constraint-item-label">
                            Purpose
                            <span v-if="form.purposes.length > 0" class="constraint-badge">{{ form.purposes.length }}</span>
                        </span>
                        <span class="constraints-chevron" :class="{ open: purposeOpen }">&#8250;</span>
                    </summary>
                    <div class="constraint-item-body">
                        <select v-if="purposesLoaded" :id="`purpose`" ref="purposeSelectEl" multiple></select>
                        <input v-else :id="`purpose`" value="Loading purposes..." disabled />
                    </div>
                </details>

                <!-- Time window -->
                <details class="constraint-item" :open="timeOpen">
                    <summary class="constraint-item-summary" @click.prevent="timeOpen = !timeOpen">
                        <span class="constraint-item-label">
                            Time window
                            <span v-if="form.startTime || form.endTime" class="constraint-badge">{{ [form.startTime, form.endTime].filter(Boolean).length }}</span>
                        </span>
                        <span class="constraints-chevron" :class="{ open: timeOpen }">&#8250;</span>
                    </summary>
                    <div class="constraint-item-body">
                        <label :for="`startTime`">Start Time</label>
                        <input type="datetime-local" :id="`startTime`" v-model="form.startTime" :disabled="!editable" />
                        <label :for="`endTime`">End Time</label>
                        <input type="datetime-local" :id="`endTime`" v-model="form.endTime" :disabled="!editable" />
                    </div>
                </details>

                <!-- Verifiable Credential -->
                <details class="constraint-item" :open="vcOpen">
                    <summary class="constraint-item-summary" @click.prevent="vcOpen = !vcOpen">
                        <span class="constraint-item-label">
                            Verifiable Credential
                            <span v-if="form.vcPath.trim() && form.vcValues.length > 0" class="constraint-badge">1</span>
                            <span v-else-if="errors.vcConstraint || vcPathInvalid" class="constraint-badge error-badge">!</span>
                        </span>
                        <span class="constraints-chevron" :class="{ open: vcOpen }">&#8250;</span>
                    </summary>
                    <div class="constraint-item-body">
                        <label :for="`vcPath`">JSONPath</label>
                        <input :id="`vcPath`" v-model="form.vcPath" :disabled="!editable"
                            :class="{ error: errors.vcConstraint || vcPathInvalid }"
                            placeholder="$.credentialSubject['gx:legalAddress']['gx:countrySubdivisionCode']" />
                        <span v-if="vcPathInvalid" class="field-hint error-hint">Invalid JSONPath expression</span>
                        <label :for="`vcValues`">Equals</label>
                        <select :id="`vcValues`" ref="vcValueSelectEl" multiple :class="{ error: errors.vcConstraint }"></select>
                        <label :for="`vcType`">Credential type <span class="optional-hint">(optional)</span></label>
                        <input :id="`vcType`" v-model="form.vcCredentialSubjectType" :disabled="!editable"
                            placeholder="(optional) type IRI to check the VC against, e.g. http://example.org/UserHcpRelationVC" />
                    </div>
                </details>
            </div>
        </div>

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
import { computed, onMounted, reactive, ref, watch } from 'vue';
import type { Rule, Constraint, RuleUpdate } from 'loama-controller';
import { levelForAction } from '@/lib/Accesslevel';
import { loadPurposes, PURPOSES } from '@/lib/Purposes';
import { useTomSelectMultiple, useTomSelectSingle } from '@/lib/Usetomselect'
import { usePodStore } from '@/lib/state';
import { useControllerStore } from '@/stores/useControllerStore';
import 'tom-select/dist/css/tom-select.css';
import jsonpath from 'jsonpath';

const podStore = usePodStore();
const controllerStore = useControllerStore()

const AVAILABLE_ACTIONS = ['read', 'append', 'write', 'create', 'control'];

const props = withDefaults(defineProps<{
    rule?: Rule | null;
    mode?: 'view' | 'edit' | 'create';
    policyId?: string | null;
    initialSubjectId?: string | null;
}>(), {
    rule: null,
    mode: 'view',
    policyId: null,
    initialSubjectId: null
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
    vcPath: '',
    vcValues: [] as string[],
    vcCredentialSubjectType: '',
});

const errors = ref({ resourceIdentifier: false, action: false, vcConstraint: false });
const confirmingDelete = ref(false);
const resourcesLoaded = ref(false);
const purposesLoaded = ref(false);
const purposeOpen = ref(false);
const timeOpen = ref(false);
const vcOpen = ref(false);

const isValidJsonPath = (path: string): boolean => {
    const trimmed = path.trim();
    if (!trimmed) return true;
    try {
        jsonpath.parse(trimmed);
        return true;
    } catch {
        return false;
    }
};

const vcPathInvalid = ref(false);

let vcPathDebounce: ReturnType<typeof setTimeout> | null = null;
watch(() => form.vcPath, (path) => {
    if (vcPathDebounce) clearTimeout(vcPathDebounce);
    vcPathDebounce = setTimeout(() => {
        vcPathInvalid.value = editable.value && !isValidJsonPath(path);
    }, 400);
});

const activeConstraintCount = computed(() => {
    let count = 0;
    if (form.purposes.length > 0) count++;
    if (form.startTime) count++;
    if (form.endTime) count++;
    if (form.vcPath.trim() && form.vcValues.length > 0) count++;
    return count;
});

watch(() => form.action.length, (newLength) => {
    if (newLength > 0 && errors.value.action) {
        errors.value.action = false;
    }
});

watch([() => form.vcPath, () => form.vcValues.length], ([path, valueCount]) => {
    if (errors.value.vcConstraint && Boolean(path.trim()) === (valueCount > 0)) {
        errors.value.vcConstraint = false;
    }
});

const editable = computed(() => internalMode.value !== 'view');

const selectedPolicy = computed(() => {
    return podStore.policies.find((p) => p.id === props.policyId) ?? null;
});

const subjectEditable = computed(() => {
    return editable.value && selectedPolicy.value?.type !== 'Agreement';
});

const resourceSelectEl = ref<HTMLSelectElement | null>(null);
const resourceModel = computed<string>({
    get: () => form.resourceIdentifier,
    set: (value) => { form.resourceIdentifier = value; },
});

const purposeSelectEl = ref<HTMLSelectElement | null>(null);
const purposesModel = computed<string[]>({
    get: () => form.purposes,
    set: (value) => { form.purposes = value; },
});

useTomSelectSingle(resourceSelectEl, resourceModel, editable, () => ({
    options: podStore.resources.map((r) => ({ value: r, text: r })),
    valueField: 'value',
    labelField: 'text',
    searchField: ['text'],
    placeholder: 'Search resources…',
    create: false,
}));

useTomSelectMultiple(purposeSelectEl, purposesModel, editable, {
    options: PURPOSES.options,
    optgroups: PURPOSES.groups,
    optgroupField: 'group',
    labelField: 'name',
    valueField: 'value',
    searchField: ['name', 'desc', 'value'],
    placeholder: 'Search purposes or enter a custom IRI…',
    create: true,
    render: {
        optgroup_header: (data: { label: string }) => `<div class="optgroup-header">${data.label}</div>`,
        option: (data: { name: string; desc?: string }) =>
            `<div><strong>${data.name}</strong>${data.desc ? `<div>${data.desc}</div>` : ''}</div>`,
    },
});

const vcValueSelectEl = ref<HTMLSelectElement | null>(null);
const vcValuesModel = computed<string[]>({
    get: () => form.vcValues,
    set: (value) => { form.vcValues = value; },
});

useTomSelectMultiple(vcValueSelectEl, vcValuesModel, editable, {
    create: true,
    persist: false,
    placeholder: 'Enter a value and press enter…',
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

        form.vcPath = '';
        form.vcValues = [];
        form.vcCredentialSubjectType = '';

        props.rule.constraint.forEach(c =>{
            if (c.leftOperand == "http://www.w3.org/ns/odrl/2/purpose") {
                    c.rightOperand.forEach(p => {
                        form.purposes.push(p);
                    });
                }
            else if (c.leftOperand === "http://www.w3.org/ns/odrl/2/dateTime") {
                const rawStr = c.rightOperand[0];
                if (!rawStr) return;

                const cleanStr = rawStr.split('^^')[0].replace(/^"|"$/g, '');
                const dateObj = new Date(cleanStr);

                if (!isNaN(dateObj.getTime())) {
                    const formattedDate = dateObj.toISOString().slice(0, 16);

                    if (c.operator === "http://www.w3.org/ns/odrl/2/gt" || c.operator === "http://www.w3.org/ns/odrl/2/gteq") {
                        form.startTime = formattedDate;
                    } else if (c.operator === "http://www.w3.org/ns/odrl/2/lt" || c.operator === "http://www.w3.org/ns/odrl/2/lteq") {
                        form.endTime = formattedDate;
                    }
                }
            }
            else if (c.type === 'VC') {
                form.vcPath = c.leftOperand;
                form.vcValues = [...c.rightOperand];
                form.vcCredentialSubjectType = c.credentialSubjectType ?? '';
            }
        });

    } else {
        form.subjectId = props.initialSubjectId ?? '';
        form.resourceIdentifier = '';
        form.type = 'Permission';
        form.action = [];
        form.purposes = [];
        form.startTime = '';
        form.endTime = '';
        form.vcPath = '';
        form.vcValues = [];
        form.vcCredentialSubjectType = '';
    }

    errors.value = { resourceIdentifier: false, action: false, vcConstraint: false };
    vcPathInvalid.value = false;
    confirmingDelete.value = false;
    purposeOpen.value = form.purposes.length > 0;
    timeOpen.value = Boolean(form.startTime || form.endTime);
    vcOpen.value = Boolean(form.vcPath.trim() && form.vcValues.length > 0);
};

// Reset form whenever the passed-in rule or mode prop changes
watch(() => [props.rule, props.mode], resetForm, { immediate: true });

onMounted(async () => {
    await loadPurposes();
    purposesLoaded.value = true;
    await podStore.loadResources(controllerStore.current);
    resourcesLoaded.value = true;
    resetForm();
});

const actionStyle = (action: string) => {
    const level = levelForAction(action);
    return { backgroundColor: level.color, color: level.textColor };
};

const validate = () => {
    errors.value.resourceIdentifier = !form.resourceIdentifier.trim();
    errors.value.action = form.action.length === 0;
    // JSONPath and values are only valid together: both filled in, or both empty.
    errors.value.vcConstraint = Boolean(form.vcPath.trim()) !== (form.vcValues.length > 0);
    vcPathInvalid.value = !isValidJsonPath(form.vcPath);
    if (errors.value.vcConstraint || vcPathInvalid.value) { vcOpen.value = true; }
    return !(errors.value.resourceIdentifier || errors.value.action || errors.value.vcConstraint || vcPathInvalid.value);
};

const startEdit = () => {
    internalMode.value = 'edit';
};

const handleSave = async () => {
    if (!validate()) return;

      const constraints: Constraint[] = [];

        constraints.push({
          type: 'ODRL',
          leftOperand: 'http://www.w3.org/ns/odrl/2/purpose',
          operator: 'http://www.w3.org/ns/odrl/2/isAnyOf',
          rightOperand: form.purposes,
        });

        if (form.startTime) {
            const startIso = new Date(form.startTime).toISOString();
            constraints.push({
            type: 'ODRL',
            leftOperand: 'http://www.w3.org/ns/odrl/2/dateTime',
            operator: 'http://www.w3.org/ns/odrl/2/gt',
            rightOperand: [`"${startIso}"^^http://www.w3.org/2001/XMLSchema#:dateTime`]
            });
        }

        if (form.endTime) {
            const endIso = new Date(form.endTime).toISOString();
            constraints.push({
            type: 'ODRL',
            leftOperand: 'http://www.w3.org/ns/odrl/2/dateTime',
            operator: 'http://www.w3.org/ns/odrl/2/lt',
            rightOperand: [`"${endIso}"^^http://www.w3.org/2001/XMLSchema#:dateTime`]
            });
        }

        if (form.vcPath.trim() && form.vcValues.length > 0) {
            constraints.push({
            type: 'VC',
            leftOperand: form.vcPath.trim(),
            operator: form.vcValues.length > 1
                ? 'http://www.w3.org/ns/odrl/2/isAnyOf'
                : 'http://www.w3.org/ns/odrl/2/eq',
            rightOperand: [...form.vcValues],
            ...(form.vcCredentialSubjectType.trim() ? { credentialSubjectType: form.vcCredentialSubjectType.trim() } : {}),
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
    emit('close');
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

.optional-hint {
    font-weight: 400;
    font-size: calc(var(--base-unit) * 1.5);
    opacity: 0.6;
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

div.error label{
    border: 2px solid var(--lama-red, #e5484d) !important;
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

.constraints-section {
    border: 0.125rem solid var(--lama-gray);
    border-radius: var(--base-corner);
    padding: 0.5rem 0.5rem 0.5rem;
    margin-top: 0.25rem;
}

.constraints-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.25rem 0.35rem;
    font-size: calc(var(--base-unit) * 2);
    font-weight: 500;
    color: var(--off-black);
}

.constraint-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.3rem;
    border-radius: 999px;
    background-color: var(--solid-purple);
    color: white;
    font-size: calc(var(--base-unit) * 1.5);
    font-weight: 700;
}

.constraints-chevron {
    font-size: 1.25rem;
    line-height: 1;
    transition: transform 0.2s ease;
    transform: rotate(0deg);
}

.constraints-chevron.open {
    transform: rotate(90deg);
}

.constraints-body {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.25rem 0.5rem 0.5rem;
}

.constraint-item {
    border: 0.125rem solid var(--lama-gray);
    border-radius: var(--base-corner);
}

.constraint-item-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.65rem;
    cursor: pointer;
    list-style: none;
    user-select: none;
    font-size: calc(var(--base-unit) * 1.75);
    font-weight: 500;
    color: var(--off-black);
    border-radius: var(--base-corner);
}

.constraint-item-summary::-webkit-details-marker {
    display: none;
}

.constraint-item-summary:hover {
    background-color: color-mix(in srgb, var(--lama-gray) 30%, white);
}

.constraint-item-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
}

.error-badge {
    background-color: var(--lama-red, #e5484d) !important;
}

.constraint-item-body {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.25rem 0.65rem 0.65rem;
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

.field-hint {
    font-size: calc(var(--base-unit) * 1.5);
    margin-top: -0.15rem;
}

.error-hint {
    color: var(--lama-red, #e5484d);
}
</style>
