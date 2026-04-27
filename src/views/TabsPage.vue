<template>
  <ion-page>
    <ion-tabs>
      <!-- Aquí se renderizan TabCarga o TabSocios -->
      <ion-router-outlet></ion-router-outlet>

      <!-- Barra de navegación inferior -->
      <ion-tab-bar slot="bottom" class="relative-tab-bar">
        
        <ion-tab-button tab="carga" href="/tabs/carga">
          <ion-icon aria-hidden="true" :icon="flash" />
          <ion-label>Carga Rápida</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="buscador" href="/tabs/buscador">
          <ion-icon aria-hidden="true" :icon="search" />
          <ion-label>Buscar</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="asignaciones" href="/tabs/asignaciones">
          <ion-icon aria-hidden="true" :icon="list" />
          <ion-label>Asignadas</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="disponibles" href="/tabs/disponibles">
          <ion-icon aria-hidden="true" :icon="ticket" />
          <ion-label>Disponibles</ion-label>
        </ion-tab-button>

        <ion-tab-button tab="socios" href="/tabs/socios">
          <ion-icon aria-hidden="true" :icon="people" />
          <ion-label>Socios</ion-label>
        </ion-tab-button>

        <!-- Indicador de Conexión -->
        <div class="network-indicator" :class="{ 'online': isOnline }" title="Estado de conexión"></div>

      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { IonTabBar, IonTabButton, IonTabs, IonLabel, IonIcon, IonPage, IonRouterOutlet, modalController, alertController } from '@ionic/vue';
import { flash, people, search, list, ticket } from 'ionicons/icons';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PluginListenerHandle } from '@capacitor/core';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import ModalAdminBoleta from '../components/ModalAdminBoleta.vue';

const isOnline = ref(true);
let networkListener: PluginListenerHandle | null = null;
let appUrlOpenListener: PluginListenerHandle | null = null;

onMounted(async () => {
  // 1. Obtener estado inicial
  const status = await Network.getStatus();
  isOnline.value = status.connected;

  // 2. Escuchar cambios en tiempo real
  networkListener = await Network.addListener('networkStatusChange', status => {
    isOnline.value = status.connected;
  });

  // 4. Configurar Barra de Estado (Status Bar)
  try {
    await StatusBar.setStyle({ style: Style.Dark }); // O Style.Default según prefieras
    // await StatusBar.setBackgroundColor({ color: '#3880ff' }); // Opcional
  } catch (e) { console.log('Status Bar not available'); }

  // 3. Escuchar Deep Links (rifasapp://boleta/1234)
  appUrlOpenListener = await App.addListener('appUrlOpen', async (event) => {
    try {
      // Parsear la URL
      const urlObj = new URL(event.url);
      
      // Verificar si es el esquema correcto
      if (urlObj.host === 'boleta') {
        // Extraer ID: /1234 -> 1234
        const boletaId = urlObj.pathname.split('/')[1];

        if (boletaId && /^\d{4}$/.test(boletaId)) {
          // Buscar en Firebase
          const docRef = doc(db, 'boletas', boletaId);
          const snap = await getDoc(docRef);

          if (snap.exists()) {
            // Abrir Modal con la boleta existente
            const modal = await modalController.create({
              component: ModalAdminBoleta,
              componentProps: { boleta: { numero: snap.id, ...snap.data() } }
            });
            await modal.present();
          } else {
            // Si no existe, preguntar si desea crearla
            const alert = await alertController.create({
              header: 'Boleta no encontrada',
              message: `La boleta #${boletaId} no existe aún. ¿Deseas crearla ahora?`,
              buttons: [
                { text: 'Cancelar', role: 'cancel' },
                {
                  text: 'Crear',
                  handler: async () => {
                    const modal = await modalController.create({
                      component: ModalAdminBoleta,
                      componentProps: { boleta: { numero: boletaId, estado: 'disponible' } } // Pre-llenar número
                    });
                    await modal.present();
                  }
                }
              ]
            });
            await alert.present();
          }
        }
      }
    } catch (e) {
      console.error('Error procesando Deep Link:', e);
    }
  });
});

onUnmounted(() => {
  if (networkListener) networkListener.remove();
  if (appUrlOpenListener) appUrlOpenListener.remove();
});
</script>

<style scoped>
.network-indicator {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--ion-color-medium); /* Gris si está offline/desconocido */
  border: 1px solid var(--ion-tab-bar-background, #fff);
  z-index: 100;
  transition: all 0.3s ease;
}

.network-indicator.online {
  background-color: var(--ion-color-success); /* Verde brillante si hay internet */
  box-shadow: 0 0 6px var(--ion-color-success);
}
</style>
