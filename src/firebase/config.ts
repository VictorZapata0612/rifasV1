
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
 
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

export { db };
