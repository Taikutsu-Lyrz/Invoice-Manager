// Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCYsmK039CK9jlPpUMHgNzk6dbAhXg21NE",
    authDomain: "invoice-af739.firebaseapp.com",
    projectId: "invoice-af739",
    storageBucket: "invoice-af739.firebasestorage.app",
    messagingSenderId: "223006932958",
    appId: "1:223006932958:web:cf5b2479525b0dc64e674f"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Auth with settings optimized for Electron
export const auth = getAuth(app);

// Set persistence to local storage for Electron environment
// This helps with the file:// protocol issues
setPersistence(auth, browserLocalPersistence).catch((error) => {
    console.warn('Failed to set auth persistence:', error);
});

// Initialize Firestore
export const db = getFirestore(app);

// Enable offline persistence for Firestore (helps with network issues)
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        // Multiple tabs open, persistence can only be enabled in one tab at a time
        console.warn('Firestore persistence failed: multiple tabs open');
    } else if (err.code === 'unimplemented') {
        // The current browser does not support persistence
        console.warn('Firestore persistence not supported');
    }
});

export default app;
