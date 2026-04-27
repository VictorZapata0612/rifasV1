import { reactive } from 'vue';

interface AppStore {
  socios: any[];
  vendedoresCache: Record<string, any[]>; // Cache por ID de socio
  boletasCache: Record<string, any[]>;    // Cache por ID de vendedor
}

export const appStore = reactive<AppStore>({
  socios: [],
  vendedoresCache: {},
  boletasCache: {}
});