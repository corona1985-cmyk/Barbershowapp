import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDDHc3BVRBU8CE2SRPhIzqK0aLQ_gcgAhA",
  authDomain: "gen-lang-client-0624135070.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0624135070-default-rtdb.firebaseio.com",
  projectId: "gen-lang-client-0624135070",
  storageBucket: "gen-lang-client-0624135070.firebasestorage.app",
  messagingSenderId: "826588844097",
  appId: "1:826588844097:web:4e5db3f03d7bb52ec7b6c0",
  measurementId: "G-1QKXNNZCWM"
};

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(app);
