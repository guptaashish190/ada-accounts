/* eslint-disable no-restricted-syntax */
const admin = require('firebase-admin');

const serviceAccount = require('./private_key.json'); // Replace with your service account key file
const data = require('./outstanding.json'); // Replace with the correct path to your data file

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Define the Firestore collection where you want to write the data
const collectionName = 'orders'; // Replace with your collection name
const partyDetailsCollection = 'parties';

// Function to write data to Firestore
const writeDataToFirestore = async () => {
  try {
    const ordersSnapshot = await db
      .collection('supplyReports')
      .where('orderDetails', '!=', [])
      .get();

    console.log(ordersSnapshot.size);
    ordersSnapshot.docs.forEach(async (e) => {
      const sr = e.data();

      let newOtherAd = [...sr.otherAdjustedBills];
      newOtherAd = newOtherAd.map((na) => {
        return {
          ...na,
          billId: na.orderId,
        };
      });
      await db.doc(`supplyReports/${e.id}`).update({
        otherAdjustedBills: newOtherAd,
      });
    });
    console.log('Data has been successfully wr1itten to Firestore.');
  } catch (error) {
    console.error('Error writing data to Firestore:', error);
  }
};

// Call the function to write data to Firestore
writeDataToFirestore();
