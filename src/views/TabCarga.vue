<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Carga Rápida</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="ion-padding">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Carga Rápida</ion-title>
        </ion-toolbar>
      </ion-header>

      <div class="quick-panel ion-margin-bottom">
        <div class="quick-panel-head">
          <h2>Mesa de digitación</h2>
          <p>Registra boletas seguidas usando Enter.</p>
        </div>
        <div class="quick-status">
          <span>{{ socioActivoNombre }}</span>
          <span>{{ vendedorActivoNombre }}</span>
        </div>
      </div>

      <div class="ion-margin-bottom">
        <ion-item lines="none" class="rounded-item ion-margin-bottom">
          <ion-select
            label="1. Socio"
            label-placement="floating"
            v-model="socioSeleccionado"
            placeholder="Selecciona el socio"
            interface="action-sheet"
            class="custom-select"
          >
            <ion-select-option v-for="socio in socios" :key="socio.id" :value="socio.id">
              {{ socio.nombre }}
            </ion-select-option>
          </ion-select>
        </ion-item>
        <ion-item lines="none" class="rounded-item">
          <ion-select
            label="2. Vendedor Activo"
            label-placement="floating"
            v-model="vendedorSeleccionado"
            placeholder="Selecciona el vendedor"
            interface="action-sheet"
            class="custom-select"
            :disabled="!socioSeleccionado"
          >
            <ion-select-option v-for="vendedor in vendedores" :key="vendedor.id" :value="vendedor.id">
              {{ vendedor.nombre }}
            </ion-select-option>
          </ion-select>
        </ion-item>
      </div>

      <div class="input-card ion-text-center ion-padding-vertical ion-margin-bottom">
        <ion-label color="medium" class="ion-text-uppercase text-small">Número de Boleta</ion-label>
        <ion-input
          class="input-gigante"
          ref="inputBoleta"
          type="tel"
          v-model="numeroBoleta"
          placeholder="0000"
          :maxlength="4"
          @keyup.enter="guardarBoleta"
        ></ion-input>
        <p class="quick-hint">{{ helperMessage }}</p>
      </div>

      <ion-button class="ion-margin-top action-button" expand="block" size="large" @click="guardarBoleta" :disabled="loading || !numeroBoleta" shape="round">
        <ion-spinner v-if="loading" name="crescent"></ion-spinner>
        <span v-else>Registrar boleta</span>
      </ion-button>

      <div v-if="historial.length > 0" class="ion-margin-top">
        <ion-list-header>
          <ion-label>Últimas asignaciones</ion-label>
        </ion-list-header>
        <ion-list lines="none">
          <TransitionGroup name="list">
            <ion-item v-for="(item, index) in historial" :key="item.numero + index" class="history-item">
              <ion-label>
                <h2>Boleta #{{ item.numero }}</h2>
                <p>Asignada a {{ item.vendedorNombre }} • {{ formatTime(item.createdAt) }}</p>
              </ion-label>
              <ion-button fill="clear" slot="end" color="medium" @click="revertirAsignacion(item, index)">
                <ion-icon slot="icon-only" :icon="arrowUndo"></ion-icon>
              </ion-button>
            </ion-item>
          </TransitionGroup>
        </ion-list>
      </div>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonInput, IonSelect, IonSelectOption, IonButton, IonSpinner, toastController, alertController, IonLabel, IonListHeader, IonIcon } from '@ionic/vue';
import { arrowUndo } from 'ionicons/icons';
import { db } from '../firebase/config';
import { collection, doc, getDoc, onSnapshot, query, orderBy, serverTimestamp, Unsubscribe, increment, runTransaction, where } from 'firebase/firestore';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// --- Estado del componente (reactividad) ---
const numeroBoleta = ref('');
const socioSeleccionado = ref('');
const vendedorSeleccionado = ref('');
const loading = ref(false);
const socios = ref<any[]>([]);
const vendedores = ref<any[]>([]);
const historial = ref<any[]>([]); // Para el feedback visual
const inputBoleta = ref();
let unsubscribeSocios: Unsubscribe | null = null;
let unsubscribeVendedores: Unsubscribe | null = null;
const TOTAL_BOLETAS = 10000;

const socioActivoNombre = computed(() => {
  if (!socioSeleccionado.value) return 'Sin socio seleccionado';
  const socio = socios.value.find(s => s.id === socioSeleccionado.value);
  return socio ? `Socio: ${socio.nombre}` : 'Socio no disponible';
});

const vendedorActivoNombre = computed(() => {
  if (!vendedorSeleccionado.value) return 'Sin vendedor activo';
  const vendedor = vendedores.value.find(v => v.id === vendedorSeleccionado.value);
  return vendedor ? `Vendedor: ${vendedor.nombre}` : 'Vendedor no disponible';
});

const helperMessage = computed(() => {
  if (!socioSeleccionado.value) return 'Primero selecciona un socio para habilitar la digitación.';
  if (!vendedorSeleccionado.value) return 'Selecciona un vendedor para comenzar a registrar boletas.';
  return 'Escribe 4 dígitos y presiona Enter para cargar más rápido.';
});

// --- Métodos ---

const cargarSocios = () => {
  const q = query(collection(db, 'socios'), orderBy('nombre', 'asc'));
  unsubscribeSocios = onSnapshot(q, (snapshot) => {
    socios.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }, (error) => {
    console.error("Error al cargar socios:", error);
    mostrarToast('No se pudieron cargar los socios.', 'danger');
  });
};

watch(socioSeleccionado, (newSocioId) => {
  vendedorSeleccionado.value = ''; // Resetear vendedor al cambiar de socio
  vendedores.value = [];

  if (unsubscribeVendedores) {
    unsubscribeVendedores();
    unsubscribeVendedores = null;
  }

  if (!newSocioId) return;

  const q = query(collection(db, 'vendedores'), where('id_socio', '==', newSocioId), orderBy('nombre', 'asc'));
  
  unsubscribeVendedores = onSnapshot(q, (snapshot) => {
    const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    lista.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }));
    vendedores.value = lista;
  }, (error) => {
    console.error("Error al cargar vendedores:", error);
    mostrarToast('No se pudieron cargar los vendedores.', 'danger');
  });
});

onMounted(() => {
  cargarSocios();

  // Cargar historial persistente al iniciar
  const saved = localStorage.getItem('historial_boletas');
  if (saved) {
    try {
      historial.value = JSON.parse(saved);
    } catch (e) { console.error("Error cargando historial", e); }
  }
});

onUnmounted(() => {
  if (unsubscribeSocios) unsubscribeSocios();
  if (unsubscribeVendedores) unsubscribeVendedores();
});

const mostrarToast = async (mensaje: string, color: 'success' | 'danger' | 'warning' = 'success') => {
  const toast = await toastController.create({
    message: mensaje,
    duration: 1500, // Más rápido para no estorbar
    position: 'top',
    color: color,
  });
  await toast.present();
};

const guardarBoleta = async () => {
  if (!vendedorSeleccionado.value) {
    return mostrarToast('Selecciona un vendedor activo antes de registrar.', 'danger');
  }
  
  if (!/^\d{4}$/.test(numeroBoleta.value)) {
    return mostrarToast('El número debe tener 4 dígitos (0000 a 9999).', 'danger');
  }

  if (historial.value.some(h => h.numero === numeroBoleta.value)) {
    return mostrarToast(`La boleta ${numeroBoleta.value} ya fue registrada hace un momento.`, 'warning');
  }

  loading.value = true;
  try {
    const numero = numeroBoleta.value;
    const vendedor = vendedores.value.find(v => v.id === vendedorSeleccionado.value);
    const boletaRef = doc(db, 'boletas', numero);

    const boletaSnap = await getDoc(boletaRef);
    
    if (boletaSnap.exists()) {
      const data = boletaSnap.data();
      if (data.vendedorId && data.vendedorId !== vendedorSeleccionado.value) {
        const alert = await alertController.create({
          header: 'Conflicto de asignación',
          message: `La boleta <strong>${numero}</strong> está asignada a <strong>${data.vendedorNombre}</strong>.<br><br>¿Quieres moverla a <strong>${vendedor?.nombre}</strong>?`,
          buttons: [
            { text: 'Cancelar', role: 'cancel', handler: () => { loading.value = false; } },
            { text: 'Reasignar', role: 'confirm' }
          ]
        });
        await alert.present();
        const { role } = await alert.onDidDismiss();
        if (role !== 'confirm') {
          loading.value = false;
          return;
        }
      }
    }

    await runTransaction(db, async (transaction) => {
      const currentBoleta = await transaction.get(boletaRef);
      const previousData = currentBoleta.exists() ? currentBoleta.data() : null;
      const previousEstado = previousData?.estado || 'disponible';
      const oldSocioId = previousData?.socioId || null;
      const oldVendedorId = previousData?.vendedorId || null;
      const newSocioId = vendedor?.id_socio || null;
      const newVendedorId = vendedorSeleccionado.value;
      const statsRef = doc(db, 'stats', 'inventario');
      const disponibleRef = doc(db, 'boletas_disponibles', numero);
      const statsSnap = await transaction.get(statsRef);
      const currentAssigned = statsSnap.exists() ? (statsSnap.data().totalAsignadas || 0) : 0;
      const currentAvailable = statsSnap.exists() ? (statsSnap.data().totalDisponibles || TOTAL_BOLETAS) : TOTAL_BOLETAS;
      
      if (previousEstado === 'asignada') {
        if (oldSocioId && oldSocioId !== 'Sin Socio' && oldSocioId !== newSocioId) {
          const oldSocioRef = doc(db, 'socios', oldSocioId);
          transaction.update(oldSocioRef, { boletasAsignadas: increment(-1) });
        }

        if (oldVendedorId && oldVendedorId !== newVendedorId) {
          const oldVendedorRef = doc(db, 'vendedores', oldVendedorId);
          transaction.update(oldVendedorRef, { boletasAsignadas: increment(-1) });
        }
      }

      transaction.set(boletaRef, {
        numero: numero,
        vendedorId: vendedorSeleccionado.value,
        vendedorNombre: vendedor?.nombre || 'Desconocido',
        socioId: vendedor?.id_socio || 'Sin Socio',
        estado: 'asignada',
        fechaAsignacion: serverTimestamp()
      });

      if (newSocioId && oldSocioId !== newSocioId) {
        const newSocioRef = doc(db, 'socios', newSocioId);
        transaction.update(newSocioRef, { boletasAsignadas: increment(1) });
      }

      if (oldVendedorId !== newVendedorId) {
        const newVendedorRef = doc(db, 'vendedores', newVendedorId);
        transaction.update(newVendedorRef, { boletasAsignadas: increment(1) });
      }

      transaction.delete(disponibleRef);
      if (previousEstado !== 'asignada') {
        transaction.set(statsRef, {
          total: TOTAL_BOLETAS,
          totalAsignadas: currentAssigned + 1,
          totalDisponibles: Math.max(0, currentAvailable - 1),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    });

    historial.value.unshift({
      numero: numero,
      vendedorNombre: vendedor?.nombre,
      createdAt: Date.now()
    });
    
    if (historial.value.length > 5) historial.value.pop();

    localStorage.setItem('historial_boletas', JSON.stringify(historial.value));

    await Haptics.impact({ style: ImpactStyle.Heavy });

    mostrarToast(`Boleta ${numero} registrada correctamente.`, 'success');
    numeroBoleta.value = '';
    
    setTimeout(() => {
      inputBoleta.value?.$el?.setFocus();
    }, 100);

  } catch (error) {
    console.error("Error al guardar boleta: ", error);
    mostrarToast('No se pudo registrar la boleta. Intenta de nuevo.', 'danger');
  } finally {
    loading.value = false;
  }
};

const revertirAsignacion = async (item: any, index: number) => {
  const alert = await alertController.create({
    header: 'Deshacer asignación',
    message: `¿Deseas liberar la boleta #${item.numero}?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      {
        text: 'Liberar',
        handler: async () => {
          await procesarReversion(item.numero, index);
        }
      }
    ]
  });
  await alert.present();
};

const procesarReversion = async (numero: string, index: number) => {
  loading.value = true;
  try {
    const boletaRef = doc(db, 'boletas', numero);

    await runTransaction(db, async (transaction) => {
      const boletaDoc = await transaction.get(boletaRef);
      if (!boletaDoc.exists()) throw "La boleta no existe.";

      const data = boletaDoc.data();
      if (data.estado !== 'asignada') throw "La boleta ya no está asignada.";
      const statsRef = doc(db, 'stats', 'inventario');
      const disponibleRef = doc(db, 'boletas_disponibles', numero);
      const statsSnap = await transaction.get(statsRef);
      const currentAssigned = statsSnap.exists() ? (statsSnap.data().totalAsignadas || 0) : 0;
      const currentAvailable = statsSnap.exists() ? (statsSnap.data().totalDisponibles || TOTAL_BOLETAS) : TOTAL_BOLETAS;

      if (data.socioId && data.socioId !== 'Sin Socio') {
        const socioRef = doc(db, 'socios', data.socioId);
        transaction.update(socioRef, { boletasAsignadas: increment(-1) });
      }

      if (data.vendedorId) {
        const vendedorRef = doc(db, 'vendedores', data.vendedorId);
        transaction.update(vendedorRef, { boletasAsignadas: increment(-1) });
      }

      transaction.update(boletaRef, {
        estado: 'disponible',
        vendedorId: null,
        vendedorNombre: null,
        socioId: null,
        fechaAsignacion: null
      });

      transaction.set(disponibleRef, {
        numero,
        updatedAt: serverTimestamp()
      }, { merge: true });

      transaction.set(statsRef, {
        total: TOTAL_BOLETAS,
        totalAsignadas: Math.max(0, currentAssigned - 1),
        totalDisponibles: currentAvailable + 1,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    historial.value.splice(index, 1);
    localStorage.setItem('historial_boletas', JSON.stringify(historial.value));
    
    await Haptics.notification({ type: NotificationType.Success });
    mostrarToast(`Boleta ${numero} liberada correctamente.`, 'warning');

  } catch (error) {
    console.error("Error al revertir:", error);
    mostrarToast('No se pudo liberar la boleta.', 'danger');
  } finally {
    loading.value = false;
  }
};

const formatTime = (value?: number) => {
  if (!value) return 'Hace un momento';
  return new Date(value).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
};
</script>

<style scoped>
.quick-panel {
  background: linear-gradient(145deg, color-mix(in srgb, var(--ion-color-primary) 12%, var(--ion-card-background)), color-mix(in srgb, var(--ion-color-secondary) 8%, var(--ion-card-background)));
  border: 1px solid color-mix(in srgb, var(--ion-color-primary) 24%, transparent);
  border-radius: 18px;
  padding: 14px;
  box-shadow: 0 8px 20px rgba(18, 42, 78, 0.12);
}

.quick-panel-head h2 {
  margin: 0;
  font-size: 1rem;
  font-family: 'Space Grotesk', 'Outfit', sans-serif;
}

.quick-panel-head p {
  margin: 4px 0 0;
  font-size: 0.84rem;
  color: var(--ion-color-medium);
}

.quick-status {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}

.quick-status span {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ion-card-background) 82%, var(--ion-color-primary));
  color: var(--ion-text-color);
  border: 1px solid color-mix(in srgb, var(--ion-color-primary) 22%, transparent);
  font-size: 0.78rem;
  font-weight: 600;
}

.rounded-item {
  --background: var(--ion-color-light);
  border-radius: 14px;
  box-shadow: 0 4px 12px rgba(14, 32, 61, 0.07);
}

.input-card {
  background: linear-gradient(160deg, color-mix(in srgb, var(--ion-color-primary) 10%, white), var(--ion-card-background, #ffffff));
  border-radius: 20px;
  box-shadow: 0 14px 30px rgba(16, 38, 72, 0.14);
  border: 1px solid color-mix(in srgb, var(--ion-color-primary) 20%, transparent);
  transition: transform 0.1s ease;
}

.input-card:active {
  transform: scale(0.99);
}

.input-gigante {
  --background: transparent;
  font-size: 3.4rem;
  font-weight: 800;
  letter-spacing: 6px;
  text-align: center;
  --padding-top: 10px;
  --padding-bottom: 10px;
}

.quick-hint {
  margin: 6px 12px 0;
  color: var(--ion-color-medium);
  font-size: 0.8rem;
}

@media (prefers-color-scheme: dark) {
  .quick-panel {
    background: linear-gradient(145deg, #1a2b45, #1b324f);
    border-color: rgba(117, 170, 255, 0.35);
    box-shadow: 0 12px 26px rgba(2, 8, 18, 0.45);
  }

  .quick-panel-head p,
  .quick-hint {
    color: #afbfd7;
  }

  .quick-status span {
    background: #243856;
    color: #eaf2ff;
    border-color: rgba(141, 182, 255, 0.35);
  }

  .input-card {
    background: linear-gradient(160deg, #1a2d49, #132238);
    border-color: rgba(117, 170, 255, 0.3);
  }
}

.action-button {
  min-height: 52px;
  --box-shadow: 0 10px 20px rgba(22, 70, 132, 0.26);
}

.history-item {
  --background: color-mix(in srgb, var(--ion-color-light) 65%, transparent);
  margin-bottom: 6px;
  border: 1px solid color-mix(in srgb, var(--ion-color-medium) 30%, transparent);
}

/* Animaciones de Lista */
.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

@media (max-width: 420px) {
  .input-gigante {
    font-size: 2.8rem;
    letter-spacing: 4px;
  }
}
</style>