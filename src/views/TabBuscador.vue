<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Buscador Global</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      
      <div class="ion-padding-start ion-padding-end ion-padding-top">
        <ion-searchbar 
          v-model="searchQuery" 
          animated 
          placeholder="Boleta (0000), Rango (0-50) o Nombre..." 
          @ionChange="handleSearch"
          @ionClear="limpiar"
          :debounce="600"
          show-clear-button="always"
        ></ion-searchbar>
      </div>

      <!-- Filtros (Solo si no es búsqueda numérica) -->
      <div class="ion-padding-horizontal ion-margin-bottom" v-if="!isNumericSearch">
        <ion-segment v-model="filtroTipo" @ionChange="handleSearch" scrollable>
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
            <ion-icon :icon="person" slot="start" color="light"></ion-icon>
            <ion-label>
              <h2><ion-skeleton-text animated style="width: 50%"></ion-skeleton-text></h2>
              <p><ion-skeleton-text animated style="width: 30%"></ion-skeleton-text></p>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>

      <!-- Resultados -->
      <div v-else class="ion-padding-bottom">
        
        <!-- 1. Resultado Boleta Única -->
        <div v-if="resultadoBoleta" class="ion-padding-horizontal ion-margin-bottom">
          <ion-card class="ion-no-margin">
            <ion-card-header>
              <ion-card-title class="ion-text-center">Boleta #{{ resultadoBoleta.numero }}</ion-card-title>
              <ion-card-subtitle class="ion-text-center">{{ resultadoBoleta.vendedorNombre }}</ion-card-subtitle>
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
                  <ion-label>Estado</ion-label>
                  <ion-badge slot="end" :color="resultadoBoleta.estado === 'asignada' ? 'warning' : 'success'">
                    {{ resultadoBoleta.estado ? resultadoBoleta.estado.toUpperCase() : 'SIN ESTADO' }}
                  </ion-badge>
                </ion-item>
              </ion-list>
              <div class="ion-text-center ion-margin-top">
                 <ion-button fill="outline" @click="abrirModalBoleta(resultadoBoleta)">Ver Detalles</ion-button>
              </div>
            </ion-card-content>
          </ion-card>
        </div>

        <!-- 2. Resultados Rango -->
        <div v-if="resultadosRango.length > 0">
          <ion-list-header>
            <ion-label>Rango: {{ rangeLabel }} ({{ resultadosRango.length }})</ion-label>
          </ion-list-header>
          <ion-list>
            <ion-item v-for="boleta in resultadosRango" :key="boleta.id" button @click="abrirModalBoleta(boleta)">
              <ion-icon :icon="ticketOutline" slot="start" color="tertiary"></ion-icon>
              <ion-label>
                <h2>#{{ boleta.numero }} - {{ boleta.vendedorNombre }}</h2>
                <p>{{ boleta.socioId ? 'Socio: ' + boleta.socioId : 'Sin Socio' }}</p>
              </ion-label>
              <ion-badge slot="end" :color="boleta.estado === 'asignada' ? 'warning' : 'success'">
                {{ boleta.estado }}
              </ion-badge>
            </ion-item>
          </ion-list>
        </div>

        <!-- 3. Resultados Personas -->
        <ion-list v-if="resultadosPersonas.length > 0">
          <ion-list-header>
            <ion-label>Personas Encontradas</ion-label>
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

        <!-- Empty State -->
        <div v-if="busquedaRealizada && !resultadoBoleta && resultadosRango.length === 0 && resultadosPersonas.length === 0" class="ion-text-center ion-padding ion-text-muted">
          <p>No se encontraron resultados.</p>
        </div>

      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonSearchbar, IonSegment, IonSegmentButton, IonLabel, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonList, IonItem, IonIcon, IonBadge, IonButton, IonListHeader, modalController, IonSkeletonText } from '@ionic/vue';
import { person, ticketOutline, business } from 'ionicons/icons';
import { db } from '../firebase/config';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import ModalAdminBoleta from '../components/ModalAdminBoleta.vue';
import ModalAdminSocio from '../components/ModalAdminSocio.vue';
import ModalAdminVendedor from '../components/ModalAdminVendedor.vue';

const searchQuery = ref('');
const filtroTipo = ref('todos');
const loading = ref(false);
const busquedaRealizada = ref(false);
const isNumericSearch = ref(false);

// Resultados
const resultadoBoleta = ref<any>(null);
const resultadosRango = ref<any[]>([]);
const resultadosPersonas = ref<any[]>([]);
const rangeLabel = ref('');

const limpiar = () => {
  searchQuery.value = '';
  resultadoBoleta.value = null;
  resultadosRango.value = [];
  resultadosPersonas.value = [];
  busquedaRealizada.value = false;
  isNumericSearch.value = false;
};

const handleSearch = async (event: any) => {
  const val = event.detail ? event.detail.value : searchQuery.value;
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
      // 3. Búsqueda de Texto (Personas)
      isNumericSearch.value = false;
      const term = val.toLowerCase();
      const promises = [];

      if (filtroTipo.value === 'todos' || filtroTipo.value === 'vendedores') {
        promises.push(getDocs(collection(db, 'vendedores')).then(snap => 
          snap.docs.map(d => ({ id: d.id, ...d.data(), tipo: 'Vendedor' }))
        ));
      }
      if (filtroTipo.value === 'todos' || filtroTipo.value === 'socios') {
        promises.push(getDocs(collection(db, 'socios')).then(snap => 
          snap.docs.map(d => ({ id: d.id, ...d.data(), tipo: 'Socio' }))
        ));
      }

      const results = await Promise.all(promises);
      const flatResults = results.flat();
      
      resultadosPersonas.value = flatResults.filter((p: any) => 
        p.nombre && p.nombre.toLowerCase().includes(term)
      );
    }

  } catch (error) {
    console.error("Error en búsqueda:", error);
  } finally {
    loading.value = false;
    busquedaRealizada.value = true;
  }
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