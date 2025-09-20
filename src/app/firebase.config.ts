// firebase.config.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
export const firebaseConfig = {
  apiKey: "AIzaSyDltRv3FP_4S1p4dKalTOZS1wMdnJk1-PQ",
  authDomain: "chatting-app-c7671.firebaseapp.com",
  projectId: "chatting-app-c7671",
  storageBucket: "chatting-app-c7671.firebasestorage.app",
  messagingSenderId: "358009246340",
  appId: "1:358009246340:web:3a81d0215e28491307e8d1",
  measurementId: "G-WKQQXSZ7QX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;