
// Fix: Import from compat versions to resolve "no exported member" errors in this environment
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyBOaK24QB_1QDThUe15Bap5TPx0g7dO--c",
  authDomain: "study-tracker-app-2d475.firebaseapp.com",
  projectId: "study-tracker-app-2d475",
  storageBucket: "study-tracker-app-2d475.firebasestorage.app",
  messagingSenderId: "548349119732",
  appId: "1:548349119732:web:2cff7d7766e4a5b57262a1"
};

// Initialize Firebase using compat API
const app = firebase.initializeApp(firebaseConfig);
// Export compat auth instance
export const auth = firebase.auth();
// Modular Firestore can still be initialized with a compat app instance
export const db = getFirestore(app as any);
