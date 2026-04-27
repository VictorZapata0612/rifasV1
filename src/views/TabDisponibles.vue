<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Boletas Disponibles</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Summary Card -->
      <div class="ion-padding available-summary-wrap">
        <ion-card class="summary-card">
          <ion-card-header>
            <ion-card-title>Resumen de Inventario</ion-card-title>
          </ion-card-header>
          <ion-card-content>
            <ion-grid>
              <ion-row>
                <ion-col size="4" class="ion-text-center">
                  <ion-label>
                    <p class="stat-label">Total</p>
                    <h2 class="stat-value">10,000</h2>
                  </ion-label>
                </ion-col>
                <ion-col size="4" class="ion-text-center">
                  <ion-label>
                    <p class="stat-label">Asignadas</p>
                    <h2 class="stat-value assigned">{{ totalAsignadas }}</h2>
                  </ion-label>
                </ion-col>
                <ion-col size="4" class="ion-text-center">
                  <ion-label>
                    <p class="stat-label">Disponibles</p>
                    <h2 class="stat-value available">{{ totalDisponibles }}</h2>
                  </ion-label>
                </ion-col>
              </ion-row>
            </ion-grid>
          </ion-card-content>
        </ion-card>
      </div>

      <div v-if="loading" class="ion-text-center ion-padding-top">
        <ion-spinner name="crescent"></ion-spinner>
        <p class="ion-text-muted ion-margin-top">Calculando boletas disponibles...</p>
      </div>

      <div v-else-if="totalDisponibles === 0 && !loading" class="ion-text-center ion-padding">
        <ion-icon :icon="ticketOutline" style="font-size: 64px; color: var(--ion-color-medium);"></ion-icon>
        <p class="ion-text-muted">¡Felicidades! Todas las boletas han sido asignadas.</p>
      </div>

      <ion-list v-else>
        <ion-list-header class="available-list-header">
          <ion-label>Listado de Disponibles (Mostrando {{ displayedBoletas.length }} de {{ totalDisponibles }})</ion-label>
        </ion-list-header>
        <ion-item v-for="boleta in displayedBoletas" :key="boleta.id">
          <ion-icon :icon="ticketOutline" slot="start" color="success"></ion-icon>
          <ion-label>
            <h2>Boleta #{{ boleta.numero }}</h2>
          </ion-label>
          <ion-badge slot="end" color="success">Libre</ion-badge>
        </ion-item>
      </ion-list>

      <ion-infinite-scroll @ionInfinite="loadMoreItems" :disabled="allLoaded">
        <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Cargando más..."></ion-infinite-scroll-content>
      </ion-infinite-scroll>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonIcon, IonBadge, IonSpinner, IonListHeader, IonRefresher, IonRefresherContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/vue';
import { ticketOutline } from 'ionicons/icons';
import { db } from '../firebase/config';
import { collection, query, onSnapshot, orderBy, Unsubscribe, limit, startAfter, getDocs, doc, getCountFromServer, where } from 'firebase/firestore';

const displayedBoletas = ref<{ numero: string, id: string }[]>([]); // Solo las visibles
const loading = ref(false);
const totalAsignadas = ref(0);
const totalDisponibles = ref(0);
const TOTAL_BOLETAS = 10000;
const PAGE_SIZE = 50;
const allLoaded = ref(false);
let lastVisible: any = null;
let unsubscribeDisponibles: Unsubscribe | null = null;
let unsubscribeStats: Unsubscribe | null = null;
let fallbackHydrated = false;

const totalMostrado = computed(() => displayedBoletas.value.length);

const hydrateStatsFromAssignedCount = async () => {
  if (fallbackHydrated) return;
  fallbackHydrated = true;

  const assignedQ = query(collection(db, 'boletas'), where('estado', '==', 'asignada'));
  const countSnap = await getCountFromServer(assignedQ);
  const assigned = countSnap.data().count;

  totalAsignadas.value = assigned;
  totalDisponibles.value = Math.max(0, TOTAL_BOLETAS - assigned);
};

const iniciarListener = () => {
  loading.value = true;

  displayedBoletas.value = [];
  allLoaded.value = false;
  lastVisible = null;

  const disponiblesQ = query(
    collection(db, 'boletas_disponibles'),
    orderBy('numero', 'asc'),
    limit(PAGE_SIZE)
  );

  unsubscribeDisponibles = onSnapshot(disponiblesQ, (snapshot) => {
    displayedBoletas.value = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    lastVisible = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    allLoaded.value = snapshot.docs.length < PAGE_SIZE;
    loading.value = false;
  }, (error) => {
    console.error("Error en listener de disponibles:", error);
    loading.value = false;
  });

  unsubscribeStats = onSnapshot(doc(db, 'stats', 'inventario'), (snapshot) => {
    if (!snapshot.exists()) {
      void hydrateStatsFromAssignedCount();
      return;
    }

    const data = snapshot.data();
    totalAsignadas.value = data.totalAsignadas || 0;
    totalDisponibles.value = data.totalDisponibles || 0;
  });
};

const loadMoreItems = async (ev?: any) => {
  try {
    if (allLoaded.value || !lastVisible) {
      if (ev) ev.target.complete();
      return;
    }

    const nextQ = query(
      collection(db, 'boletas_disponibles'),
      orderBy('numero', 'asc'),
      startAfter(lastVisible),
      limit(PAGE_SIZE)
    );

    const snap = await getDocs(nextQ);
    const nextBatch = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    displayedBoletas.value = [...displayedBoletas.value, ...nextBatch];

    lastVisible = snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : lastVisible;
    allLoaded.value = snap.docs.length < PAGE_SIZE;
  } finally {
    if (ev) ev.target.complete();
  }
};

const doRefresh = (event: any) => {
  if (unsubscribeDisponibles) {
    unsubscribeDisponibles();
    unsubscribeDisponibles = null;
  }
  if (unsubscribeStats) {
    unsubscribeStats();
    unsubscribeStats = null;
  }
  fallbackHydrated = false;
  iniciarListener();
  setTimeout(() => event.target.complete(), 1000);
};

onMounted(() => {
  iniciarListener();
});

onUnmounted(() => {
  if (unsubscribeDisponibles) unsubscribeDisponibles();
  if (unsubscribeStats) unsubscribeStats();
});
</script>

<style scoped>
.summary-card {
  --background: var(--ion-card-background, #f9f9f9);
  box-shadow: 0 10px 28px rgba(14, 35, 68, 0.14);
  border: 1px solid color-mix(in srgb, var(--ion-color-primary) 16%, transparent);
}

.available-summary-wrap {
  position: sticky;
  top: 0;
  z-index: 4;
  backdrop-filter: blur(4px);
}

.available-list-header {
  margin-top: 8px;
}

.available-list-header ion-label {
  padding: 6px 12px;
  border-radius: 999px;
  display: inline-block;
  background: color-mix(in srgb, var(--ion-color-primary) 12%, transparent);
  color: var(--ion-color-primary);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  margin-bottom: 4px;
}
.stat-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--ion-text-color);
}
.stat-value.assigned {
  color: var(--ion-color-warning);
}
.stat-value.available {
  color: var(--ion-color-success);
}

@media (max-width: 480px) {
  .stat-value {
    font-size: 1.52rem;
  }
}
</style>