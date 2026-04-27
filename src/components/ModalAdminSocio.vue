<template>
  <ion-header>
    <ion-toolbar color="primary">
      <ion-title>{{ socio ? 'Editar Socio' : 'Nuevo Socio' }}</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="cerrarModal">Cancelar</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content class="ion-padding">
    <ion-list>
      <ion-item>
        <ion-icon :icon="personOutline" slot="start" color="medium"></ion-icon>
        <ion-input label="Nombre del Socio" label-placement="stacked" v-model="form.nombre" placeholder="Ej. Carlos Ruiz"></ion-input>
      </ion-item>
      <!-- Agrega más campos aquí si es necesario (teléfono, etc.) -->
    </ion-list>

    <div class="ion-padding-top">
      <ion-button expand="block" @click="guardar" :disabled="loading || !form.nombre">
        {{ loading ? 'Guardando...' : 'Guardar' }}
      </ion-button>
      
      <ion-button v-if="socio" expand="block" color="danger" fill="outline" class="ion-margin-top" @click="confirmarEliminar">
        Eliminar Socio
      </ion-button>
    </div>
  </ion-content>
</template>

<script setup lang="ts">
import { ref, PropType } from 'vue';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonList, IonItem, IonInput, modalController, alertController, IonIcon } from '@ionic/vue';
import { personOutline } from 'ionicons/icons';
import { db } from '../firebase/config';
import { doc, setDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';
import { Haptics, NotificationType } from '@capacitor/haptics';

const props = defineProps({
  socio: {
    type: Object as PropType<any>,
    default: null
  }
});

const form = ref({
  nombre: props.socio?.nombre || '',
});
const loading = ref(false);

const cerrarModal = () => modalController.dismiss();

const guardar = async () => {
  if (!form.value.nombre) return;
  loading.value = true;
  try {
    if (props.socio) {
      // Editar
      await setDoc(doc(db, 'socios', props.socio.id), { ...form.value }, { merge: true });
    } else {
      // Crear
      await addDoc(collection(db, 'socios'), { ...form.value, boletasAsignadas: 0 });
    }
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
    header: '¿Eliminar Socio?',
    message: 'Esta acción no se puede deshacer.',
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { 
        text: 'Eliminar', 
        role: 'destructive',
        handler: async () => {
          await deleteDoc(doc(db, 'socios', props.socio.id));
          modalController.dismiss({ role: 'reload' });
          await Haptics.notification({ type: NotificationType.Success });
        }
      }
    ]
  });
  await alert.present();
};
</script>