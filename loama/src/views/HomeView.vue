<template>
    <main>
        <Suspense>
            <GroupExplorer />
            <template #fallback>
                <p class="loading">Loading policies...</p>
            </template>
        </Suspense>
    </main>
</template>

<script setup lang="ts">
import GroupExplorer from '../components/policy-view/Groupexplorer.vue';
</script>

<style scoped>
.loading {
    padding: 2rem;
    color: var(--off-black-50, rgba(23, 13, 51, 0.50));
}
</style>