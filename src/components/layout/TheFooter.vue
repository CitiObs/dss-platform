<script setup>
import { STYLES_CONFIG } from "@/common/stylesConfig.js";

const euFundedImgHeight = `${STYLES_CONFIG.footer_height / 2}px`;
</script>

<template>
    <v-container
        fluid
        class="pa-0"
        style="z-index: 1010;"
    >
        <v-footer
            :height="STYLES_CONFIG.footer_height"
            class="footer px-5"
        >
            <div class="footer__content flex-grow-1 d-flex align-center justify-space-around gc-4 mx-auto">
                <p class="footer__copyright gi-text-base">
                    © 2024, All rights reserved.
                </p>

                <img
                    class="footer__eu-funded-img"
                    src="../../assets/images/eu-funded.png"
                    alt="Co-funded by the European Union"
                />

                <p class="footer__eu-funded-desc gi-text-sm">
                    This project has received funding from the European Union’s Horizon Europe programme for research and innovation under grant agreement No. 101121135.
                </p>
            </div>
        </v-footer>
    </v-container>
</template>

<style scoped lang="scss">
.footer {
    &__content {
        max-width: 85%;
    }

    &__copyright {
      color: var(--gi-black-400);
    }

    &__eu-funded-img {
        max-height: v-bind(euFundedImgHeight);
    }

    &__eu-funded-desc {
        flex-basis: 40%;
        max-width: 40rem;
        color: var(--gi-grey-800);
    }
}
</style>
