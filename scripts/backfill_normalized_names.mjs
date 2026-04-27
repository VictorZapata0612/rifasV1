import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, writeBatch } from 'firebase/firestore';

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

const normalizeText = (value) => {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

async function updateCollection(collectionName) {
  const snap = await getDocs(collection(db, collectionName));
  console.log(`${collectionName}: ${snap.size} documentos encontrados`);

  let changed = 0;
  let batch = writeBatch(db);
  let ops = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const normalized = normalizeText(data.nombre);
    if (!normalized) continue;

    if (data.nombre_normalizado !== normalized) {
      batch.set(doc(db, collectionName, d.id), { nombre_normalizado: normalized }, { merge: true });
      changed += 1;
      ops += 1;
    }

    if (ops >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
  }

  console.log(`${collectionName}: ${changed} documentos actualizados`);
}

async function run() {
  await updateCollection('socios');
  await updateCollection('vendedores');
  console.log('Backfill de nombre_normalizado completado.');
}

run().catch((err) => {
  console.error('Error en backfill:', err);
  process.exit(1);
});
