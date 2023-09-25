import {
  collection,
  query,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import firebaseApp, { firebaseDB } from '../firebaseInit';

export default {
  fetchUserById: async (userId) => {
    try {
      const userDocRef = doc(firebaseDB, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        return userData;
      }
      throw new Error('User not found');
    } catch (error) {
      console.error('Error fetching user:', error);
      throw error;
    }
  },
};
