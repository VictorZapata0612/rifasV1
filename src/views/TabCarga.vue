<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Digitación Masiva</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true" class="ion-padding">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Digitación</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- Selector de Vendedor (Estilo Card) -->
      <div class="ion-margin-bottom">
        <ion-item lines="none" class="rounded-item ion-margin-bottom">
          <ion-select
            label="Socio"
            label-placement="floating"
            v-model="socioSeleccionado"
            placeholder="1. Seleccione un Socio"
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
            label="Vendedor Activo"
            label-placement="floating"
            v-model="vendedorSeleccionado"
            placeholder="2. Seleccione un Vendedor"
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

      <!-- Zona de Disparo (Input Gigante con Sombra) -->
      <div class="input-card ion-text-center ion-padding-vertical ion-margin-bottom">
        <ion-label color="medium" class="ion-text-uppercase text-small">Número de Boleta</ion-label>
        <ion-input
          class="input-gigante"
          ref="inputBoleta"
          type="tel"
          v-model="numeroBoleta"
          placeholder="----"
          :maxlength="4"
          @keyup.enter="guardarBoleta"
        ></ion-input>
      </div>

      <!-- Botón de Acción -->
      <ion-button class="ion-margin-top action-button" expand="block" size="large" @click="guardarBoleta" :disabled="loading || !numeroBoleta" shape="round">
        <ion-spinner v-if="loading" name="crescent"></ion-spinner>
        <span v-else>GUARDAR (Enter)</span>
      </ion-button>

      <!-- Historial Reciente (Feedback Visual) -->
      <div v-if="historial.length > 0" class="ion-margin-top">
        <ion-list-header>
          <ion-label>Últimas Agregadas</ion-label>
        </ion-list-header>
        <ion-list lines="none">
          <TransitionGroup name="list">
            <ion-item v-for="(item, index) in historial" :key="item.numero + index" class="history-item">
              <ion-label>
                <h2>Boleta #{{ item.numero }}</h2>
                <p>Asignada a: {{ item.vendedorNombre }}</p>
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
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonInput, IonSelect, IonSelectOption, IonButton, IonSpinner, toastController, alertController, IonLabel, IonListHeader, IonIcon } from '@ionic/vue';
import { checkmarkCircle, arrowUndo } from 'ionicons/icons';
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
  // Validaciones básicas
  if (!vendedorSeleccionado.value) {
    return mostrarToast('⚠️ Selecciona un vendedor primero.', 'danger');
  }
  
  // Validación 1: Formato estricto (4 dígitos numéricos)
  if (!/^\d{4}$/.test(numeroBoleta.value)) {
    return mostrarToast('⚠️ El número debe ser de 4 dígitos numéricos (0000-9999).', 'danger');
  }

  // Validación 2: Duplicado en sesión (evitar doble entrada accidental)
  if (historial.value.some(h => h.numero === numeroBoleta.value)) {
    return mostrarToast(`⚠️ La boleta ${numeroBoleta.value} ya fue agregada recientemente.`, 'warning');
  }

  loading.value = true;
  try {
    const numero = numeroBoleta.value;
    const vendedor = vendedores.value.find(v => v.id === vendedorSeleccionado.value);
    const boletaRef = doc(db, 'boletas', numero);

    // Validación 3: Verificar si ya pertenece a otro vendedor (Prevención de errores)
    const boletaSnap = await getDoc(boletaRef);
    
    if (boletaSnap.exists()) {
      const data = boletaSnap.data();
      if (data.vendedorId && data.vendedorId !== vendedorSeleccionado.value) {
        const alert = await alertController.create({
          header: '⚠️ Conflicto de Asignación',
          message: `La boleta <strong>${numero}</strong> ya está asignada a <strong>${data.vendedorNombre}</strong>.<br><br>¿Deseas reasignarla a <strong>${vendedor?.nombre}</strong>?`,
          buttons: [
            { text: 'Cancelar', role: 'cancel', handler: () => { loading.value = false; } },
            { text: 'Sí, Reasignar', role: 'confirm' }
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

    // Usamos el número de boleta como ID del documento para máxima velocidad de lectura/escritura
    
    // TRANSACCIÓN: Garantiza consistencia y evita duplicados/corrupción de contadores
    await runTransaction(db, async (transaction) => {
      // 1. Leer estado actual de la boleta (Lectura atómica)
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
      
      // 2. Si ya existía y tenía dueño, restar al anterior (Manejo de reasignación)
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

      // 3. Guardar nueva asignación
      transaction.set(boletaRef, {
        numero: numero,
        vendedorId: vendedorSeleccionado.value,
        vendedorNombre: vendedor?.nombre || 'Desconocido',
        socioId: vendedor?.id_socio || 'Sin Socio',
        estado: 'asignada',
        fechaAsignacion: serverTimestamp()
      });

      // 4. Sumar al nuevo dueño
      if (newSocioId && oldSocioId !== newSocioId) {
        const newSocioRef = doc(db, 'socios', newSocioId);
        transaction.update(newSocioRef, { boletasAsignadas: increment(1) });
      }

      if (oldVendedorId !== newVendedorId) {
        const newVendedorRef = doc(db, 'vendedores', newVendedorId);
        transaction.update(newVendedorRef, { boletasAsignadas: increment(1) });
      }

      // 5. Materializar inventario: al asignar, la boleta deja de estar disponible
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

    // Feedback visual y limpieza
    historial.value.unshift({
      numero: numero,
      vendedorNombre: vendedor?.nombre
    });
    
    // Limitamos el historial a los últimos 5
    if (historial.value.length > 5) historial.value.pop();

    // Guardar en almacenamiento local para persistencia
    localStorage.setItem('historial_boletas', JSON.stringify(historial.value));

    // Feedback Háptico (Vibración)
    await Haptics.impact({ style: ImpactStyle.Heavy });

    mostrarToast(`Boleta ${numero} guardada.`, 'success');
    numeroBoleta.value = ''; // Limpiar para el siguiente
    
    // Mantener el foco para digitación continua
    setTimeout(() => {
      inputBoleta.value?.$el?.setFocus();
    }, 100);

  } catch (error) {
    console.error("Error al guardar boleta: ", error);
    mostrarToast('Error al guardar. Intenta de nuevo.', 'danger');
  } finally {
    loading.value = false;
  }
};

const revertirAsignacion = async (item: any, index: number) => {
  const alert = await alertController.create({
    header: 'Deshacer Asignación',
    message: `¿Quieres liberar la boleta #${item.numero}?`,
    buttons: [
      { text: 'Cancelar', role: 'cancel' },
      {
        text: 'Sí, Deshacer',
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

      // Restar al socio actual
      if (data.socioId && data.socioId !== 'Sin Socio') {
        const socioRef = doc(db, 'socios', data.socioId);
        transaction.update(socioRef, { boletasAsignadas: increment(-1) });
      }

      // Restar al vendedor actual
      if (data.vendedorId) {
        const vendedorRef = doc(db, 'vendedores', data.vendedorId);
        transaction.update(vendedorRef, { boletasAsignadas: increment(-1) });
      }

      // Resetear boleta
      transaction.update(boletaRef, {
        estado: 'disponible',
        vendedorId: null,
        vendedorNombre: null,
        socioId: null,
        fechaAsignacion: null
      });

      // Materializar inventario: al liberar, vuelve a disponibles
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

    // Actualizar UI
    historial.value.splice(index, 1);
    localStorage.setItem('historial_boletas', JSON.stringify(historial.value));
    
    await Haptics.notification({ type: NotificationType.Success });
    mostrarToast(`Asignación de boleta ${numero} revertida.`, 'warning');

  } catch (error) {
    console.error("Error al revertir:", error);
    mostrarToast('No se pudo revertir la asignación.', 'danger');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.rounded-item {
  --background: var(--ion-color-light);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.input-card {
  background: var(--ion-card-background, #ffffff);
  border-radius: 20px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.08);
  border: 1px solid var(--ion-item-border-color, rgba(0,0,0,0.05));
  transition: transform 0.1s ease;
}

.input-card:active {
  transform: scale(0.98);
}

.input-gigante {
  --background: transparent;
  font-size: 4rem;
  font-weight: 800;
  letter-spacing: 8px;
  text-align: center;
  --padding-top: 10px;
  --padding-bottom: 10px;
}

.history-item {
  --background: transparent;
  margin-bottom: 5px;
  border-bottom: 1px solid var(--ion-item-border-color, #f0f0f0);
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
</style>