<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Gestión</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="segment === 'socios'" @click="exportarReporte" :disabled="loading">
            <ion-icon slot="icon-only" :icon="cloudDownloadOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar color="primary">
        <ion-segment v-model="segment" :scrollable="true" @ionChange="cambiarSegmento">
          <ion-segment-button value="socios">
            <ion-label>Socios</ion-label>
          </ion-segment-button>
          <ion-segment-button value="vendedores">
            <ion-label>Vendedores</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <ion-refresher slot="fixed" @ionRefresh="doRefresh">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Buscador -->
      <ion-searchbar v-model="searchQuery" :placeholder="placeholderBuscador" animated></ion-searchbar>

      <!-- SKELETON LOADING (Mejora UI) -->
      <div v-if="loading" class="ion-text-center ion-padding-top">
        <ion-list>
          <ion-item v-for="i in 6" :key="i">
            <ion-avatar slot="start">
              <ion-skeleton-text animated style="width: 100%"></ion-skeleton-text>
            </ion-avatar>
            <ion-label>
              <h2><ion-skeleton-text animated style="width: 50%"></ion-skeleton-text></h2>
              <p><ion-skeleton-text animated style="width: 30%"></ion-skeleton-text></p>
            </ion-label>
          </ion-item>
        </ion-list>
      </div>

      <!-- DASHBOARD / GRÁFICO (Solo visible en Socios y sin búsqueda activa) -->
      <div v-if="segment === 'socios' && !loading && !searchQuery && listaDatos.length > 0" class="ion-padding-horizontal ion-padding-bottom">
        <div class="chart-card">
          <h6 class="ion-text-uppercase ion-text-center text-muted ion-margin-bottom">Top 5 Rendimiento</h6>
          <div v-for="(socio, index) in topSocios" :key="socio.id" class="chart-row">
            <div class="chart-label text-truncate">{{ socio.nombre }}</div>
            <div class="chart-bar-track">
              <div class="chart-bar" :style="{ width: calcularPorcentaje(socio.boletasAsignadas) + '%', transitionDelay: index * 50 + 'ms' }"></div>
            </div>
            <div class="chart-value">{{ socio.boletasAsignadas || 0 }}</div>
          </div>
        </div>
      </div>

      <Transition name="fade" mode="out-in">
        <div v-if="!loading" :key="segment">
          <!-- LISTA DE SOCIOS -->
          <ion-list v-if="segment === 'socios'">
            <ion-item v-for="socio in listaFiltrada" :key="socio.id" button :detail="true" @click="abrirModal(socio)">
              <ion-avatar slot="start">
                <img :src="`https://ionicframework.com/docs/img/demos/avatar.svg`" />
              </ion-avatar>
              <ion-label>
                <h2>{{ socio.nombre }}</h2>
                <p>Boletas asignadas: {{ socio.boletasAsignadas || 0 }}</p>
              </ion-label>
            </ion-item>
          </ion-list>

          <!-- LISTA DE VENDEDORES -->
          <ion-list v-if="segment === 'vendedores'">
            <ion-item v-for="vendedor in listaFiltrada" :key="vendedor.id" button :detail="true" @click="abrirModal(vendedor)">
              <ion-icon :icon="person" slot="start" color="secondary"></ion-icon>
              <ion-label>
                <h2>{{ vendedor.nombre }}</h2>
                <p>Socio: {{ vendedor.nombreSocio }}</p>
              </ion-label>
            </ion-item>
          </ion-list>

        </div>
      </Transition>

      <!-- Botón Flotante para Agregar -->
      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="abrirModal(null)">
          <ion-icon :icon="add"></ion-icon>
        </ion-fab-button>
      </ion-fab>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonAvatar, modalController, toastController, IonIcon, IonSearchbar, IonSegment, IonSegmentButton, IonFab, IonFabButton, IonSkeletonText, IonButtons, IonButton, IonRefresher, IonRefresherContent } from '@ionic/vue';
import { add, person, cloudDownloadOutline } from 'ionicons/icons';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import ModalAdminSocio from '../components/ModalAdminSocio.vue';
import ModalAdminVendedor from '../components/ModalAdminVendedor.vue';
import { db } from '../firebase/config';
import { collection, onSnapshot, query, orderBy, Unsubscribe, getDocs } from 'firebase/firestore';

// --- Estado del componente (reactividad) ---
const segment = ref('socios');
const listaDatos = ref<any[]>([]);
const loading = ref(false);
const searchQuery = ref('');
let unsubscribe: Unsubscribe | null = null;

const placeholderBuscador = computed(() => {
  if (segment.value === 'socios') return 'Buscar socio...';
  return 'Buscar vendedor...';
});

const listaFiltrada = computed(() => {
  if (!searchQuery.value) return listaDatos.value;
  const q = searchQuery.value.toLowerCase();
  
  return listaDatos.value.filter(item => item.nombre && item.nombre.toLowerCase().includes(q));
});

// --- Lógica del Gráfico ---
const topSocios = computed(() => {
  // Copiamos y ordenamos por boletas asignadas descendente
  return [...listaDatos.value]
    .sort((a, b) => (b.boletasAsignadas || 0) - (a.boletasAsignadas || 0))
    .slice(0, 5); // Top 5
});

const maxBoletas = computed(() => {
  return topSocios.value.length > 0 ? (topSocios.value[0].boletasAsignadas || 1) : 1;
});

const calcularPorcentaje = (valor: number) => {
  if (!valor) return 0;
  return Math.round((valor / maxBoletas.value) * 100);
};

const cargarDatos = async () => {
  loading.value = true;
  listaDatos.value = [];
  
  // Limpiar suscripción anterior si existe
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  try {
    if (segment.value === 'socios') {
      const q = query(collection(db, "socios"), orderBy("nombre", "asc"));
      unsubscribe = onSnapshot(q, async (snap) => {
        const sociosData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        listaDatos.value = sociosData;
        loading.value = false;
      });
    } else if (segment.value === 'vendedores') {
      const q = query(collection(db, "vendedores"), orderBy("nombre", "asc"));
      unsubscribe = onSnapshot(q, async (snap) => {
        const vendedoresData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        vendedoresData.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true, sensitivity: 'base' }));
        
        // Obtener mapa de socios para mostrar nombres
        const sociosSnap = await getDocs(collection(db, 'socios'));
        const sociosMap = new Map();
        sociosSnap.forEach(doc => sociosMap.set(doc.id, doc.data().nombre));

        listaDatos.value = vendedoresData.map((v: any) => ({
          ...v,
          nombreSocio: sociosMap.get(v.id_socio) || 'Sin Socio'
        }));
        loading.value = false;
      });
    }
  } catch (error) {
    console.error("Error cargando datos: ", error);
    mostrarToast('Error al cargar datos.', 'danger');
  }
};

const cambiarSegmento = () => {
  searchQuery.value = '';
  cargarDatos();
};

const doRefresh = (event: any) => {
  cargarDatos();
  setTimeout(() => event.target.complete(), 800);
};

onMounted(cargarDatos);

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});

const abrirModal = async (item: any) => {
  let componente: any = null;
  let props = {};

  if (segment.value === 'socios') {
    componente = ModalAdminSocio;
    props = { socio: item };
  } else if (segment.value === 'vendedores') {
    componente = ModalAdminVendedor;
    props = { vendedor: item };
  }

  if (!componente) {
    // No component selected, nothing to open
    return;
  }

  const modal = await modalController.create({
    component: componente as any,
    componentProps: props,
    breakpoints: [0, 0.5, 0.8, 1],
    initialBreakpoint: 0.8
  });
  
  modal.onDidDismiss().then((result) => {
    if (result.data && result.data.role === 'reload') {
      cargarDatos();
      mostrarToast('Operación exitosa', 'success');
    }
  });

  await modal.present();
};

const exportarReporte = async () => {
  if (listaDatos.value.length === 0) return mostrarToast('No hay datos para exportar', 'danger');
  await Haptics.impact({ style: ImpactStyle.Medium });

  loading.value = true;
  try {
    // 1. Generar contenido CSV (Compatible con Excel)
    // BOM para que Excel reconozca caracteres latinos (tildes, ñ)
    const bom = '\uFEFF'; 
    const headers = 'Nombre del Socio,Boletas Asignadas,ID Sistema\n';
    const rows = listaDatos.value.map(s => 
      `"${s.nombre}",${s.boletasAsignadas || 0},"${s.id}"`
    ).join('\n');
    
    const csvContent = bom + headers + rows;

    // 2. Guardar archivo temporalmente en el dispositivo
    const fileName = `reporte_socios_${new Date().getTime()}.csv`;
    const result = await Filesystem.writeFile({
      path: fileName,
      data: csvContent,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    });

    // 3. Abrir diálogo nativo de compartir
    await Share.share({
      title: 'Reporte de Socios',
      text: 'Adjunto reporte de rendimiento de socios.',
      url: result.uri,
      dialogTitle: 'Exportar a Excel'
    });

    await Haptics.notification({ type: NotificationType.Success });
  } catch (error) {
    console.error('Error exportando:', error);
    mostrarToast('Error al exportar archivo.', 'danger');
  } finally {
    loading.value = false;
  }
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
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Estilos del Gráfico */
.chart-card {
  background: var(--ion-card-background, #fff);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  margin-top: 10px;
}

.chart-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  font-size: 0.9rem;
}

.chart-label {
  width: 80px;
  font-weight: 500;
  color: var(--ion-text-color);
}

.chart-bar-track {
  flex: 1;
  height: 8px;
  background: var(--ion-color-step-100, #f2f2f2);
  border-radius: 4px;
  margin: 0 10px;
  overflow: hidden;
}

.chart-bar {
  height: 100%;
  background: var(--ion-color-primary);
  border-radius: 4px;
  transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
}

.chart-value {
  width: 30px;
  text-align: right;
  font-weight: bold;
  color: var(--ion-color-medium);
  font-size: 0.8rem;
}

.text-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.text-muted {
  color: var(--ion-color-medium);
  font-size: 0.8rem;
  letter-spacing: 1px;
}
</style>
