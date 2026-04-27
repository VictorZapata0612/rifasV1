<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-button v-if="level > 0" @click="goBack">
            <ion-icon slot="icon-only" :icon="arrowBack"></ion-icon>
          </ion-button>
        </ion-buttons>
        <ion-title>{{ tituloActual }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>
      
      <!-- Loading -->
      <div v-if="loading" class="ion-text-center ion-padding-top">
        <ion-list>
          <ion-item v-for="n in 10" :key="n">
            <ion-avatar slot="start"><ion-skeleton-text animated></ion-skeleton-text></ion-avatar>
            <ion-label>
              <h2><ion-skeleton-text animated style="width: 60%"></ion-skeleton-text></h2>
              <p><ion-skeleton-text animated style="width: 40%"></ion-skeleton-text></p>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>

      <div v-else>
        
        <!-- NIVEL 0: LISTA DE SOCIOS -->
        <ion-list v-if="level === 0">
          <ion-list-header>
            <ion-label>
              <h1 class="ion-no-margin">Total: {{ displayedTotal }}</h1>
              <p>Selecciona un Socio</p>
            </ion-label>
          </ion-list-header>
          <ion-item v-for="socio in socios" :key="socio.id" button detail @click="seleccionarSocio(socio)">
            <ion-avatar slot="start">
              <img src="https://ionicframework.com/docs/img/demos/avatar.svg" />
            </ion-avatar>
            <ion-label>
              <h2>{{ socio.nombre }}</h2>
              <p>Ver vendedores</p>
            </ion-label>
            <ion-badge slot="end" color="primary">{{ socio.boletasAsignadas || 0 }}</ion-badge>
          </ion-item>
        </ion-list>

        <!-- NIVEL 1: LISTA DE VENDEDORES (Con conteo) -->
        <ion-list v-if="level === 1">
          <ion-list-header>
            <ion-label>Vendedores de {{ selectedSocio?.nombre }}</ion-label>
          </ion-list-header>
          <div v-if="vendedores.length === 0" class="ion-padding ion-text-center">
            <ion-note>Este socio no tiene vendedores registrados.</ion-note>
          </div>
          <ion-item v-for="vendedor in vendedores" :key="vendedor.id" button detail @click="seleccionarVendedor(vendedor)">
            <ion-icon :icon="person" slot="start" color="secondary"></ion-icon>
            <ion-label>
              <h2>{{ vendedor.nombre }}</h2>
              <p>Boletas asignadas</p>
            </ion-label>
            <ion-badge slot="end" color="primary">{{ vendedor.boletasCount }}</ion-badge>
          </ion-item>
        </ion-list>

        <!-- NIVEL 2: LISTA DE BOLETAS -->
        <div v-if="level === 2">
          <ion-list-header>
            <ion-label>Boletas de {{ selectedVendedor?.nombre }}</ion-label>
          </ion-list-header>
          <div v-if="boletas.length === 0" class="ion-padding ion-text-center">
            <ion-note>No tiene boletas asignadas.</ion-note>
          </div>
          
          <ion-list v-else>
            <ion-item-group v-for="grupo in boletasAgrupadas" :key="grupo.digit">
              <ion-item-divider sticky color="light" @click="toggleGroup(grupo.digit)">
                <ion-label class="ion-text-uppercase font-bold">Serie {{ grupo.digit }}... ({{ grupo.count }})</ion-label>
                <ion-icon slot="end" :icon="collapsedGroups[grupo.digit] ? chevronForward : chevronDown"></ion-icon>
              </ion-item-divider>
              <div v-show="!collapsedGroups[grupo.digit]">
                <ion-item v-for="boleta in grupo.boletas" :key="boleta.id">
                  <ion-icon :icon="ticketOutline" slot="start" color="tertiary"></ion-icon>
                  <ion-label>
                    <h2>Boleta #{{ boleta.numero }}</h2>
                    <p>Estado: {{ boleta.estado }}</p>
                  </ion-label>
                  <ion-badge slot="end" :color="boleta.estado === 'asignada' ? 'warning' : 'success'">{{ boleta.estado }}</ion-badge>
                </ion-item>
              </div>
            </ion-item-group>
          </ion-list>
        </div>

        <!-- SCROLL INFINITO (Solo para Nivel 2) -->
        <ion-infinite-scroll v-if="level === 2" @ionInfinite="cargarMasBoletas" :disabled="allBoletasLoaded">
          <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Cargando más boletas...">
          </ion-infinite-scroll-content>
        </ion-infinite-scroll>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonAvatar, IonIcon, IonButtons, IonButton, IonListHeader, IonBadge, IonInfiniteScroll, IonInfiniteScrollContent, IonNote, IonRefresher, IonRefresherContent, IonSkeletonText, IonItemGroup, IonItemDivider } from '@ionic/vue';
import { arrowBack, person, ticketOutline, chevronDown, chevronForward } from 'ionicons/icons';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, where, orderBy, getCountFromServer, Unsubscribe, limit } from 'firebase/firestore';
import { appStore } from '../store/appStore';

// Estado
const level = ref(0); // 0: Socios, 1: Vendedores, 2: Boletas
const loading = ref(false);

const socios = ref<any[]>([]);
const vendedores = ref<any[]>([]);
const boletas = ref<any[]>([]);

const selectedSocio = ref<any>(null);
const selectedVendedor = ref<any>(null);

// Estado de colapso por grupo (serie)
const collapsedGroups = ref<Record<string, boolean>>({});
const toggleGroup = (digit: string) => {
  collapsedGroups.value[digit] = !collapsedGroups.value[digit];
};

// Paginación
const limitBoletas = ref(1000);
const allBoletasLoaded = ref(false);

// Suscripciones
let unsubscribeSocios: Unsubscribe | null = null;
let unsubscribeNivel: Unsubscribe | null = null; // Para vendedores o boletas
let unsubscribeBoletasSocio: Unsubscribe | null = null; // Para conteo en tiempo real (Nivel 1)

const tituloActual = computed(() => {
  if (level.value === 0) return 'Lista de Socios';
  if (level.value === 1) return 'Vendedores';
  if (level.value === 2) return 'Boletas Asignadas';
  return 'Asignaciones';
});

// Agrupación de boletas por primer dígito
const boletasAgrupadas = computed(() => {
  const grupos = [];
  for (let i = 0; i <= 9; i++) {
    const digit = i.toString();
    const filtered = boletas.value.filter(b => b.numero && b.numero.startsWith(digit));
    if (filtered.length > 0) {
      grupos.push({
        digit: digit,
        count: filtered.length,
        boletas: filtered
      });
    }
  }
  return grupos;
});

const totalGlobalAsignadas = computed(() => {
  return socios.value.reduce((acc, s) => acc + (s.boletasAsignadas || 0), 0);
});

const displayedTotal = ref(0);
let animationFrameId: number | null = null;

watch(totalGlobalAsignadas, (newVal) => {
  if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
  
  const start = displayedTotal.value;
  const end = newVal;
  const duration = 1000; // 1 segundo de animación
  const startTime = performance.now();

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // Efecto "Ease out cubic" para suavidad al final
    
    displayedTotal.value = Math.floor(start + (end - start) * ease);

    if (progress < 1) animationFrameId = requestAnimationFrame(animate);
    else displayedTotal.value = end;
  };
  animationFrameId = requestAnimationFrame(animate);
});

// Carga Inicial (Socios)
onMounted(async () => {
  // 1. Estrategia Cache-First: Si ya tenemos datos, no mostramos loading
  if (appStore.socios.length > 0) {
    socios.value = appStore.socios;
  } else {
    loading.value = true;
  }

  try {
    const q = query(collection(db, 'socios'), orderBy('nombre'));
    
    unsubscribeSocios = onSnapshot(q, async (snap: any) => {
      const listaSocios = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      
      // Calcular suma de boletas de sus vendedores (Dinámico para exactitud)
      const promises = listaSocios.map(async (s: any) => {
        const qCount = query(collection(db, 'boletas'), where('socioId', '==', s.id));
        const snapCount = await getCountFromServer(qCount);
        return { ...s, boletasAsignadas: snapCount.data().count };
      });

      socios.value = await Promise.all(promises);
      appStore.socios = socios.value; // Actualizar caché
      loading.value = false;
    });
  } catch (e) {
    console.error(e);
  }
});

onUnmounted(() => {
  if (unsubscribeSocios) unsubscribeSocios();
  if (unsubscribeNivel) unsubscribeNivel();
  if (unsubscribeBoletasSocio) unsubscribeBoletasSocio();
});

// Navegación
const seleccionarSocio = async (socio: any) => {
  selectedSocio.value = socio;
  
  if (unsubscribeNivel) unsubscribeNivel();
  if (unsubscribeBoletasSocio) { unsubscribeBoletasSocio(); unsubscribeBoletasSocio = null; }

  // Cache-First para Vendedores
  if (appStore.vendedoresCache[socio.id]) {
    vendedores.value = appStore.vendedoresCache[socio.id];
  } else {
    loading.value = true;
  }

  try {
    // 1. Traer vendedores del socio (Lista en tiempo real)
    const q = query(collection(db, 'vendedores'), where('id_socio', '==', socio.id), orderBy('nombre'));
    
    // 2. Traer boletas del socio (Conteo en tiempo real)
    const qBoletas = query(collection(db, 'boletas'), where('socioId', '==', socio.id));

    let localVendedores: any[] = [];
    let localBoletas: any[] = [];
    let isVendedoresLoaded = false;
    let isBoletasLoaded = false;

    const updateState = () => {
      if (!isVendedoresLoaded || !isBoletasLoaded) return;

      const counts: Record<string, number> = {};
      localBoletas.forEach(b => {
        if (b.vendedorId) counts[b.vendedorId] = (counts[b.vendedorId] || 0) + 1;
      });

      vendedores.value = localVendedores.map(v => ({ ...v, boletasCount: counts[v.id] || 0 }));
      appStore.vendedoresCache[socio.id] = vendedores.value; // Guardar en caché
      loading.value = false;
    };
    
    unsubscribeNivel = onSnapshot(q, (snap: any) => {
      localVendedores = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      // Ordenamiento Natural (Numeric Sort)
      localVendedores.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }));
      
      isVendedoresLoaded = true;
      updateState();
    });

    unsubscribeBoletasSocio = onSnapshot(qBoletas, (snap: any) => {
      localBoletas = snap.docs.map((d: any) => d.data());
      isBoletasLoaded = true;
      updateState();
    });

    level.value = 1;
  } catch (e) {
    console.error(e);
  }
};

// Lógica de suscripción a boletas con paginación
const suscribirBoletas = (isInitial: boolean, ev?: any) => {
  if (unsubscribeNivel) unsubscribeNivel();
  if (unsubscribeBoletasSocio) { unsubscribeBoletasSocio(); unsubscribeBoletasSocio = null; }

  const vendedorId = selectedVendedor.value.id;

  if (isInitial) {
    limitBoletas.value = 50;
    allBoletasLoaded.value = false;
    
    // Cache-First para Boletas (Solo carga inicial)
    if (appStore.boletasCache[vendedorId]) {
      boletas.value = appStore.boletasCache[vendedorId];
    } else {
      loading.value = true;
      boletas.value = [];
    }
  }

  // Consultamos con límite y ordenamiento por número
  const q = query(
    collection(db, 'boletas'), 
    where('vendedorId', '==', vendedorId),
    orderBy('numero', 'asc'),
    limit(limitBoletas.value)
  );
  
  unsubscribeNivel = onSnapshot(q, (snap: any) => {
    boletas.value = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    
    // Actualizamos caché solo si es la primera página para mantener consistencia rápida
    if (limitBoletas.value === 1000) {
      appStore.boletasCache[vendedorId] = boletas.value;
    }
    
    // Si recibimos menos docs que el límite, llegamos al final
    allBoletasLoaded.value = snap.docs.length < limitBoletas.value;
    
    loading.value = false;
    if (ev) ev.target.complete();
  });
};

const cargarMasBoletas = (ev: any) => {
  limitBoletas.value += 1000;
  suscribirBoletas(false, ev);
};

const seleccionarVendedor = async (vendedor: any) => {
  selectedVendedor.value = vendedor;
  
  if (unsubscribeNivel) unsubscribeNivel();

  try {
    suscribirBoletas(true);
    level.value = 2;
  } catch (e) {
    console.error(e);
    loading.value = false;
  }
};

const goBack = () => {
  if (level.value === 2) {
    level.value = 1;
    // Al volver al nivel 1, reactivamos los listeners de vendedores y conteos
    seleccionarSocio(selectedSocio.value);
  } else if (level.value === 1) {
    level.value = 0;
    if (unsubscribeNivel) { unsubscribeNivel(); unsubscribeNivel = null; }
    if (unsubscribeBoletasSocio) { unsubscribeBoletasSocio(); unsubscribeBoletasSocio = null; }
    selectedSocio.value = null;
  }
};

const doRefresh = (event: any) => {
  // Al ser tiempo real, los datos ya deberían estar actualizados.
  // Simulamos una recarga visual para feedback del usuario.
  setTimeout(() => event.target.complete(), 1000);
};
</script>