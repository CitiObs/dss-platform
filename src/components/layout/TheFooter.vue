<script setup>
import { STYLES_CONFIG } from "@/common/stylesConfig.js";
</script>

<template>
    <v-container
        fluid
        class="pa-0"
        style="z-index: 1010;"
    >
        <v-footer
            :height="STYLES_CONFIG.footer_height"
        >
            <v-row class="align-center">
                <v-col><p>Copyright Message</p></v-col>

                <v-col><p>Horizon 2020</p></v-col>

                <v-col><div>Eu Image</div></v-col>

                <v-col cols="5">
                    <p style="font-size: .8rem;">
                        Lorem ipsum dolor sit amet, consectetur adipisicing elit. Perspiciatis quam quos repellat impedit rem, quae non quibusdam iure natus aperiam aspernatur numquam beatae! Quibusdam, dicta consectetur autem incidunt blanditiis ex.
                    </p>
                </v-col>
            </v-row>
        </v-footer>
    </v-container>
</template>
