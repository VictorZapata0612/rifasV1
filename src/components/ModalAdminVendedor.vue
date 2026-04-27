<template>
  <ion-header>
    <ion-toolbar color="primary">
      <ion-title>{{ vendedor ? 'Editar Vendedor' : 'Nuevo Vendedor' }}</ion-title>
      <ion-buttons slot="end">
        <ion-button @click="cerrarModal">Cancelar</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content class="ion-padding">
    <ion-list>
      <ion-item>
        <ion-icon :icon="personOutline" slot="start" color="medium"></ion-icon>
        <ion-input label="Nombre del Vendedor" label-placement="stacked" v-model="form.nombre" placeholder="Ej. Ana María"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-icon :icon="businessOutline" slot="start" color="medium"></ion-icon>
        <ion-select label="Socio Asignado" label-placement="stacked" v-model="form.id_socio" placeholder="Seleccione un socio">
          <ion-select-option v-for="s in socios" :key="s.id" :value="s.id">{{ s.nombre }}</ion-select-option>
        </ion-select>
      </ion-item>
    </ion-list>

    <div class="ion-padding-top">
      <ion-button expand="block" @click="guardar" :disabled="loading">
        {{ loading ? 'Guardando...' : 'Guardar' }}
      </ion-button>
      
      <ion-button v-if="vendedor" expand="block" color="danger" fill="outline" class="ion-margin-top" @click="confirmarEliminar">
        Eliminar Vendedor
      </ion-button>
    </div>
  </ion-content>
</template>

<script setup lang="ts">
import { ref, PropType, onMounted, onUnmounted } from 'vue';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonList, IonItem, IonInput, IonSelect, IonSelectOption, modalController, alertController, IonIcon } from '@ionic/vue';
import { personOutline, businessOutline } from 'ionicons/icons';
import { db } from '../firebase/config';
import { doc, setDoc, deleteDoc, collection, addDoc, onSnapshot, query, orderBy, Unsubscribe } from 'firebase/firestore';
import { Haptics, NotificationType } from '@capacitor/haptics';

const props = defineProps({
  vendedor: {
    type: Object as PropType<any>,
    default: null
  }
});

const form = ref({
  nombre: props.vendedor?.nombre || '',
  id_socio: props.vendedor?.id_socio || ''
});
const socios = ref<any[]>([]);
const loading = ref(false);
let unsubscribe: Unsubscribe | null = null;

const cerrarModal = () => modalController.dismiss();

onMounted(async () => {
  // Cargar lista de socios para el select
  const q = query(collection(db, 'socios'), orderBy('nombre'));
  unsubscribe = onSnapshot(q, (snap) => {
    socios.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

const guardar = async () => {
  if (!form.value.nombre || !form.value.id_socio) return;
  loading.value = true;
  try {
    if (props.vendedor) {
      await setDoc(doc(db, 'vendedores', props.vendedor.id), { ...form.value }, { merge: true });
    } else {
      await addDoc(collection(db, 'vendedores'), { ...form.value });
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
    header: '¿Eliminar Vendedor?',
    message: 'Se eliminará el vendedor. Sus boletas quedarán huérfanas si no se reasignan.',
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      { 
        text: 'Eliminar', 
        role: 'destructive',
        handler: async () => {
          await deleteDoc(doc(db, 'vendedores', props.vendedor.id));
          modalController.dismiss({ role: 'reload' });
          await Haptics.notification({ type: NotificationType.Success });
        }
      }
    ]
  });
  await alert.present();
};
</script>