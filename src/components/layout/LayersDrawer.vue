<script setup>
const modelValue = defineModel("modelValue", { type: Boolean, default: true });

function toggleLayersDrawer() {
    modelValue.value = !modelValue.value;
}
</script>

<template>
    <v-navigation-drawer
        v-model="modelValue"
        absolute
        width="400"
    >
        <!-- Drawer Content -->
        <slot></slot>

        <!-- Toggle Button -->
        <v-btn
            elevation="0"
            class="drawer-toggle-btn rounded-0"
            :icon="modelValue ? 'mdi-chevron-left' : 'mdi-chevron-right'"
            @click="toggleLayersDrawer"
        />
    </v-navigation-drawer>
</template>

<style scoped lang="scss">
.drawer-toggle-btn {
    $size: 35px;

    width: $size !important;
    height: $size !important;
    position: absolute;
    top: 20%;
    transform: translateY(-50%);
    right: calc(($size * -1) - 1px);
    z-index: 1200;

    .v-btn--icon .v-icon {
        --v-icon-size-multiplier: 1.2;
    }
}
</style>
