<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Buscador Inteligente</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <div class="search-hero ion-padding-horizontal ion-padding-top">
        <h2>Encuentra en segundos</h2>
        <p>Boletas por número o rango, y personas por nombre.</p>
      </div>
      
      <div class="ion-padding-start ion-padding-end ion-padding-top">
        <ion-searchbar 
          v-model="searchQuery" 
          animated 
          placeholder="Ejemplo: 0042, 0100-0200, Martha" 
          @ionChange="handleSearch"
          @ionClear="limpiar"
          :debounce="600"
          show-clear-button="always"
        ></ion-searchbar>
      </div>

      <div class="ion-padding-horizontal ion-margin-bottom" v-if="!isNumericSearch">
        <ion-segment v-model="filtroTipo" @ionChange="onSegmentChange" scrollable class="search-segment">
          <ion-segment-button value="todos">
            <ion-label>Todos</ion-label>
          </ion-segment-button>
          <ion-segment-button value="vendedores">
            <ion-label>Vendedores</ion-label>
          </ion-segment-button>
          <ion-segment-button value="socios">
            <ion-label>Socios</ion-label>
          </ion-segment-button>
        </ion-segment>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="ion-text-center ion-padding">
        <ion-list>
          <ion-item v-for="n in 3" :key="n">
            <ion-icon :icon="person" slot="start" color="medium"></ion-icon>
            <ion-label>
              <h2><ion-skeleton-text animated style="width: 50%"></ion-skeleton-text></h2>
              <p><ion-skeleton-text animated style="width: 30%"></ion-skeleton-text></p>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>

      <!-- Resultados -->
      <div v-else class="ion-padding-bottom">
        
        <div v-if="resultadoBoleta" class="ion-padding-horizontal ion-margin-bottom">
          <ion-card class="ion-no-margin result-card">
            <ion-card-header>
              <ion-card-title class="ion-text-center">Boleta #{{ resultadoBoleta.numero }}</ion-card-title>
              <ion-card-subtitle class="ion-text-center">{{ resultadoBoleta.vendedorNombre || 'Sin vendedor asignado' }}</ion-card-subtitle>
            </ion-card-header>
            <ion-card-content>
              <ion-list lines="none">
                <ion-item>
                  <ion-icon :icon="person" slot="start" color="medium"></ion-icon>
                  <ion-label>
                    <h3>Socio</h3>
                    <p>{{ resultadoBoleta.socioNombre || resultadoBoleta.socioId || 'No registrado' }}</p>
                  </ion-label>
                </ion-item>
                <ion-item>
                  <ion-label>Estado actual</ion-label>
                  <ion-badge slot="end" :color="resultadoBoleta.estado === 'asignada' ? 'warning' : 'success'">
                    {{ resultadoBoleta.estado ? resultadoBoleta.estado.toUpperCase() : 'SIN ESTADO' }}
                  </ion-badge>
                </ion-item>
              </ion-list>
              <div class="ion-text-center ion-margin-top">
                 <ion-button fill="outline" @click="abrirModalBoleta(resultadoBoleta)">Abrir detalle</ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        </div>

        <div v-if="resultadosRango.length > 0">
          <ion-list-header>
            <ion-label>Rango {{ rangeLabel }} · {{ resultadosRango.length }} resultados</ion-label>
          </ion-list-header>
          <ion-list>
            <ion-item v-for="boleta in resultadosRango" :key="boleta.id" button @click="abrirModalBoleta(boleta)">
              <ion-icon :icon="ticketOutline" slot="start" color="tertiary"></ion-icon>
              <ion-label>
                <h2>#{{ boleta.numero }} · {{ boleta.vendedorNombre || 'Sin vendedor' }}</h2>
                <p>{{ boleta.socioId ? 'Socio: ' + boleta.socioId : 'Sin socio asociado' }}</p>
              </ion-label>
              <ion-badge slot="end" :color="boleta.estado === 'asignada' ? 'warning' : 'success'">
                {{ boleta.estado }}
              </ion-badge>
            </ion-item>
          </ion-list>
        </div>

        <ion-list v-if="resultadosPersonas.length > 0">
          <ion-list-header>
            <ion-label>Personas encontradas</ion-label>
          </ion-list-header>
          <ion-item v-for="p in resultadosPersonas" :key="p.id" button detail @click="abrirModalPersona(p)">
            <ion-icon :icon="p.tipo === 'Vendedor' ? person : business" slot="start"></ion-icon>
            <ion-label>
              <h2>{{ p.nombre }}</h2>
              <p>{{ p.tipo }} <span v-if="p.socio">- Socio: {{ p.socio }}</span></p>
            </ion-label>
            <ion-badge slot="end" color="primary" v-if="p.boletasAsignadas !== undefined">{{ p.boletasAsignadas }}</ion-badge>
          </ion-item>
        </ion-list>

        <div v-if="shortQuery && !isNumericSearch" class="ion-padding-horizontal ion-padding-top">
          <ion-note color="medium">Escribe al menos 2 letras para buscar personas por nombre.</ion-note>
        </div>

        <div v-if="busquedaRealizada && !shortQuery && !resultadoBoleta && resultadosRango.length === 0 && resultadosPersonas.length === 0" class="ion-text-center ion-padding ion-text-muted empty-state">
          <h3>Sin coincidencias</h3>
          <p>Prueba con otro número, rango o nombre.</p>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonIcon, IonBadge, IonButton, IonListHeader, modalController, IonSkeletonText, IonNote } from '@ionic/vue';
import { person, ticketOutline, business } from 'ionicons/icons';
import { db } from '../firebase/config';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import ModalAdminBoleta from '../components/ModalAdminBoleta.vue';
import ModalAdminSocio from '../components/ModalAdminSocio.vue';
import ModalAdminVendedor from '../components/ModalAdminVendedor.vue';
import { normalizeText } from '../utils/text';

const searchQuery = ref('');
const filtroTipo = ref('todos');
const loading = ref(false);
const busquedaRealizada = ref(false);
const isNumericSearch = ref(false);
const shortQuery = ref(false);

// Resultados
const resultadoBoleta = ref<any>(null);
const resultadosRango = ref<any[]>([]);
const resultadosPersonas = ref<any[]>([]);
const rangeLabel = ref('');
const MAX_TEXT_RESULTS = 50;

const limpiar = () => {
  searchQuery.value = '';
  resultadoBoleta.value = null;
  resultadosRango.value = [];
  resultadosPersonas.value = [];
  busquedaRealizada.value = false;
  isNumericSearch.value = false;
  shortQuery.value = false;
};

const buildPrefixUpperBound = (term: string) => `${term}\uf8ff`;

const handleSearch = async () => {
  const val = (searchQuery.value || '').trim();
  if (!val) return limpiar();

  loading.value = true;
  busquedaRealizada.value = false;
  
  // Resetear resultados
  resultadoBoleta.value = null;
  resultadosRango.value = [];
  resultadosPersonas.value = [];

  try {
    // 1. Detectar si es Rango (ej. 0-100, 0000-0100)
    const rangeMatch = val.match(/^(\d{1,4})[-](\d{1,4})$/);
    
    // 2. Detectar si es Boleta Única (4 dígitos exactos)
    const isBoleta = /^\d{4}$/.test(val);

    if (rangeMatch) {
      isNumericSearch.value = true;
      shortQuery.value = false;
      const start = rangeMatch[1].padStart(4, '0');
      const end = rangeMatch[2].padStart(4, '0');
      rangeLabel.value = `${start} - ${end}`;

      const q = query(
        collection(db, 'boletas'), 
        where('numero', '>=', start), 
        where('numero', '<=', end), 
        orderBy('numero'), 
        limit(100)
      );
      const snap = await getDocs(q);
      resultadosRango.value = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    } else if (isBoleta) {
      isNumericSearch.value = true;
      shortQuery.value = false;
      const docRef = doc(db, 'boletas', val);
      const snap = await getDoc(docRef);
      
      if (snap.exists()) {
        const data = snap.data();
        let socioNombre = '';
        if (data.socioId && data.socioId !== 'Sin Socio') {
           const sSnap = await getDoc(doc(db, 'socios', data.socioId));
           if (sSnap.exists()) socioNombre = sSnap.data().nombre;
        }
        resultadoBoleta.value = { id: snap.id, ...data, socioNombre };
      }

    } else {
      isNumericSearch.value = false;
      const term = normalizeText(val);
      if (term.length < 2) {
        shortQuery.value = true;
        busquedaRealizada.value = true;
        return;
      }
      shortQuery.value = false;

      const promises = [];

      if (filtroTipo.value === 'todos' || filtroTipo.value === 'vendedores') {
        const vendedoresQ = query(
          collection(db, 'vendedores'),
          where('nombre_normalizado', '>=', term),
          where('nombre_normalizado', '<=', buildPrefixUpperBound(term)),
          orderBy('nombre_normalizado', 'asc'),
          limit(MAX_TEXT_RESULTS)
        );

        promises.push(
          getDocs(vendedoresQ).then(snap =>
            snap.docs.map(d => ({ id: d.id, ...d.data(), tipo: 'Vendedor' }))
          )
        );
      }

      if (filtroTipo.value === 'todos' || filtroTipo.value === 'socios') {
        const sociosQ = query(
          collection(db, 'socios'),
          where('nombre_normalizado', '>=', term),
          where('nombre_normalizado', '<=', buildPrefixUpperBound(term)),
          orderBy('nombre_normalizado', 'asc'),
          limit(MAX_TEXT_RESULTS)
        );

        promises.push(
          getDocs(sociosQ).then(snap =>
            snap.docs.map(d => ({ id: d.id, ...d.data(), tipo: 'Socio' }))
          )
        );
      }

      const results = await Promise.all(promises);
      resultadosPersonas.value = results.flat();
    }

  } catch (error) {
    console.error("Error en búsqueda:", error);
  } finally {
    loading.value = false;
    busquedaRealizada.value = true;
  }
};

const onSegmentChange = async () => {
  if (!searchQuery.value) return;
  await handleSearch();
};

const abrirModalBoleta = async (boleta: any) => {
  const modal = await modalController.create({
    component: ModalAdminBoleta,
    componentProps: { boleta },
    breakpoints: [0, 0.5, 0.8],
    initialBreakpoint: 0.5
  });
  await modal.present();
};

const abrirModalPersona = async (persona: any) => {
  const comp = persona.tipo === 'Socio' ? ModalAdminSocio : ModalAdminVendedor;
  const props = persona.tipo === 'Socio' ? { socio: persona } : { vendedor: persona };
  
  const modal = await modalController.create({
    component: comp as any,
    componentProps: props,
    breakpoints: [0, 0.6, 0.9, 1],
    initialBreakpoint: 0.9
  });
  await modal.present();
};
</script>

<style scoped>
.search-hero h2 {
  margin: 0;
  font-size: 1.1rem;
  font-family: 'Space Grotesk', 'Outfit', sans-serif;
}

.search-hero p {
  margin: 4px 0 0;
  color: var(--ion-color-medium);
  font-size: 0.86rem;
}

.search-segment {
  border-radius: 14px;
  padding: 4px;
  background: color-mix(in srgb, var(--ion-color-light) 65%, transparent);
}

.result-card {
  border: 1px solid color-mix(in srgb, var(--ion-color-primary) 18%, transparent);
}

.empty-state h3 {
  margin: 0;
  font-family: 'Space Grotesk', 'Outfit', sans-serif;
}

.empty-state p {
  margin-top: 6px;
  color: var(--ion-color-medium);
}
</style>