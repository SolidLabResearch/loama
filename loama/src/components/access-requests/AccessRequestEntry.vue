<template>
    <div class="container">
        <section class="detail-section">
            <a :href="props.request.uid" target="_blank" class="request-uid">
                {{ props.request.uid }}
            </a>

            <span
                class="status-badge"
                :class="{
                    requested: props.request.status.includes('requested'),
                    accepted: props.request.status.includes('accepted'),
                    denied: props.request.status.includes('denied'),
                }"
            >
                {{ props.request.status.split(':').pop() }}
            </span>

            <dl class="detail-grid">
                <dt>Requesting party</dt>
                <dd class="mono">{{ props.request.requestingParty }}</dd>

                <dt>Target</dt>
                <dd class="mono">{{ props.request.target }}</dd>

                <dt>Actions</dt>
                <dd>
                    <div class="actions">
                        <span class="action-chip" v-for="action in props.request.actions" :key="action"
                            :style="actionStyle(action)">{{ shorten(action) }}</span>
                    </div>
                </dd>

                <dt>Purpose</dt>
                <dd>
                    <span v-if="purposes.length">{{ purposes.join(', ') }}</span>
                    <span v-else class="no-constraints">No purpose specified</span>
                </dd>

                <dt>Start time</dt>
                <dd>
                    <span v-if="startTime">{{ startTime }}</span>
                    <span v-else class="no-constraints">Not set</span>
                </dd>

                <dt>End time</dt>
                <dd>
                    <span v-if="endTime">{{ endTime }}</span>
                    <span v-else class="no-constraints">Not set</span>
                </dd>
            </dl>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { levelForAction } from '@/lib/Accesslevel';
import type { AccessRequest } from 'loama-controller';

const props = defineProps<{
    request: AccessRequest;
}>();

defineEmits<{
    close: [];
}>();

const shorten = (uri: string) => uri.split(/[/#]/).filter(Boolean).pop() ?? uri;

const actionStyle = (action: string) => {
    const level = levelForAction(action);
    return { backgroundColor: level.color, color: level.textColor };
};

const formatDateTime = (raw: string) => {
    const match = raw.match(/\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(\.\d+)?z?/i);
    if (!match) return raw;
    const isoStr = match[0].replace(/t/i, 'T').replace(/z/i, 'Z');
    const date = new Date(isoStr);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

const purposes = computed(() =>
    props.request.constraint
        .filter(c => shorten(c.leftOperand) === 'purpose')
        .flatMap(c => c.rightOperand.map(shorten))
);

const startTime = computed(() => {
    const constraint = props.request.constraint.find(
        c => shorten(c.leftOperand) === 'datetime' && shorten(c.operator) === 'gt'
    );
    return constraint ? formatDateTime(constraint.rightOperand[0]) : null;
});

const endTime = computed(() => {
    const constraint = props.request.constraint.find(
        c => shorten(c.leftOperand) === 'datetime' && shorten(c.operator) === 'lt'
    );
    return constraint ? formatDateTime(constraint.rightOperand[0]) : null;
});
</script>

<style scoped>
.container {
    background-color: var(--solid-purple);
    display: flex;
    flex-direction: column;
}

.close-button {
    background: none;
    border: none;
    padding: 0;
    color: var(--off-white);
    cursor: pointer;
    display: flex;
}

.detail-section {
    background-color: var(--off-white);
    border-radius: var(--base-corner);
    overflow-y: auto;
}

.request-uid {
    display: block;
    color: var(--solid-purple);
    font-weight: 600;
    text-decoration: none;
    word-break: break-all;
    font-size: calc(var(--base-unit) * 2);
    margin-bottom: 0.75rem;
}

.request-uid:hover {
    text-decoration: underline;
}

.status-badge {
    display: inline-block;
    padding: 0.4rem 0.8rem;
    border-radius: 0.5rem;
    font-size: calc(var(--base-unit) * 1.5);
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
    margin-bottom: 1.5rem;
}

.status-badge.requested {
    background-color: #fff3cd;
    color: #856404;
}
.status-badge.accepted {
    background-color: #d4edda;
    color: #155724;
}
.status-badge.denied {
    background-color: #f8d7da;
    color: #721c24;
}

.detail-grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    column-gap: 1.5rem;
    row-gap: 1rem;
    margin: 0;
}

.detail-grid dt {
    font-size: calc(var(--base-unit) * 1.5);
    font-weight: 600;
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
    white-space: nowrap;
    padding-top: 0.15rem;
}

.detail-grid dd {
    margin: 0;
    font-size: calc(var(--base-unit) * 1.5);
    color: var(--off-black);
    overflow-wrap: anywhere;
}

.mono {
    font-family: monospace;
}

.actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.action-chip {
    padding: 0.15rem 0.6rem;
    border-radius: 999px;
    font-size: calc(var(--base-unit) * 1.5);
}

.no-constraints {
    font-style: italic;
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
}
</style>