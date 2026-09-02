<template>
  <div class="panel-container">
    <div class="left-panel">
      <LoginForm v-model:showPopup="showPopup" title="LOAMA"
        subtitle="ODRL policies made easy" />
    </div>
    <div class="right-panel">
      <InfoPopup v-show="showPopup" />
      <img src="/loama.svg" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LoginForm from '@/components/LoginForm.vue';
import InfoPopup from '@/components/InfoPopup.vue';

const showPopup = ref(false);
</script>


<style scoped>
img {
  height: 65vh;
}

.panel-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}

.left-panel,
.right-panel {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.left-panel {
  flex-direction: column;
  gap: 4rem;
  flex: 2;
  background-color: var(--lama-gray);
  background: var(--login-fade, linear-gradient(180deg, #F7F7F7 95%, #BFA8FF 100%));
  padding: 0 4rem;
}

.right-panel {
  flex: 5;
  background-color: var(--solid-purple);
  position: relative;
}
</style>
