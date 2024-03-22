// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { connectStorageEmulator, getStorage } from 'firebase/storage';
import {
  connectFirestoreEmulator,
  disableNetwork,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyDDiF-Ve21ysj23BrIoa_UsX1Snr-Fnpm0',
  authDomain: 'ashishdrugagencies-e5b9a.firebaseapp.com',
  projectId: 'ashishdrugagencies-e5b9a',
  storageBucket: 'ashishdrugagencies-e5b9a.appspot.com',
  messagingSenderId: '556283905126',
  appId: '1:556283905126:web:debbcb12a46054643c99a7',
  measurementId: 'G-HBT9DENS7T',
};

// Initialize Firebase

const firebaseApp = initializeApp(firebaseConfig);

initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache(/* settings */ {}),
});

export default firebaseApp;

export const firebaseDB = getFirestore(firebaseApp);
connectFirestoreEmulator(firebaseDB, '127.0.0.1', '8080');

const analytics = getAnalytics(firebaseApp);

export const firebaseStorage = getStorage(firebaseApp);
connectStorageEmulator(firebaseDB, '127.0.0.1', '9199');

export const firebaseAuth = getAuth(firebaseApp);
