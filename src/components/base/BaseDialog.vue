<script setup>
import { GiBtn } from "@geoint/geoint-vue";

defineProps({
    title: {
        type: String,
        default: ""
    },
    maxWidth: {
        type: Number,
        default: 1400
    }
});

const isOpen = defineModel({ type: Boolean, required: true });

function closeDialog () {
    isOpen.value = false;
}

</script>

<template>
    <v-dialog
        v-model="isOpen"
        :max-width="maxWidth"
    >
        <v-card>
            <v-card-title>
                <div class="d-flex align-center justify-space-between">
                    {{ title }}

                    <GiBtn
                        icon="mdi-close"
                        variant="text"
                        color="button-color"
                        @click="closeDialog"
                    />
                </div>
            </v-card-title>

            <v-divider />

            <v-card-text>
                <slot></slot>
            </v-card-text>
        </v-card>
    </v-dialog>
</template>

<style scoped>
</style>
