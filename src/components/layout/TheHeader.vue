<script setup>
import { useAuthStore } from "@/stores/authStore.js";
import { STYLES_CONFIG } from "@/common/stylesConfig.js";
import MainNav from "./MainNav.vue";
import MenuUserAccount from "@/components/MenuUserAccount.vue";
import MenuChangeLocale from "@/components/MenuChangeLocale.vue";
import ButtonChangeTheme from "@/components/ButtonChangeTheme.vue";

const authStore = useAuthStore();
</script>

<template>
    <v-app-bar
        :height="STYLES_CONFIG.header_height"
        class="shadow-dark"
    >
        <v-app-bar-title class="flex-0-0">
            Logo
        </v-app-bar-title>


        <div class="ml-16">
            Search bar
        </div>

        <v-spacer />


        <MainNav />

        <v-divider
            vertical
            inset
            class="mx-8"
        />

        <template #append>
            <div class="d-flex align-center justify-space-around ga-2">
                <!-- Change Locale -->
                <MenuChangeLocale />

                <!-- Change Theme -->
                <ButtonChangeTheme />

                <!-- User Menu -->
                <MenuUserAccount
                    v-if="authStore.userIsAuth"
                    class="ml-2"
                />
            </div>
        </template>
    </v-app-bar>
</template>
