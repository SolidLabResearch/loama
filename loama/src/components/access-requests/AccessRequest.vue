<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import type { AccessRequest, Constraint } from 'loama-controller';
import AccessRequestEntry from './AccessRequestEntry.vue';
import { levelForAction } from '@/lib/Accesslevel';
import { useControllerStore } from '@/stores/useControllerStore';
import { loadPurposes, PURPOSES } from '@/lib/Purposes';
import { useTomSelectMultiple } from '@/lib/Usetomselect'
import 'tom-select/dist/css/tom-select.css';

const controllerStore = useControllerStore();
const AVAILABLE_ACTIONS = ['read', 'append', 'write', 'create', 'control'];

const accessRequests: Ref<AccessRequest[]> = ref([]);
const purposesLoaded = ref(false);

const accessRequestParams = ref({
  target: '',
  actions: [] as string[],
  purposes: [] as string[],
  startTime: '',
  endTime: '',
});

const purposeSelectEl = ref<HTMLSelectElement | null>(null);
const purposesEditable = ref(true);
const purposesModel = computed<string[]>({
  get: () => accessRequestParams.value.purposes,
  set: (value) => { accessRequestParams.value.purposes = value; },
});

useTomSelectMultiple(purposeSelectEl, purposesModel, purposesEditable, {
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

const mode = ref<'list' | 'create'>('list');

const errors = ref<{ target: boolean; action: boolean }>({
  target: false,
  action: false,
});

const actionStyle = (action: string) => {
  const level = levelForAction(action);
  return { backgroundColor: level.color, color: level.textColor };
};

const validate = () => {
  errors.value.target = !accessRequestParams.value.target.trim();
  errors.value.action = accessRequestParams.value.actions.length === 0;
  return !(errors.value.target || errors.value.action );
};

const clear = () => {
  accessRequestParams.value = { target: '', actions: [], purposes: [], startTime: '', endTime: '',};
  mode.value = 'list';
  errors.value = { target: false, action: false };
};

const addAccessRequest = async () => {
  if (!validate()) return;

  const constraints: Constraint[] = [];

  if (accessRequestParams.value.purposes.length > 0) {
    constraints.push({
      type: 'ODRL',
      leftOperand: 'http://www.w3.org/ns/odrl/2/purpose',
      operator: accessRequestParams.value.purposes.length > 1
        ? 'http://www.w3.org/ns/odrl/2/isAnyOf'
        : 'http://www.w3.org/ns/odrl/2/eq',
      rightOperand: [...accessRequestParams.value.purposes]
    });
  }

  if (accessRequestParams.value.startTime) {
    const startIso = new Date(accessRequestParams.value.startTime).toISOString();
    constraints.push({
      type: 'ODRL',
      leftOperand: 'http://www.w3.org/ns/odrl/2/dateTime',
      operator: 'http://www.w3.org/ns/odrl/2/gt',
      rightOperand: [`"${startIso}"^^http://www.w3.org/2001/XMLSchema#dateTime`]
    });
  }

  if (accessRequestParams.value.endTime) {
    const endIso = new Date(accessRequestParams.value.endTime).toISOString();
    constraints.push({
      type: 'ODRL',
      leftOperand: 'http://www.w3.org/ns/odrl/2/dateTime',
      operator: 'http://www.w3.org/ns/odrl/2/lt',
      rightOperand: [`"${endIso}"^^http://www.w3.org/2001/XMLSchema#dateTime`]
    });
  }

  await controllerStore.current.requestAccess({
    accessRequest: {
      uid: `http://example.org/request/${crypto.randomUUID()}`,
      target: accessRequestParams.value.target,
      actions: [...accessRequestParams.value.actions],
      constraint: constraints,
      requestingParty: '', //ToDo
      status: 'Requested'
    }
  });

  await fetchAccessRequests();
  clear();
};

const fetchAccessRequests = async (): Promise<void> => {
  accessRequests.value = (await controllerStore.current.getAccessRequests()).asRequestingParty;
}

let interval: NodeJS.Timeout;

onMounted(async () => {
  await loadPurposes();
  purposesLoaded.value = true;
  await fetchAccessRequests();
  interval = setInterval(fetchAccessRequests, 10 ** 4);
});

onBeforeUnmount(() => clearInterval(interval));
</script>

<template>
  <div class="container">
    <transition name="fade-slide" mode="out-in">
      <div v-if="mode === 'create'" key="create" class="card">
        <h2>Request access</h2>

        <label for="target">What resource do you want to request access to?</label>
        <input
          id="target"
          v-model="accessRequestParams.target"
          placeholder="enter resource url"
          :class="{ error: errors.target }"
        />

        <label for="action">What do you want to do with this resource?</label>
        <div class="action-options" :class="{ error: errors.action }">
          <label
            v-for="action in AVAILABLE_ACTIONS"
            :key="action"
            class="action-pill"
            :class="{ checked: accessRequestParams.actions.includes(action) }"
            :style="accessRequestParams.actions.includes(action) ? actionStyle(action) : undefined"
          >
            <input type="checkbox" :value="action" v-model="accessRequestParams.actions" />
            {{ action }}
          </label>
        </div>

        <label for="purpose">Purpose</label>
        <select v-if="purposesLoaded" name="purpose" id="purpose" ref="purposeSelectEl" multiple></select>
        <input v-else id="purpose" value="Loading purposes..." disabled />

        <label for="StartTime">Start Time</label>
        <input type="datetime-local" id="StartTime" v-model="accessRequestParams.startTime">
        <label for="EndTime">End Time</label>
        <input type="datetime-local" id="EndTime" v-model="accessRequestParams.endTime">

        <div class="actions">
          <button class="primary" @click.prevent="addAccessRequest">request access</button>
          <button class="secondary" @click.prevent="clear">cancel</button>
        </div>
      </div>

      <div v-else key="list" class="requests-list">
        <div class="card header-card">
          <h2>Your access requests</h2>
          <div class="buttons">
            <button class="new-request-button" @click.prevent="mode = 'create'">new request</button>
            <button @click="fetchAccessRequests" class="refresh-button">refresh</button>
          </div>
        </div>

        <div class="card">
          <h3>Requested</h3>
          <div v-if="accessRequests.filter(r => r.status.toLowerCase() === 'requested').length">
            <div
              v-for="request in accessRequests.filter(r => r.status.toLowerCase() === 'requested')"
              :key="request.uid"
              class="access-request-item"
            >
              <AccessRequestEntry :request="request" :show-id="false"/>
            </div>
          </div>
          <div v-else class="no-requests-message">
            No pending requests at the moment.
          </div>
        </div>

        <div class="card">
          <h3>Accepted</h3>
          <div v-if="accessRequests.filter(r => r.status.toLowerCase() === 'accepted').length">
            <div
              v-for="request in accessRequests.filter(r => r.status.toLowerCase() === 'accepted')"
              :key="request.uid"
              class="access-request-item"
            >
              <AccessRequestEntry :request="request" :show-id="false"/>
            </div>
          </div>
          <div v-else class="no-requests-message">
            No accepted requests.
          </div>
        </div>

        <div class="card">
          <h3>Denied</h3>
          <div v-if="accessRequests.filter(r => r.status.toLowerCase() === 'denied').length">
            <div
              v-for="request in accessRequests.filter(r => r.status.toLowerCase() === 'denied')"
              :key="request.uid"
              class="access-request-item"
            >
              <AccessRequestEntry :request="request" :show-id="false"/>
            </div>
          </div>
          <div v-else class="no-requests-message">
            No denied requests.
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem;
  background-color: var(--off-white);
}

/* Shared card style */
.card {
  background-color: white;
  padding: 1.5rem;
  border-radius: var(--base-corner);
  box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.header-card {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.buttons {
  display: flex;
  gap: 0.5rem;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

h2 {
  color: var(--solid-purple);
  font-weight: 700;
  font-size: 1.25rem;
  margin: 0;
}

h3 {
  color: var(--off-black);
  font-weight: 600;
  font-size: 1.1rem;
  border-bottom: 1px solid var(--lama-gray);
  padding-bottom: 0.5rem;
  margin-bottom: 0.5rem;
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

input:focus,
select:focus {
  border-color: var(--solid-purple);
  outline: none;
}

input.error,
select.error,
.action-options.error {
  border-color: var(--lama-red);
  background-color: #ffe6e9;
}

div.error label {
  border: 2px solid var(--lama-red) !important;
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

/* Each request entry */
.access-request-item {
  padding: 0.5rem 0;
}

/* Buttons */
button {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: var(--base-corner);
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.refresh-button {
  background-color: var(--lama-gray);
  color: var(--off-black);
}
.refresh-button:hover {
  background-color: #bfbfbf;
}

button.primary,
.new-request-button {
  background-color: var(--solid-purple);
  color: white;
}
button.primary:hover,
.new-request-button:hover {
  background-color: #6b3be8;
}

button.secondary {
  background-color: var(--lama-gray);
  color: var(--off-black);
}
button.secondary:hover {
  background-color: #bfbfbf;
}

.actions {
  display: flex;
  gap: 1rem;
}

.requests-list {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.no-requests-message {
  color: var(--off-black);
  font-style: italic;
  text-align: center;
  padding: 1rem;
}

/* Transition styles */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
