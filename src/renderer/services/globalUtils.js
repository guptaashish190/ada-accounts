import {
  collection,
  query,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
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
  // Function to fetch orders by a list of order IDs
  fetchOrdersByIds: async (orderIds) => {
    try {
      // Reference to the "orders" collection
      const ordersCollection = collection(firebaseDB, 'orders');

      // Use Promise.all to fetch all orders concurrently
      const ordersPromises = orderIds.map(async (orderId) => {
        const orderDoc = await getDoc(doc(ordersCollection, orderId));
        if (orderDoc.exists) {
          return { id: orderId, ...orderDoc.data() };
        }
        // Handle the case where the order with the given ID doesn't exist
        return { id: orderId, error: 'Order not found' };
      });

      // Wait for all promises to resolve
      const ordersData = await Promise.all(ordersPromises);

      return ordersData;
    } catch (error) {
      // Handle any errors that occur during the fetch
      console.error('Error fetching orders:', error);
      throw error;
    }
  },
  fetchPartyInfoForOrders: async (orders) => {
    try {
      const updatedOrders = await Promise.all(
        orders.map(async (order) => {
          const partyRef = doc(firebaseDB, 'parties', order.partyId); // Replace 'parties' with your collection name

          const partySnapshot = await getDoc(partyRef);

          if (partySnapshot.exists()) {
            const partyData = partySnapshot.data();
            // Replace the partyId with the party object
            return { ...order, party: partyData };
          }
          // If the party document doesn't exist, you can handle this case as needed.
          // For example, you can return the order as is or mark it as an invalid order.
          return order;
        }),
      );

      return updatedOrders;
    } catch (error) {
      console.error('Error fetching party information:', error);
      return orders; // Return the original list of orders if there's an 6aerror
    }
  },
  fetchPartyInfo: async (partyId) => {
    try {
      const partyRef = doc(firebaseDB, 'parties', partyId); // Replace 'parties' with your collection name

      const partySnapshot = await getDoc(partyRef);

      return partySnapshot.data();
    } catch (error) {
      console.error('Error fetching party information:', error);
      return null;
    }
  },
  getCurrencyFormat: (num) => {
    if (num !== 0 && (!num || num === '')) {
      return '--';
    }
    const formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',

      // These options are needed to round to whole numbers if that's what you want.
      // minimumFractionDigits: 0, // (this suffices for whole numbers, but will print 2500.10 as $2,500.1)
      maximumFractionDigits: 0, // (causes 2500.99 to be printed as $2,501)
    });
    return formatter.format(num);
  },
  getTimeFormat: (millisecondsSinceEpoch, dateOnly = false) => {
    if (!millisecondsSinceEpoch) return null;
    if (dateOnly) {
      return new Date(millisecondsSinceEpoch).toLocaleDateString();
    }
    const timeOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    const date = new Date(millisecondsSinceEpoch).toLocaleTimeString(
      'en-us',
      timeOptions,
    );
    return date;
  },
};

export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState('');
  const timerRef = useRef();

  useEffect(() => {
    timerRef.current = setTimeout(() => setDebouncedValue(value), delay);

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [value, delay]);

  return debouncedValue;
};
