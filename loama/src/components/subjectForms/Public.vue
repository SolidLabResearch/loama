<template>
  <!-- We get warnings without a template -->
  <div style="display: none;"></div>
</template>


<script setup lang="ts">
import { usePodStore } from '@/lib/state';
import { useControllerStore } from '@/stores/useControllerStore';
import { Permission } from 'loama-controller';
import { useToast } from 'primevue/usetoast';

const toast = useToast();
const podStore = usePodStore();
const controllerStore = useControllerStore();

const onCreate = async () => {
    if (!podStore.selectedEntry) {
        console.error("No entry selected to add subject to!")
        return true;
    }
    const entry = await controllerStore.currentController.getItem(podStore.selectedEntry.id, {
        type: "public",
    });
    if (entry) {
        console.log("The public is already added")
        toast.add({ severity: "warn", summary: "The public is already present in the permission table" })
        return true;
    }
    try {
        /*await controllerStore.currentController.addPermission(podStore.selectedEntry.resourceUrl, Permission.Read, {
            type: "public"
        })*/
        await podStore.refreshEntryPermissions(controllerStore.currentController);
        return true;
    } catch (e) {
        console.error(e)
        toast.add({ severity: "error", summary: "An error occurred while adding the public", detail: (e instanceof Error) ? e.message : "An unknown error occurred" })
        return false;
    }
}

defineExpose({
    create: onCreate
})
</script>
