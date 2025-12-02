<script setup>
</script>

<template>
    <router-link
        to="/"
        class="d-flex align-center"
    >
        <img
            class="logo"
            src="../assets/images/citiobs-logo.png"
            alt="CitiObs logo"
        />
        <span class="ml-2 pt-1 gi-text-primary-500 font-weight-medium">
            {{ $t('home.logoDSSText') }}
        </span>
    </router-link>
</template>

<style scoped>
.logo {
    max-width: 100%;
    height: 50px;
}
a,
a:link,
a:visited,
a:hover,
a:active,
a:focus {
    font-size: 40px;
    text-decoration: none !important;
    cursor: default; /* logo itself ignores clicks */
}
</style>
