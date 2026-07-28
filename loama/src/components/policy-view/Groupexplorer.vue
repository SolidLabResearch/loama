<template>
    <div class="panel-container">
        <div class="left-panel">
            <div class="group-toggle">
                <div class="oneLine">
                    <LoButton :left-icon="PhUser" :class="{ active: groupBy === 'subject' }"
                        @click="selectGroupBy('subject')">By person</LoButton>
                    <LoButton :left-icon="PhFile" :class="{ active: groupBy === 'resource' }"
                        @click="selectGroupBy('resource')">By resource</LoButton>
                    <LoButton :left-icon="PhArchive" :class="{ active: groupBy === 'policy' }"
                        @click="selectGroupBy('policy')">By policy</LoButton>
                </div>
                <div class="oneLine">
                    <LoButton :left-icon="PhPlus" class="add-button" @click="addRuleVisible = true" aria-label="Add Rule">
                        Add Rule
                    </LoButton>
                    <LoButton :left-icon="PhArrowsClockwise" class="reload-button" :disabled="isRefreshing"
                        @click="reload" aria-label="Reload resources">
                        {{ isRefreshing ? 'Reloading...' : 'Reload' }}
                    </LoButton>

                    <Drawer style="width: 80vw"  v-model:visible="addRuleVisible" position="right"
                        class="policy-details-drawer">
                        <RuleForm mode="create" @close="addRuleVisible = false"/>
                    </Drawer>
                </div>
            </div>
            <input v-model="filterQuery" type="search" class="filter-input"
                :placeholder="`Filter ${ groupBy === 'subject' ? 'People' : groupBy === 'resource' ? 'Resources' : 'policies' } by name`"
                aria-label="Filter by name" />
            <table class="group-table">
                <thead>
                    <tr>
                        <th scope="col">Name</th>
                        <th scope="col">Level</th>
                        <th scope="col">Rules</th>
                    </tr>
                </thead>
                <tbody>
                    <GroupEntry v-for="[key, rules] in filteredGroups" :key="key" :label="key"
                        :rule-count="rules.length" :highest-level="groupHighestLevel(rules)"
                        :is-selected="selectedKey === key" @select="selectedKey = key" />
                    <tr v-if="filteredGroups.length === 0">
                        <td colspan="3" class="empty-cell">No matches</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div class="right-panel">
            <div class="default-panel-container" v-if="!selectedKey">
                <div class="default-panel">
                    <img class="side-image" src="/vault.svg" />
                    <p><strong>No {{ groupBy === 'subject' ? 'People' : groupBy === 'resource' ? 'Resources' : 'policies' }} selected!</strong></p>
                    <i>Select a row to get started</i>
                </div>
            </div>
            <SelectedGroup v-else :label="selectedKey" :rules="activeGroups.get(selectedKey) ?? []"
                :group-by="groupBy" @close="selectedKey = null" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { PhUser, PhFile, PhArrowsClockwise, PhPlus, PhArchive } from '@phosphor-icons/vue';
import LoButton from '../LoButton.vue';
import GroupEntry from './Groupentry.vue';
import SelectedGroup from './Selectedgroup.vue';
import RuleForm from './RuleForm.vue';
import { usePodStore } from '@/lib/state';
import { usePolicyGrouping, sortedGroupEntries, type FlatRule } from '@/lib/policyGrouping.js';
import { highestLevel } from '@/lib/Accesslevel.js';
import { store } from 'loama-app'
import { useControllerStore } from '@/stores/useControllerStore';
import Drawer from 'primevue/drawer';

const podStore = usePodStore();

const addRuleVisible = ref(false);
const groupBy = ref<'subject' | 'resource' | 'policy' >('subject');
const selectedKey = ref<string | null>(null);
const filterQuery = ref('');
const isRefreshing = ref(false);
let refreshInterval: ReturnType<typeof setInterval> | undefined;

const { bySubject, byResource, byPolicy } = usePolicyGrouping(computed(() => podStore.policies));

const activeGroups = computed(() => (groupBy.value === 'subject' ? bySubject.value : groupBy.value === 'resource' ? byResource.value : byPolicy.value));

const filteredGroups = computed(() => sortedGroupEntries(activeGroups.value, filterQuery.value));

const groupHighestLevel = (rules: FlatRule[]) => highestLevel(rules.flatMap((rule) => rule.action));

const controllerStore = useControllerStore()

const selectGroupBy = (value: 'subject' | 'resource' | 'policy') => {
    groupBy.value = value;
    selectedKey.value = null;
    filterQuery.value = '';
};

const reload = async () => {
    isRefreshing.value = true;
    try {
        await podStore.loadResources(store.usedPod, controllerStore.current);
    } finally {
        isRefreshing.value = false;
    }
};

onMounted(async () => {
    await reload();
    refreshInterval = setInterval(reload, 10 ** 4);
});

onUnmounted(() => {
    if (refreshInterval) clearInterval(refreshInterval);
});
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

strong {
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
    text-align: center;
    font-size: 16px;
    font-weight: 700;
}

i {
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
    text-align: center;
    font-size: 16px;
    font-style: italic;
    font-weight: 400;
}

.panel-container {
    display: flex;
    height: calc(100vh - var(--base-unit)*14);
    width: 100%;
}

.left-panel,
.right-panel {
    display: flex;
    height: 100%;
    flex-direction: column;
}

.left-panel {
    gap: 0.75rem;
    flex: 3;
    padding: 2rem 1.5rem 0 2rem;
    background-color: var(--off-white);
    border-right: 0.25rem solid var(--solid-purple);
    overflow-y: auto;
}

.group-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
}

.oneLine {
    display: flex;
    gap: 0.5rem;
}

.group-toggle .active {
    background-color: var(--off-white);
    color: var(--solid-purple);
}

.reload-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.filter-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: var(--base-corner);
    border: 1px solid color-mix(in srgb, var(--off-black) 85%, transparent);
    font-size: calc(var(--base-unit) * 1.5);
    box-sizing: border-box;
}

.filter-input:focus-visible {
    outline: 2px solid var(--solid-purple);
    outline-offset: 1px;
}

.group-table {
    width: 100%;
    border-collapse: collapse;
}

.group-table thead th {
    text-align: left;
    font-size: calc(var(--base-unit) * 1.5);
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
    padding: 0.4rem 0.75rem;
    border-bottom: 1px solid color-mix(in srgb, var(--off-black) 85%, transparent);
}

.group-table thead th:last-child {
    text-align: right;
}

.empty-cell {
    padding: 1rem 0.75rem;
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
    font-style: italic;
    text-align: center;
}

.right-panel {
    flex: 2;
}

.add-button {
    background-color: green;
    border-color: green;
}

.default-panel-container {
    padding-left: 0.5rem;
    width: 100%;
    height: 100%;
    background-color: var(--lama-gray);
    justify-content: center;
    align-items: center;
    display: flex;
}

.default-panel {
    align-items: center;
    display: flex;
    flex-direction: column;
}
</style>