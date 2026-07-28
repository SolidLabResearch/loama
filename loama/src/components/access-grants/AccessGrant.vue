<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import AccessRequestEntry from '../access-requests/AccessRequestEntry.vue';
import type { AccessRequest } from 'loama-controller';
import { useControllerStore } from '@/stores/useControllerStore';

const controllerStore = useControllerStore();
const accessRequests: Ref<AccessRequest[]> = ref([]);

const updateStatus = async (requestID: string, status: 'accepted' | 'denied') => {
  await controllerStore.current.handleAccessRequest(requestID, status);
  await fetchAccessRequests();
};

const fetchAccessRequests = async () => {
  accessRequests.value = (await controllerStore.current.getAccessRequests()).asResourceOwner;
};

let interval: NodeJS.Timeout;

onMounted(async () => {
  await fetchAccessRequests();
  interval = setInterval(fetchAccessRequests, 10 ** 4);
});

onBeforeUnmount(() => clearInterval(interval));
</script>

<template>
  <div class="container">
    <div class="card header-card">
      <h2>Incoming access requests</h2>
      <button @click="fetchAccessRequests" class="refresh-button">refresh</button>
    </div>

    <div class="card">
      <h3>Requested</h3>
      <div v-if="accessRequests.filter(r => r.status.toLowerCase() === 'requested').length">
        <div
          v-for="request in accessRequests.filter(r => r.status.toLowerCase() === 'requested')"
          :key="request.uid"
          class="access-request-item"
        >
          <AccessRequestEntry :request="request" />
          <div class="actions">
            <button class="accept" @click="updateStatus(request.uid, 'accepted')">
              Accept
            </button>
            <button class="deny" @click="updateStatus(request.uid, 'denied')">Deny</button>
          </div>
        </div>
      </div>
      <div v-else class="no-requests-message">
        No new access requests at the moment.
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
          <AccessRequestEntry :request="request" />
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
          <AccessRequestEntry :request="request" />
        </div>
      </div>
      <div v-else class="no-requests-message">
        No denied requests.
      </div>
    </div>
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

/* Each request entry */
.access-request-item {
  display: flex;
  justify-content: space-between; /* puts actions at the side */
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 0;
}

.access-request-item > :first-child {
  flex: 1; /* let entry expand, keep actions compact */
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0; /* prevent buttons from squishing */
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

button.accept {
  background-color: #d4edda;
  color: #155724;
}
button.accept:hover {
  background-color: #c2e0c9;
}

button.deny {
  background-color: #f8d7da;
  color: #721c24;
}
button.deny:hover {
  background-color: #f5c6cb;
}

.no-requests-message {
  color: var(--off-black);
  font-style: italic;
  text-align: center;
  padding: 1rem;
}
</style>
