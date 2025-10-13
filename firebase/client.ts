// Import the functions you need from the SDKs you need
import { initializeApp,getApp,getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC0hjzXrGEg43Gh8rl3-7weSzTU2O1ffgU",
  authDomain: "mini-project-s5.firebaseapp.com",
  projectId: "mini-project-s5",
  storageBucket: "mini-project-s5.firebasestorage.app",
  messagingSenderId: "900351346303",
  appId: "1:900351346303:web:ac68b8449413f4d990a14a",
  measurementId: "G-BKFZE39LS9"
};

// Initialize Firebase
const app = !getApps.length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
