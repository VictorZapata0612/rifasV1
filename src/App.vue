<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { onMounted } from 'vue';
import { SplashScreen } from '@capacitor/splash-screen';

onMounted(async () => {
  // Ocultar la pantalla de carga cuando la app esté montada y lista
  await SplashScreen.hide();
});
</script>
