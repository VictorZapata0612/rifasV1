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
      <div class="ion-padding">
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

      <div v-else-if="allBoletas.length === 0 && !loading" class="ion-text-center ion-padding">
        <ion-icon :icon="ticketOutline" style="font-size: 64px; color: var(--ion-color-medium);"></ion-icon>
        <p class="ion-text-muted">¡Felicidades! Todas las boletas han sido asignadas.</p>
      </div>

      <ion-list v-else>
        <ion-list-header>
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
import { collection, query, onSnapshot, where, Unsubscribe } from 'firebase/firestore';

const allBoletas = ref<{ numero: string, id: string }[]>([]); // Todas las disponibles (en memoria)
const displayedBoletas = ref<{ numero: string, id: string }[]>([]); // Solo las visibles
const loading = ref(false);
const totalAsignadas = ref(0);
const totalDisponibles = ref(0);
const TOTAL_BOLETAS = 10000;
const PAGE_SIZE = 50;
let currentPage = 0;
let unsubscribe: Unsubscribe | null = null;

const allLoaded = computed(() => displayedBoletas.value.length >= allBoletas.value.length);

const iniciarListener = () => {
  loading.value = true;
  
  // 1. Escuchar cambios en boletas asignadas en tiempo real
  const q = query(collection(db, 'boletas'), where('estado', '==', 'asignada'));
  
  unsubscribe = onSnapshot(q, (snapshot) => {
    const assignedNumbers = new Set(snapshot.docs.map(doc => doc.data().numero));
    
    totalAsignadas.value = assignedNumbers.size;
    
    // 2. Recalcular disponibles en memoria
    const disponibles = [];
    for (let i = 0; i < TOTAL_BOLETAS; i++) {
      const numeroStr = i.toString().padStart(4, '0');
      if (!assignedNumbers.has(numeroStr)) {
        disponibles.push({ numero: numeroStr, id: numeroStr });
      }
    }
    
    allBoletas.value = disponibles;
    totalDisponibles.value = disponibles.length;

    // 3. Actualizar vista manteniendo la cantidad de items visibles (o cargar primera página)
    const currentCount = displayedBoletas.value.length > 0 ? displayedBoletas.value.length : PAGE_SIZE;
    displayedBoletas.value = allBoletas.value.slice(0, currentCount);
    
    // Ajustar paginación
    currentPage = Math.ceil(displayedBoletas.value.length / PAGE_SIZE);
    
    loading.value = false;
  }, (error) => {
    console.error("Error en listener de disponibles:", error);
    loading.value = false;
  });
};

const loadMoreItems = (ev?: any) => {
  const nextBatch = allBoletas.value.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  displayedBoletas.value = [...displayedBoletas.value, ...nextBatch];
  currentPage++;
  
  if (ev) ev.target.complete();
};

const doRefresh = (event: any) => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  iniciarListener();
  setTimeout(() => event.target.complete(), 1000);
};

onMounted(() => {
  iniciarListener();
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
.summary-card {
  --background: var(--ion-card-background, #f9f9f9);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
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
</style>