import { onBeforeUnmount, watch, type Ref } from 'vue';
import TomSelect from 'tom-select';

/**
 * Binds a TomSelect instance to a <select multiple> element and keeps it in
 * sync with a reactive string[] model, since TomSelect is a vanilla JS
 * widget and has no built-in v-model support.
 *
 * @param elRef      template ref to the underlying <select multiple> element
 * @param modelValue reactive array of selected values, kept in sync both ways
 * @param editable   reactive boolean, toggles TomSelect enable/disable
 * @param settings   TomSelect settings (options, optgroups, render, etc.)
 */
export function useTomSelectMultiple(
    elRef: Ref<HTMLSelectElement | null>,
    modelValue: Ref<string[]>,
    editable: Ref<boolean>,
    settings: Record<string, unknown> = {},
) {
    let instance: TomSelect | null = null;

    const applyValue = (value: string[]) => {
        if (!instance) return;
        const current = instance.getValue();
        const currentArray = Array.isArray(current) ? current : [current];
        const same =
            currentArray.length === value.length &&
            currentArray.every((v, i) => v === value[i]);
        if (!same) instance.setValue(value, true); // true = silent, avoids feedback loop
    };

    const applyEditable = (isEditable: boolean) => {
        if (!instance) return;
        if (isEditable) instance.enable();
        else instance.disable();
    };

    const create = (el: HTMLSelectElement) => {
        instance = new TomSelect(el, {
            plugins: ['remove_button'],
            ...settings,
        });

        instance.on('change', () => {
            const value = instance!.getValue();
            modelValue.value = Array.isArray(value) ? value : [value];
        });

        applyValue(modelValue.value);
        applyEditable(editable.value);
    };

    const destroy = () => {
        instance?.destroy();
        instance = null;
    };

    // The <select> may not exist at mount time (e.g. it's behind a v-if
    // that starts false), so react to the ref itself rather than only
    // creating the instance once in onMounted.
    watch(
        elRef,
        (el) => {
            destroy();
            if (el) create(el);
        },
        { immediate: true },
    );

    watch(modelValue, applyValue, { deep: true });
    watch(editable, applyEditable);

    onBeforeUnmount(destroy);
}