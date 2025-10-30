<script setup>
import { STYLES_CONFIG } from "@/common/stylesConfig.js";
import MainNav from "./MainNav.vue";
import ProjectLogo from "@/components/ProjectLogo.vue";
import MenuChangeLocale from "@/components/MenuChangeLocale.vue";
import ButtonChangeTheme from "@/components/ButtonChangeTheme.vue";

</script>

<template>
    <v-app-bar
        :height="STYLES_CONFIG.header_height"
        class="shadow-dark px-5"
    >
        <ProjectLogo />

        <v-spacer />

        <!-- <MainNav /> -->

        <!-- <v-divider
            vertical
            inset
            class="mx-3 h-50 my-auto"
        /> -->

        <div class="d-flex align-center justify-space-around ga-2">
            <!-- <ButtonChangeTheme /> -->
            <MenuChangeLocale />
        </div>
    </v-app-bar>
</template>
