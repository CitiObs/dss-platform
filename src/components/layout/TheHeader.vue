<script setup>
import { useAuthStore } from "@/stores/authStore.js";
import { STYLES_CONFIG } from "@/common/stylesConfig.js";
import MainNav from "./MainNav.vue";
import ProjectLogo from "@/components/ProjectLogo.vue";
import MenuUserAccount from "@/components/MenuUserAccount.vue";
import MenuChangeLocale from "@/components/MenuChangeLocale.vue";
import ButtonChangeTheme from "@/components/ButtonChangeTheme.vue";

const authStore = useAuthStore();
</script>

<template>
    <v-app-bar
        :height="STYLES_CONFIG.header_height"
        class="shadow-dark px-5"
    >
        <ProjectLogo />

        <v-spacer />

        <MainNav />

        <v-divider
            vertical
            inset
            class="mx-3 h-50 my-auto"
        />

        <div class="d-flex align-center justify-space-around ga-2">
            <ButtonChangeTheme />

            <MenuChangeLocale />
        </div>

        <v-divider
            vertical
            inset
            class="mx-3 h-50 my-auto"
        />

        <MenuUserAccount
            v-if="authStore.userIsAuth"
        />
    </v-app-bar>
</template>
