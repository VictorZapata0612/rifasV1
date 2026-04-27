import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

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

async function inspect() {
  const snap = await getDocs(collection(db, 'vendedores'));
  console.log('Vendedores encontrados:', snap.size);
  snap.docs.slice(0, 20).forEach(d => {
    console.log(d.id, JSON.stringify(d.data()));
  });
}

inspect().catch(e => { console.error(e); process.exit(1); });
