<script setup>
import { STYLES_CONFIG } from "@/common/stylesConfig.js";
import { useDisplay } from "vuetify";
import { computed } from "vue";

const { mdAndDown } = useDisplay();
const euFundedImgHeight = `${STYLES_CONFIG.footer_height / 2}px`;

const truncatedFundingNoteText = computed(() => !!mdAndDown.value);
const copyrightText = computed(() => mdAndDown.value ? "gi-text-sm": "gi-text-base" );
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
            <div class="footer__content d-flex align-center justify-space-around flex-grow-1 ga-4 mx-auto">
                <p
                    class="footer__copyright"
                    :class="copyrightText"
                >
                    © 2026, All rights reserved.
                </p>

                <img
                    class="footer__eu-funded-img"
                    src="../../assets/images/eu-funded.png"
                    alt="Co-funded by the European Union"
                />

                <!-- Tooltip only active when truncated -->
                <v-tooltip
                    v-if="truncatedFundingNoteText"
                    location="top"
                >
                    <template #activator="{ props }">
                        <p
                            class="footer__eu-funded-desc gi-text-sm text-truncate"
                            v-bind="props"
                        >
                            {{ $t('footer.projectFundingNotice') }}
                        </p>
                    </template>
                    <span>{{ $t('footer.projectFundingNotice') }}</span>
                </v-tooltip>

                <!-- Normal text for larger screens -->
                <p
                    v-else
                    class="footer__eu-funded-desc gi-text-sm"
                >
                    {{ $t('footer.projectFundingNotice') }}
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
