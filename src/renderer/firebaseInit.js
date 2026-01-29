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
import { getAuth, connectAuthEmulator } from 'firebase/auth';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Set to true to use Firebase Emulators
const USE_EMULATOR = true;

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
  ignoreUndefinedProperties: true,
});

export default firebaseApp;

export const firebaseDB = getFirestore(firebaseApp);
// export const firebaseDBLastYear = getFirestore(firebaseApp, 'fy23-24');

// const analytics = getAnalytics(firebaseApp);

export const firebaseStorage = getStorage(firebaseApp);

export const firebaseAuth = getAuth(firebaseApp);

// Connect to Firebase Emulators if enabled
if (USE_EMULATOR) {
  console.log('🔧 Connecting to Firebase Emulators...');
  connectFirestoreEmulator(firebaseDB, '127.0.0.1', 8081);
  connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });
  connectStorageEmulator(firebaseStorage, '127.0.0.1', 9199);
  console.log('✅ Connected to Firebase Emulators');
}
