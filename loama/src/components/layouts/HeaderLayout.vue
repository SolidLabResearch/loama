<template>
    <Suspense>
        <HeaderBase>
            <HeaderTab class="header-tab" href="/home/" tooltip="manage your resources" active>Policies</HeaderTab>
            <HeaderTab class="header-tab" href="/access-requests/" tooltip="manage your access requests or request access to a resource" active>Request Access</HeaderTab>
            <HeaderTab class="header-tab" href="/access-grants/" tooltip="manage incoming access requests and grant access to your resources" active>Grant Access</HeaderTab>
        </HeaderBase>
    </Suspense>
    <router-view />
</template>

<script setup lang='ts'>
import HeaderTab from "@/components/header/HeaderTab.vue";
import HeaderBase from '@/components/header/HeaderBase.vue'
</script>

<style scoped>
.header-tab {
    margin: 0 0.5rem 0;
}
</style>
