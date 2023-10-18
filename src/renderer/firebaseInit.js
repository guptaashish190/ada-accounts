// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import {
  disableNetwork,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
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
const analytics = getAnalytics(firebaseApp);
