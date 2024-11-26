<script setup>
const props = defineProps({
    size: {
        type: String,
        default: "h6"
    },
    justify: {
        type: String,
        default: "center"
    },
    align: {
        type: String,
        default: "center"
    }
});
</script>

<template>
    <div :class="`d-flex justify-${props.justify} align-${props.align} text-${props.size} text-medium-emphasis`">
        {{ $t('gi.general.noData') }}
    </div>
</template>
