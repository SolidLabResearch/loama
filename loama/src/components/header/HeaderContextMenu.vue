<template>
  <aside>
    <span>{{ store.usedPod }}</span>
    <div>
      <label for="pod">Selected Pod</label>
      <select>
        <option v-for="pod in pods" :key="pod">{{ pod }}</option>
      </select>
    </div>
    <div>
      <label for="authorization-server-url">Select your Authorization Server</label>
      <input
        id="authorization-server-url"
        v-model="authorizationServerURL"
        placeholder="Enter your AS's URL"
      />
    </div>
    <div>
      <label for="authorization-server-type">Select the type of your Authorization Server</label>
      <select v-model="authorizationServerType">
        <option v-for="type of types" :key="type">{{ type }}</option>
      </select>
    </div>

    <div>
      <button @click="updateController">
        Change Controller
      </button>
    </div>

    <a @click.prevent="logout">
      <PhSignOut />
      <span>Sign out</span>
    </a>
  </aside>
</template>

<script setup lang="ts">
import router from '@/router';
import { store } from 'loama-app';
import { PhSignOut } from '@phosphor-icons/vue';
import { useControllerStore } from '@/stores/useControllerStore';
import { computed, ref } from 'vue';

const pods = computed(() => {
  if (store.usedPod) return [store.usedPod];
  if (store.oidcSettings?.authority) return [store.oidcSettings.authority];
  return [];
});
const controllerStore = useControllerStore();
const types = computed(() => Array.from(controllerStore.types));

const authorizationServerURL = ref(controllerStore.authorizationServerURL);
const authorizationServerType = ref(controllerStore.currentControllerType);

function updateController() {
  controllerStore.changeController(
    authorizationServerType.value,
    authorizationServerURL.value
  );
}

async function logout() {
  if (controllerStore.current) controllerStore.current.unsetPodUrl("");
  try {
    await store.getOidcManager().signoutRedirect();
  } catch {
    router.push('/');
  }
}
</script>

<style lang="css" scoped>
aside {
  z-index: 10;
  border-radius: 0.5rem;
  display: flex;
  flex-flow: column nowrap;
  border: 0.25rem solid var(--solid-purple);
  background-color: var(--off-white);
}

aside>div {
  padding: var(--base-unit);
}

label {
  color: var(--off-black);
  font-weight: 700;
  display: block;
}

select, input {
  margin-bottom: var(--base-unit);
}

aside>span {
  background-color: var(--solid-purple);
  color: var(--off-white);
  font-family: Raleway;
  font-style: normal;
  font-weight: 700;
  line-height: normal;
  padding: var(--base-unit);
  margin-bottom: var(--base-unit);
}

a {
  display: flex;
  flex-flow: row nowrap;
  background-color: var(--lama-gray);
  padding: var(--base-unit);
  gap: var(--base-unit);
  align-items: center;
  font-style: normal;
  font-weight: 700;
}
</style>
