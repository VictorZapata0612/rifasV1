<template>
  <ion-header>
    <ion-toolbar color="primary">
      <ion-title>{{ boleta ? 'Editar Boleta' : 'Nueva Boleta' }}</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="cerrarModal">Cancelar</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content class="ion-padding">
    <ion-list>
      <ion-item>
        <ion-icon :icon="ticketOutline" slot="start" color="medium"></ion-icon>
        <ion-input label="Número (0000-9999)" label-placement="stacked" v-model="form.numero" :disabled="!!boleta" type="tel" :maxlength="4" placeholder="0000"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-icon :icon="informationCircleOutline" slot="start" color="medium"></ion-icon>
        <ion-select label="Estado" label-placement="stacked" v-model="form.estado">
          <ion-select-option value="disponible">Disponible</ion-select-option>
          <ion-select-option value="asignada">Asignada</ion-select-option>
        </ion-select>
      </ion-item>
    </ion-list>

    <div class="ion-padding-top">
      <ion-button expand="block" @click="guardar" :disabled="loading">
        {{ loading ? 'Guardando...' : 'Guardar' }}
      </ion-button>
      
      <ion-button v-if="boleta" expand="block" color="danger" fill="outline" class="ion-margin-top" @click="confirmarEliminar">
        Eliminar / Resetear Boleta
      </ion-button>
    </div>
  </ion-content>
</template>

<script setup lang="ts">
import { ref, PropType } from 'vue';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonList, IonItem, IonInput, IonSelect, IonSelectOption, modalController, alertController, IonIcon } from '@ionic/vue';
import { ticketOutline, informationCircleOutline } from 'ionicons/icons';
import { db } from '../firebase/config';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Haptics, NotificationType } from '@capacitor/haptics';

const props = defineProps({
  boleta: {
    type: Object as PropType<any>,
    default: null
  }
});

const form = ref({
  numero: props.boleta?.numero || '',
  estado: props.boleta?.estado || 'disponible'
});
const loading = ref(false);

const cerrarModal = () => modalController.dismiss();

const guardar = async () => {
  if (!form.value.numero || form.value.numero.length !== 4) {
    // Validación simple
    return;
  }
  loading.value = true;
  try {
    const boletaRef = doc(db, 'boletas', form.value.numero);
    // Si es nueva y no asignamos vendedor, guardamos campos nulos para limpiar
    const data = {
      numero: form.value.numero,
      estado: form.value.estado,
      fechaModificacion: serverTimestamp()
    };
    
    await setDoc(boletaRef, data, { merge: true });
    modalController.dismiss({ role: 'reload' });
    await Haptics.notification({ type: NotificationType.Success });
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const confirmarEliminar = async () => {
  const alert = await alertController.create({
    header: '¿Eliminar Boleta?',
    message: 'Esto borrará la boleta de la base de datos (quedará inexistente, no disponible).',
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { 
        text: 'Eliminar', 
        role: 'destructive',
        handler: async () => {
          await deleteDoc(doc(db, 'boletas', form.value.numero));
          modalController.dismiss({ role: 'reload' });
          await Haptics.notification({ type: NotificationType.Success });
        }
      }
    ]
  });
  await alert.present();
};
</script>