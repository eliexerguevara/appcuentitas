import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyCqO6KTq37JECJlD4lLqNMTqRbWAhKES9A",
    authDomain: "cuentitas-b57b4.firebaseapp.com",
    projectId: "cuentitas-b57b4",
    storageBucket: "cuentitas-b57b4.firebasestorage.app",
    messagingSenderId: "30070913023",
    appId: "1:30070913023:web:a3f3119fd8da87573119ca",
    measurementId: "G-B3LHNPK5HP"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();