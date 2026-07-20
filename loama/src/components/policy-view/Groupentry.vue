<template>
    <tr class="group-row" :class="{ selected: isSelected }" tabindex="0" :aria-current="isSelected ? 'true' : undefined"
        @click="$emit('select')" @keydown.enter.prevent="$emit('select')" @keydown.space.prevent="$emit('select')">
        <td class="entry-label">{{ label }}</td>
        <td class="level-cell">
            <span v-if="highestLevel" class="level-indicator">
                <span class="access-dot" :style="{ backgroundColor: highestLevel.color }" aria-hidden="true"></span>
                {{ highestLevel.label }}
            </span>
            <span v-else class="level-indicator muted">—</span>
        </td>
        <td class="rule-count">{{ ruleCount }} rule{{ ruleCount === 1 ? '' : 's' }}</td>
    </tr>
</template>

<script setup lang="ts">
import type { AccessLevel } from '@/lib/accessLevel';

defineProps<{
    label: string;
    ruleCount: number;
    isSelected: boolean;
    highestLevel: AccessLevel | null;
}>();

defineEmits<{ select: [] }>();
</script>

<style scoped>
.group-row {
    cursor: pointer;
    outline-offset: -2px;
    border-radius: var(--base-corner);
}

.group-row:hover {
    background-color: color-mix(in srgb, var(--off-black) 10%, transparent);
}

.group-row:focus-visible {
    outline: 2px solid var(--solid-purple);
}

.group-row.selected {
    background-color: color-mix(in srgb, var(--solid-purple) 15%, transparent);
}

.entry-label {
    padding: 0.6rem 0.75rem;
    overflow-wrap: anywhere;
}

.level-cell {
    padding: 0.6rem 0.75rem;
    white-space: nowrap;
    font-size: calc(var(--base-unit) * 1.5);
}

.level-indicator {
    display: inline-flex;
    align-items: center;
}

.level-indicator.muted {
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
}

.access-dot {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 50%;
    display: inline-block;
    margin-right: 0.4rem;
    flex-shrink: 0;
}

.rule-count {
    padding: 0.6rem 0.75rem;
    text-align: right;
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
    white-space: nowrap;
    font-size: calc(var(--base-unit) * 1.5);
}
</style>