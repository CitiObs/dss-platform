import { defineStore } from "pinia";
import { ref, computed } from "vue";

const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL.replace("localhost", window.location.hostname);
const REALM = import.meta.env.VITE_KEYCLOAK_REALM;
const CLIENT_ID = import.meta.env.VITE_KEYCLOAK_CLIENT_ID;
const OPENID_BASE = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect`;

export const useAuthStore = defineStore("auth", () => {
    const isAuthenticated = ref(false);
    const user = ref(null);
    const token = ref(null);
    const initialized = ref(false);

    const userId = computed(() => user.value?.sub || null);
    const userName = computed(() => {
        if (!user.value) return null;
        return user.value.preferred_username || user.value.name || user.value.email;
    });

    function parseJwt(jwt) {
        const base64 = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(decodeURIComponent(atob(base64).split("").map(c =>
            "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)
        ).join("")));
    }

    async function init() {
        try {
            // Check if we're returning from a Keycloak redirect with an auth code
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");

            if (code) {
                // Exchange code for token
                const body = new URLSearchParams({
                    grant_type: "authorization_code",
                    client_id: CLIENT_ID,
                    code,
                    redirect_uri: window.location.origin + window.location.pathname,
                });

                const resp = await fetch(`${OPENID_BASE}/token`, {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body,
                });

                if (resp.ok) {
                    const data = await resp.json();
                    token.value = data.access_token;
                    user.value = parseJwt(data.access_token);
                    isAuthenticated.value = true;

                    // Store refresh token for later
                    sessionStorage.setItem("kc_refresh_token", data.refresh_token);
                    sessionStorage.setItem("kc_access_token", data.access_token);

                    // Clean URL
                    window.history.replaceState({}, "", window.location.pathname);
                }
            } else {
                // Check for existing session
                const savedToken = sessionStorage.getItem("kc_access_token");
                if (savedToken) {
                    try {
                        const parsed = parseJwt(savedToken);
                        // Check if token is still valid
                        if (parsed.exp * 1000 > Date.now()) {
                            token.value = savedToken;
                            user.value = parsed;
                            isAuthenticated.value = true;
                        } else {
                            // Try refresh
                            await refreshToken();
                        }
                    } catch {
                        sessionStorage.removeItem("kc_access_token");
                        sessionStorage.removeItem("kc_refresh_token");
                    }
                }
            }
        } catch (e) {
            console.warn("Auth init failed:", e);
        } finally {
            initialized.value = true;
        }
    }

    async function refreshToken() {
        const refreshTkn = sessionStorage.getItem("kc_refresh_token");
        if (!refreshTkn) return;

        try {
            const body = new URLSearchParams({
                grant_type: "refresh_token",
                client_id: CLIENT_ID,
                refresh_token: refreshTkn,
            });

            const resp = await fetch(`${OPENID_BASE}/token`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body,
            });

            if (resp.ok) {
                const data = await resp.json();
                token.value = data.access_token;
                user.value = parseJwt(data.access_token);
                isAuthenticated.value = true;
                sessionStorage.setItem("kc_refresh_token", data.refresh_token);
                sessionStorage.setItem("kc_access_token", data.access_token);
            } else {
                logout();
            }
        } catch {
            logout();
        }
    }

    function login() {
        const redirectUri = window.location.origin + window.location.pathname;
        const url = `${OPENID_BASE}/auth?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid`;
        window.location.href = url;
    }

    function register() {
        const redirectUri = window.location.origin + window.location.pathname;
        const url = `${OPENID_BASE}/registrations?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid`;
        window.location.href = url;
    }

    function logout() {
        const redirectUri = window.location.origin;
        sessionStorage.removeItem("kc_access_token");
        sessionStorage.removeItem("kc_refresh_token");
        isAuthenticated.value = false;
        user.value = null;
        token.value = null;
        window.location.href = `${OPENID_BASE}/logout?client_id=${CLIENT_ID}&post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`;
    }

    return {
        isAuthenticated,
        initialized,
        user,
        token,
        userId,
        userName,
        init,
        login,
        register,
        logout,
    };
});
