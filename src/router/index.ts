import { createRouter, createWebHistory } from '@ionic/vue-router';
import TabsPage from '@/views/TabsPage.vue';


const routes = [
  {
    path: '/',
    redirect: '/tabs/carga' // Redirigir raíz a Carga
  },
  {
    path: '/tabs',
    component: TabsPage,
    children: [
      {
        path: '',
        redirect: '/tabs/carga'
      },
      {
        path: 'carga',
        // Carga perezosa (Lazy loading) para mejor rendimiento
        component: () => import('../views/TabCarga.vue')
      },
      {
        path: 'buscador',
        component: () => import('../views/TabBuscador.vue')
      },
      {
        path: 'asignaciones',
        component: () => import('../views/TabAsignaciones.vue')
      },
      {
        path: 'disponibles',
        component: () => import('../views/TabDisponibles.vue')
      },
      {
        path: 'socios',
        component: () => import('../views/TabSocios.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
