import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, writeBatch, serverTimestamp, setDoc } from 'firebase/firestore';

// Configuración idéntica a la app
const firebaseConfig = {
  apiKey: "AIzaSyB4Zfj9meE9I_nFCEtTVFSx8Flkqq4EgRY",
  authDomain: "rifas-app-f6a2d.firebaseapp.com",
  databaseURL: "https://rifas-app-f6a2d-default-rtdb.firebaseio.com",
  projectId: "rifas-app-f6a2d",
  storageBucket: "rifas-app-f6a2d.firebasestorage.app",
  messagingSenderId: "532237974422",
  appId: "1:532237974422:web:ffd1b4ac506b5a1342bbb7",
  measurementId: "G-NM4KF8G1T2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TOTAL = 10000;
const BATCH_SIZE = 400;

function pad(n) {
  return String(n).padStart(4, '0');
}

async function bootstrap() {
  console.log('Obteniendo boletas asignadas...');
  const assignedQ = query(collection(db, 'boletas'), where('estado', '==', 'asignada'));
  const assignedSnap = await getDocs(assignedQ);
  const assignedIds = new Set(assignedSnap.docs.map(d => d.id));
  console.log(`Boletas asignadas encontradas: ${assignedIds.size}`);

  // Preparar lista de números que deben estar en boletas_disponibles
  const toCreate = [];
  for (let i = 0; i < TOTAL; i++) {
    const id = pad(i);
    if (!assignedIds.has(id)) toCreate.push(id);
  }

  console.log(`Boletas a crear en boletas_disponibles: ${toCreate.length}`);

  // Escribir en batches
  let written = 0;
  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const slice = toCreate.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    for (const id of slice) {
      const ref = doc(db, 'boletas_disponibles', id);
      batch.set(ref, { numero: id, updatedAt: serverTimestamp() }, { merge: true });
    }
    await batch.commit();
    written += slice.length;
    console.log(`Commit: +${slice.length} (total escritos ${written}/${toCreate.length})`);
  }

  // Actualizar stats/inventario
  const statsRef = doc(db, 'stats', 'inventario');
  const totalDisponibles = toCreate.length;
  const totalAsignadas = Math.max(0, TOTAL - totalDisponibles);
  await setDoc(statsRef, {
    total: TOTAL,
    totalAsignadas,
    totalDisponibles,
    updatedAt: serverTimestamp()
  }, { merge: true });

  console.log('Bootstrap completado.');
}

bootstrap().catch(err => {
  console.error('Error en bootstrap:', err);
  process.exit(1);
});
