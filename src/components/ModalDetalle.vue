<template>
  <ion-header>
    <ion-toolbar color="primary">
      <ion-title>Detalle del Socio</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="cerrarModal">Cerrar</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content class="ion-padding">
    <div v-if="socio" class="ion-text-center ion-margin-bottom">
      <ion-avatar class="ion-margin-auto" style="width: 80px; height: 80px;">
        <img src="https://ionicframework.com/docs/img/demos/avatar.svg" alt="Avatar" />
      </ion-avatar>
      <h2 class="ion-margin-top">{{ socio.nombre }}</h2>
      <p class="ion-text-muted">ID: {{ socio.id }}</p>
    </div>

    <ion-list inset>
      <ion-item>
        <ion-icon :icon="ticketOutline" slot="start" color="secondary"></ion-icon>
        <ion-label>
          <h3>Boletas Asignadas</h3>
          <p>{{ socio.boletasAsignadas }}</p>
        </ion-label>
      </ion-item>

      <!-- Aquí puedes agregar más campos en el futuro, como saldo, teléfono, etc. -->
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { PropType } from 'vue';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonList, IonItem, IonLabel, IonAvatar, IonIcon, modalController } from '@ionic/vue';
import { ticketOutline } from 'ionicons/icons';

// Definimos la interfaz localmente para tipar la prop
interface Socio {
  id: string;
  nombre: string;
  boletasAsignadas: number;
}

const props = defineProps({
  socio: {
    type: Object as PropType<Socio>,
    required: true
  }
});

const cerrarModal = () => {
  modalController.dismiss();
};
</script>