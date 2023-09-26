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
};
