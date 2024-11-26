import { ref, computed, inject } from "vue";
import { defineStore } from "pinia";

export const useAuthStore = defineStore("auth", () => {
    const keycloak = inject("keycloak", () => undefined);

    const userIsAuth = computed(() => {
        return !!keycloak?.token;
    });

    const user = ref({
        initials: keycloak?.userInitials,
        fullName: `${keycloak?.tokenParsed?.given_name} ${keycloak?.tokenParsed?.family_name}`,
        email: keycloak?.tokenParsed?.email,
    });

    function loginUser() {
        keycloak.login({});
    }

    function logoutUser(redirectUri) {
        keycloak.logout({
            redirectUri,
        });
    }

    return { keycloak, userIsAuth, user, loginUser, logoutUser };
});
