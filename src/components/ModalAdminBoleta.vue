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
import { doc, serverTimestamp, runTransaction, increment } from 'firebase/firestore';
import { Haptics, NotificationType } from '@capacitor/haptics';

const props = defineProps({
  boleta: {
    type: Object as PropType<any>,
    default: null
  }
});

const form = ref({
  numero: props.boleta?.numero || '',
  estado: 'disponible'
});
const loading = ref(false);
const TOTAL_BOLETAS = 10000;

const cerrarModal = () => modalController.dismiss();

const guardar = async () => {
  if (!form.value.numero || form.value.numero.length !== 4) {
    // Validación simple
    return;
  }

  if (form.value.estado !== 'disponible') {
    return;
  }

  loading.value = true;
  try {
    const numero = form.value.numero;
    const boletaRef = doc(db, 'boletas', numero);
    const disponibleRef = doc(db, 'boletas_disponibles', numero);
    const statsRef = doc(db, 'stats', 'inventario');

    await runTransaction(db, async (transaction) => {
      const current = await transaction.get(boletaRef);
      const currentData = current.exists() ? current.data() : null;
      const previousEstado = currentData?.estado || 'disponible';
      const statsSnap = await transaction.get(statsRef);
      const currentAssigned = statsSnap.exists() ? (statsSnap.data().totalAsignadas || 0) : 0;
      const currentAvailable = statsSnap.exists() ? (statsSnap.data().totalDisponibles || TOTAL_BOLETAS) : TOTAL_BOLETAS;

      if (previousEstado === 'asignada') {
        if (currentData?.socioId && currentData.socioId !== 'Sin Socio') {
          transaction.update(doc(db, 'socios', currentData.socioId), { boletasAsignadas: increment(-1) });
        }
        if (currentData?.vendedorId) {
          transaction.update(doc(db, 'vendedores', currentData.vendedorId), { boletasAsignadas: increment(-1) });
        }
      }

      transaction.set(boletaRef, {
        numero,
        estado: 'disponible',
        vendedorId: null,
        vendedorNombre: null,
        socioId: null,
        fechaAsignacion: null,
        fechaModificacion: serverTimestamp()
      }, { merge: true });

      transaction.set(disponibleRef, {
        numero,
        updatedAt: serverTimestamp()
      }, { merge: true });

      if (previousEstado === 'asignada') {
        transaction.set(statsRef, {
          total: TOTAL_BOLETAS,
          totalAsignadas: Math.max(0, currentAssigned - 1),
          totalDisponibles: currentAvailable + 1,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    });

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
    header: '¿Resetear Boleta?',
    message: 'La boleta quedará disponible y se limpiará cualquier asignación activa.',
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { 
        text: 'Resetear', 
        role: 'destructive',
        handler: async () => {
          await guardar();
        }
      }
    ]
  });
  await alert.present();
};
</script>