// src/services/household.js
// Hogar compartido: si el usuario pertenece a un hogar, las cuentas, transacciones
// y ahorros se leen/escriben en households/{id}; si no, en users/{uid} como siempre.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { auth, db } from '../../firebase/config';

let householdId = null;
let loadedFor = null;
let loading = null;

// Carga (una vez por usuario) a qué hogar pertenece el usuario actual.
export const ensureHousehold = async () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Usuario no autenticado');
  if (loadedFor === uid) return householdId;
  if (!loading) {
    loading = getDoc(doc(db, 'users', uid))
      .then(snap => {
        householdId = snap.exists() ? snap.data().householdId || null : null;
        loadedFor = uid;
        return householdId;
      })
      .finally(() => { loading = null; });
  }
  return loading;
};

export const currentHouseholdId = () => householdId;

const dataRoot = () => householdId
  ? ['households', householdId]
  : ['users', auth.currentUser.uid];

export const dataCol = (name) => collection(db, ...dataRoot(), name);
export const dataDoc = (...segments) => doc(db, ...dataRoot(), ...segments);

export const getHousehold = async () => {
  await ensureHousehold();
  if (!householdId) return null;
  const snap = await getDoc(doc(db, 'households', householdId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

const setUserHousehold = async (id) => {
  await setDoc(doc(db, 'users', auth.currentUser.uid), { householdId: id }, { merge: true });
  householdId = id;
  loadedFor = auth.currentUser.uid;
};

// Copia documentos en tandas (Firestore permite hasta 500 escrituras por lote).
const copyDocs = async (docs, targetCol) => {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach(d => batch.set(doc(db, ...targetCol, d.id), d.data()));
    await batch.commit();
  }
};

// Crea un hogar y copia los datos personales del usuario (se mantienen los IDs
// para que las transacciones sigan apuntando a sus cuentas).
export const createHousehold = async (nombre) => {
  const user = auth.currentUser;
  const ref = doc(collection(db, 'households'));
  await setDoc(ref, {
    nombre: nombre || 'Nuestro hogar',
    creadoPor: user.uid,
    miembros: [user.uid],
    miembrosEmail: [user.email || ''],
    invitacionAbierta: true,
    fechaCreacion: new Date().toISOString(),
  });

  const base = ['users', user.uid];
  const [accounts, transactions, savings] = await Promise.all([
    getDocs(collection(db, ...base, 'accounts')),
    getDocs(collection(db, ...base, 'transactions')),
    getDoc(doc(db, ...base, 'data', 'savings')),
  ]);
  await copyDocs(accounts.docs, ['households', ref.id, 'accounts']);
  await copyDocs(transactions.docs, ['households', ref.id, 'transactions']);
  if (savings.exists()) {
    await setDoc(doc(db, 'households', ref.id, 'data', 'savings'), savings.data());
  }

  await setUserHousehold(ref.id);
  return ref.id;
};

export const joinHousehold = async (codigo) => {
  const user = auth.currentUser;
  const id = codigo.trim();
  await updateDoc(doc(db, 'households', id), {
    miembros: arrayUnion(user.uid),
    miembrosEmail: arrayUnion(user.email || ''),
  });
  await setUserHousehold(id);
};

export const setInvitacionAbierta = async (abierta) => {
  await updateDoc(doc(db, 'households', householdId), { invitacionAbierta: abierta });
};

// Sale del hogar: vuelve a ver sus datos personales (los que tenía antes de unirse).
export const leaveHousehold = async () => {
  const user = auth.currentUser;
  await updateDoc(doc(db, 'households', householdId), {
    miembros: arrayRemove(user.uid),
    miembrosEmail: arrayRemove(user.email || ''),
  });
  await setUserHousehold(null);
};
