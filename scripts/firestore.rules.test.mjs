import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'rifas-app-f6a2d';

const rules = readFileSync('firestore.rules', 'utf8');
const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: { rules },
});

try {
  const anonDb = testEnv.unauthenticatedContext().firestore();

  await assertSucceeds(
    setDoc(doc(anonDb, 'socios', 'socio_demo'), {
      nombre: 'Socio Demo',
      nombre_normalizado: 'socio demo',
      boletasAsignadas: 0,
    })
  );

  await assertSucceeds(getDoc(doc(anonDb, 'socios', 'socio_demo')));

  await assertFails(
    setDoc(doc(anonDb, 'boletas', 'abc1'), {
      numero: 'abc1',
      estado: 'disponible',
      vendedorId: null,
      vendedorNombre: null,
      socioId: null,
      fechaAsignacion: null,
      fechaModificacion: null,
    })
  );

  console.log('Rules test passed.');
} finally {
  await testEnv.cleanup();
}
