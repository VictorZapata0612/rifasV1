<template>
  <ion-header>
    <ion-toolbar color="primary">
      <ion-title>Boletas de {{ nombre }}</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="cerrarModal">Cerrar</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content class="ion-padding">
    <div v-if="loading" class="ion-text-center ion-margin-top">
      <ion-list>
        <ion-item v-for="n in 5" :key="n">
          <ion-label>
            <h2><ion-skeleton-text animated style="width: 40%"></ion-skeleton-text></h2>
            <p><ion-skeleton-text animated style="width: 30%"></ion-skeleton-text></p>
          </ion-label>
        </ion-item>
      </ion-list>
    </div>

    <div v-else-if="boletas.length === 0" class="ion-text-center ion-margin-top">
      <p>No se encontraron boletas asignadas.</p>
    </div>

    <ion-list v-else>
      <ion-item-sliding v-for="(boleta, index) in boletas" :key="boleta.id">
        <ion-item>
          <ion-label>
            <h2>Boleta #{{ boleta.numero }}</h2>
            <p>Estado: {{ boleta.estado }}</p>
          </ion-label>
          <ion-badge slot="end" :color="boleta.estado === 'asignada' ? 'warning' : 'success'">
            {{ boleta.estado }}
          </ion-badge>
        </ion-item>

        <ion-item-options side="end">
          <ion-item-option color="danger" @click="confirmarDesasignacion(boleta.id, index)">
            <ion-icon slot="icon-only" :icon="trash"></ion-icon>
          </ion-item-option>
        </ion-item-options>
      </ion-item-sliding>
    </ion-list>
  </ion-content>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonList, IonItem, IonLabel, IonBadge, modalController, IonItemSliding, IonItemOptions, IonItemOption, IonIcon, alertController, toastController, IonSkeletonText } from '@ionic/vue';
import { trash } from 'ionicons/icons';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot, doc, Unsubscribe, increment, runTransaction } from 'firebase/firestore';
import { Haptics, NotificationType, ImpactStyle } from '@capacitor/haptics';

const props = defineProps<{
  id: string;
  nombre: string;
  tipo: string; // 'Vendedor' | 'Socio'
}>();

const boletas = ref<any[]>([]);
const loading = ref(true);
let unsubscribe: Unsubscribe | null = null;

const cerrarModal = () => {
  modalController.dismiss();
};

const mostrarToast = async (mensaje: string, color: 'success' | 'danger' = 'success') => {
  const toast = await toastController.create({
    message: mensaje,
    duration: 2000,
    position: 'top',
    color: color,
  });
  await toast.present();
};

const confirmarDesasignacion = async (boletaId: string, index: number) => {
  await Haptics.impact({ style: ImpactStyle.Medium });
  const alert = await alertController.create({
    header: 'Confirmar Acción',
    message: `¿Estás seguro de que quieres desasignar la boleta #${boletaId}? Esta acción la dejará disponible.`,
    buttons: [
      {
        text: 'Cancelar',
        role: 'cancel',
      },
      {
        text: 'Sí, Desasignar',
        handler: () => desasignarBoleta(boletaId, index),
      },
    ],
  });
  await alert.present();
};

const desasignarBoleta = async (boletaId: string, index: number) => {
  try {
    const boletaRef = doc(db, 'boletas', boletaId);
    
    await runTransaction(db, async (transaction) => {
      const boletaDoc = await transaction.get(boletaRef);
      if (!boletaDoc.exists()) throw "Documento no existe";
      
      const data = boletaDoc.data();
      
      // Solo restamos si realmente estaba asignada (Idempotencia)
      if (data.estado === 'asignada' && data.socioId) {
        const socioRef = doc(db, 'socios', data.socioId);
        transaction.update(socioRef, { boletasAsignadas: increment(-1) });
      }
      
      transaction.update(boletaRef, {
        estado: 'disponible',
        vendedorId: null,
        vendedorNombre: null,
        socioId: null
      });
    });

    boletas.value.splice(index, 1); // Elimina la boleta de la lista local para feedback instantáneo
    mostrarToast(`Boleta #${boletaId} desasignada con éxito.`, 'success');
    await Haptics.notification({ type: NotificationType.Success });
  } catch (error) {
    mostrarToast('Error al desasignar la boleta.', 'danger');
    await Haptics.notification({ type: NotificationType.Error });
    console.error("Error desasignando boleta:", error);
  }
};

onMounted(async () => {
  try {
    // Filtramos por vendedorId o socioId según corresponda
    const campo = props.tipo === 'Vendedor' ? 'vendedorId' : 'socioId';
    const q = query(collection(db, 'boletas'), where(campo, '==', props.id));
    
    unsubscribe = onSnapshot(q, (snapshot) => {
      const tempBoletas = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Ordenamos localmente por número
      tempBoletas.sort((a: any, b: any) => a.numero.localeCompare(b.numero));
      boletas.value = tempBoletas;
      loading.value = false;
    });
  } catch (error) {
    console.error("Error cargando boletas", error);
    loading.value = false;
  }
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>