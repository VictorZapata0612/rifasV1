import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, writeBatch } from 'firebase/firestore';

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

async function updateCounters() {
  console.log('Leyendo boletas asignadas...');
  const assignedQ = query(collection(db, 'boletas'), where('estado', '==', 'asignada'));
  const assignedSnap = await getDocs(assignedQ);

  const counts = new Map();
  assignedSnap.forEach(d => {
    const data = d.data();
    const vid = data.vendedorId || null;
    if (!vid) return;
    counts.set(vid, (counts.get(vid) || 0) + 1);
  });

  console.log(`Vendedores con asignaciones descubiertos: ${counts.size}`);

  // Leer todos los vendedores y actualizar su contador (0 si no aparece)
  const vendedoresSnap = await getDocs(collection(db, 'vendedores'));
  const batch = writeBatch(db);
  vendedoresSnap.forEach(d => {
    const id = d.id;
    const cnt = counts.get(id) || 0;
    const ref = doc(db, 'vendedores', id);
    batch.set(ref, { boletasAsignadas: cnt }, { merge: true });
  });

  await batch.commit();
  console.log('Contadores de vendedores actualizados.');
}

updateCounters().catch(err => { console.error(err); process.exit(1); });
