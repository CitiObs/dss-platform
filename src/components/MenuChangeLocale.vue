<script setup>
import { useLocaleStore } from "@/stores/localeStore.js";
import { GiBtn } from "@geoint/geoint-vue";

const localeStore = useLocaleStore();

const langs = [
    {
        name: "English",
        value: "en"
    },
    {
        name: "Ελληνικά",
        value: "el"
    },
];
</script>

<template>
    <div>
        <v-menu location="bottom">
            <template #activator="{ props }">
                <GiBtn
                    icon="mdi-translate"
                    size="medium"
                    color="grey"
                    variant="outlined-high-contrast"
                    class="bg-transparent border"
                    v-bind="props"
                />
            </template>

            <v-list
                nav
                slim
                density="compact"
            >
                <v-list-subheader class="text-high-emphasis text-subtitle-2 font-weight-black mb-1">
                    {{ $t('gi.general.translation', 2) }}
                </v-list-subheader>

                <v-list-item
                    v-for="lang in langs"
                    :key="lang.value"
                    link
                    variant="text"
                    :class="{'text-primary': lang.value === localeStore.locale}"
                    :active="lang.value === localeStore.locale"
                    @click="localeStore.setLocale(lang.value)"
                >
                    {{ lang.name }}
                </v-list-item>
            </v-list>
        </v-menu>
    </div>
</template>
