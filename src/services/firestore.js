import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy 
} from 'firebase/firestore';
import { db, auth } from '../../firebase/config';

// Helper para obtener la referencia del usuario
const getUserRef = () => {
  const userId = auth.currentUser?.uid;
  if (!userId) throw new Error('Usuario no autenticado');
  return `users/${userId}`;
};

// Cuentas
export const accountsService = {
  // Obtener todas las cuentas
  getAccounts: async () => {
    const accountsRef = collection(db, getUserRef(), 'accounts');
    const snapshot = await getDocs(accountsRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // Crear nueva cuenta
  createAccount: async (accountData) => {
    const accountsRef = collection(db, getUserRef(), 'accounts');
    const docRef = await addDoc(accountsRef, accountData);
    return { id: docRef.id, ...accountData };
  },

  // Actualizar cuenta
  updateAccount: async (accountId, updates) => {
    const accountRef = doc(db, getUserRef(), 'accounts', accountId);
    await updateDoc(accountRef, updates);
  },

  // Eliminar cuenta
  deleteAccount: async (accountId) => {
    const accountRef = doc(db, getUserRef(), 'accounts', accountId);
    await deleteDoc(accountRef);
  }
};

// Transacciones
export const transactionsService = {
  // Obtener todas las transacciones
  getTransactions: async () => {
    const transactionsRef = collection(db, getUserRef(), 'transactions');
    const q = query(transactionsRef, orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  },

  // Crear nueva transacción
  createTransaction: async (transactionData) => {
    const transactionsRef = collection(db, getUserRef(), 'transactions');
    const docRef = await addDoc(transactionsRef, {
      ...transactionData,
      fechaCreacion: new Date().toISOString()
    });
    return { id: docRef.id, ...transactionData };
  },

  // Eliminar transacción
  deleteTransaction: async (transactionId) => {
    const transactionRef = doc(db, getUserRef(), 'transactions', transactionId);
    await deleteDoc(transactionRef);
  },

  // Obtener transacciones por mes
  getTransactionsByMonth: async (year, month) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const transactionsRef = collection(db, getUserRef(), 'transactions');
    const q = query(
      transactionsRef,
      where('fecha', '>=', startDate.toISOString().split('T')[0]),
      where('fecha', '<=', endDate.toISOString().split('T')[0])
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};

// Ahorros
export const savingsService = {
  // Obtener ahorros
  getSavings: async () => {
    const savingsRef = doc(db, getUserRef(), 'data', 'savings');
    try {
      const docSnap = await getDoc(savingsRef);
      if (docSnap.exists()) {
        return docSnap.data();
      } else {
        // Crear estructura inicial si no existe
        const initialSavings = { pesos: 0, usd: 0, history: [] };
        await setDoc(savingsRef, initialSavings);
        return initialSavings;
      }
    } catch (error) {
      console.error('Error obteniendo ahorros:', error);
      throw error;
    }
  },

  // Actualizar ahorros
  updateSavings: async (savingsData) => {
    const savingsRef = doc(db, getUserRef(), 'data', 'savings');
    await setDoc(savingsRef, savingsData, { merge: true });
  }
};