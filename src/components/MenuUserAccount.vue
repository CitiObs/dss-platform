<script setup>
import { useAuthStore } from "@/stores/authStore.js";

defineOptions({
    inheritAttrs: false,
});

const authStore = useAuthStore();
const user = authStore.user;

const accountUrl = authStore.keycloak.createAccountUrl();

function handleLogout() {
    const currentUrl = window.location.href;
    authStore.logoutUser(currentUrl);
}
</script>

<template>
    <v-menu>
        <!-- Activator -->
        <template #activator="{ props }">
            <v-btn
                icon
                color="secondary"
                v-bind="{...props, ...$attrs}"
                variant="flat"
            >
                <v-avatar
                    color="secondary"
                    size="48"
                >
                    <span class="text-button text-white">
                        {{ user.initials }}
                    </span>
                </v-avatar>
            </v-btn>
        </template>

        <!-- Menu -->
        <v-card>
            <v-card-text class="text-center">
                <v-avatar
                    color="secondary"
                    class="mb-3"
                >
                    <span class="text-button">
                        {{ user.initials }}
                    </span>
                </v-avatar>

                <h3>{{ user.fullName }}</h3>

                <span>{{ user.email }}</span>

                <v-divider class="my-3" />

                <v-btn
                    rounded
                    variant="text"
                    class="text-capitalize"
                    :href="accountUrl"
                    target="_blank"
                >
                    {{ $t('gi.general.accountSettings') }}
                </v-btn>

                <br />

                <v-btn
                    rounded
                    variant="text"
                    class="text-capitalize"
                    @click="handleLogout"
                >
                    {{ $t('gi.general.logout') }}
                </v-btn>
            </v-card-text>
        </v-card>
    </v-menu>
</template>
