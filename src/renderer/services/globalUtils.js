import {
  collection,
  query,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  addDoc,
  setDoc,
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
  // Function to fetch orders by a list of order IDs
  fetchPartyByIds: async (partyIds) => {
    try {
      // Reference to the "orders" collection
      const partiesCollection = collection(firebaseDB, 'parties');

      // Use Promise.all to fetch all orders concurrently
      const partyPromises = partyIds.map(async (partyId) => {
        const partyDoc = await getDoc(doc(partiesCollection, partyId));
        if (partyDoc.exists) {
          return { id: partyId, ...partyDoc.data() };
        }
        // Handle the case where the order with the given ID doesn't exist
        return { id: partyId, error: 'Order not found' };
      });

      // Wait for all promises to resolve
      const partyData = await Promise.all(partyPromises);

      return partyData;
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
          try {
            const partyRef = doc(firebaseDB, 'parties', order.partyId); // Replace 'parties' with your collection name

            const partySnapshot = await getDoc(partyRef);

            if (partySnapshot.exists()) {
              const partyData = partySnapshot.data();
              // Replace the partyId with the party object
              return { ...order, party: partyData };
            }
          } catch (e) {
            console.error(e);
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
  getDaysPassed: (time) => {
    // Get the current time in milliseconds since the epoch
    const currentTimeMillis = Date.now();

    // Calculate the time difference in milliseconds
    const timeDifferenceMillis = currentTimeMillis - time;

    // Convert the time difference to the number of days
    const daysPassed = Math.floor(timeDifferenceMillis / (1000 * 60 * 60 * 24));
    return daysPassed;
  },
  getDayTime: (millisecondsSinceEpoch) => {
    const timeOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    };
    const date = new Date(millisecondsSinceEpoch).toLocaleTimeString(
      'en-GB',
      timeOptions,
    );
    return date;
  },
  getTimeFormat: (
    millisecondsSinceEpoch,
    dateOnly = false,
    shortForm = false,
  ) => {
    if (!millisecondsSinceEpoch) return null;
    if (shortForm && isToday(millisecondsSinceEpoch)) {
      return 'Today';
    }
    if (shortForm && isTomorrow(millisecondsSinceEpoch)) {
      return 'Tomorrow';
    }
    if (dateOnly) {
      return new Date(millisecondsSinceEpoch).toLocaleDateString('en-GB');
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
      'en-GB',
      timeOptions,
    );
    return date;
  },
  getNewReceiptNumber: async (counter) => {
    const cashReceiptsRef = doc(firebaseDB, '/counters', counter.name);

    const cashReceiptsDoc = await getDoc(cashReceiptsRef);
    let counter1;

    if (!cashReceiptsDoc.exists()) {
      counter1 = 1;
    } else {
      counter1 = cashReceiptsDoc.data().counter + 1;
    }

    // Use String.prototype.padStart to add leading zeros
    return `${counter.prefix}-${String(counter1).padStart(6, '0')}`;
  },
  incrementReceiptCounter: async (counter) => {
    const cashReceiptsRef = doc(firebaseDB, '/counters', counter.name);

    const cashReceiptsDoc = await getDoc(cashReceiptsRef);

    if (!cashReceiptsDoc.exists()) {
      setDoc(cashReceiptsRef, {
        counter: 1,
      });
    } else {
      updateDoc(cashReceiptsRef, {
        counter: cashReceiptsDoc.data().counter + 1,
      });
    }
  },

  getTotalCases: (bills) =>
    bills.reduce((acc, cur) => {
      if (!cur.bags) return 0;
      return acc + cur.bags[0].quantity;
    }, 0),
  getTotalPackets: (bills) =>
    bills.reduce((acc, cur) => {
      if (!cur.bags) return 0;
      return acc + cur.bags[1].quantity;
    }, 0),
  getTotalPolyBags: (bills) =>
    bills.reduce((acc, cur) => {
      if (!cur.bags) return 0;
      return acc + cur.bags[2].quantity;
    }, 0),
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

// Check if the date matches today's date in the current time zone
const isToday = (mssie) => {
  const currentDate = new Date();
  const date = new Date(mssie);
  return (
    date.getDate() === currentDate.getDate() &&
    date.getMonth() === currentDate.getMonth() &&
    date.getFullYear() === currentDate.getFullYear()
  );
};

// Check if the date matches today's date in the current time zone
const isTomorrow = (mssie) => {
  const currentDate = new Date();
  const date = new Date(mssie);
  return (
    date.getDate() === currentDate.getDate() + 1 &&
    date.getMonth() === currentDate.getMonth() &&
    date.getFullYear() === currentDate.getFullYear()
  );
};
