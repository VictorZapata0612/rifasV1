import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, writeBatch, serverTimestamp, setDoc } from 'firebase/firestore';

// Usa la misma configuración que la app
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

const TOTAL_BOLETAS = 10000;

async function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function migrate() {
  console.log('Consultando boletas disponibles (estado=="disponible")...');
  const disponiblesQ = query(collection(db, 'boletas'), where('estado', '==', 'disponible'));
  const disponiblesSnap = await getDocs(disponiblesQ);
  const disponibles = disponiblesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  console.log(`Encontradas ${disponibles.length} boletas con estado 'disponible'.`);

  if (disponibles.length === 0) {
    console.log('No hay boletas a poblar. Revisar si los datos existen en la colección `boletas`.');
    return;
  }

  // Escribir en boletas_disponibles por lotes (max ~400 por batch)
  const chunks = await chunkArray(disponibles, 400);
  let totalWritten = 0;

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    for (const b of chunk) {
      const ref = doc(db, 'boletas_disponibles', b.id);
      batch.set(ref, { numero: b.id, updatedAt: serverTimestamp() }, { merge: true });
    }
    await batch.commit();
    totalWritten += chunk.length;
    console.log(`Commit realizado: +${chunk.length} boletas (total ${totalWritten})`);
  }

  // Actualizar stats/inventario
  const totalDisponibles = disponibles.length;
  const totalAsignadas = Math.max(0, TOTAL_BOLETAS - totalDisponibles);
  const statsRef = doc(db, 'stats', 'inventario');
  await setDoc(statsRef, {
    total: TOTAL_BOLETAS,
    totalAsignadas,
    totalDisponibles,
    updatedAt: serverTimestamp()
  }, { merge: true });

  console.log('Stats/inventario actualizado. Migración completada.');
}

migrate().catch(err => {
  console.error('Error en migración:', err);
  process.exit(1);
});
