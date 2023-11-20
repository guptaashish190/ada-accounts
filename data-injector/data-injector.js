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

// Function to fetch party details by name
const getPartyId = async (partyName) => {
  const partyQuery = await db
    .collection(partyDetailsCollection)
    .where('name', '==', partyName)
    .get();

  if (!partyQuery.empty) {
    return partyQuery.docs[0].id; // Return the document ID of the party details
  }

  return null; // Return null if party details are not found
};

// Function to write data to Firestore
const writeDataToFirestore = async () => {
  try {
    // Iterate over each document in the data and write it to the Firestore collection

    let partyId;
    let count = 0;

    for await (const document of data) {
      if (document['Party Name']) {
        partyId = await getPartyId(document['Party Name']);
      } else if (partyId) {
        const billData = {
          balance: document.Balance || 0,
          accountsNotes: '',
          billNumber: document['Bill No.'] || '',
          creationTime: new Date(document['Bill Date']).getTime(),
          flow: [],
          flowCompleted: true,
          orderAmount: document['Bill Amt.'] || '',
          orderStatus: 'Received Bill',
          partyId,
          with: 'Accounts',
        };
        const docRef = db.collection(collectionName).doc();
        await docRef.set({ ...billData, id: docRef.id });
        count += 1;
      }
    }

    console.log('Data has been successfully written to Firestore.', count);
  } catch (error) {
    console.error('Error writing data to Firestore:', error);
  }
};

const updateOrdersWithDocumentId = async () => {
  try {
    const ordersSnapshot = await db.collection(collectionName).get();

    const batch = db.batch();
    let count = 0;
    ordersSnapshot.forEach((doc) => {
      const docRef = db.collection(collectionName).doc(doc.id);
      batch.update(docRef, { id: doc.id });
      count += 1;
      console.log(`${count} done`);
    });

    await batch.commit();
    console.log(
      'Documents in the "orders" collection updated with "id" field.',
      count,
    );
  } catch (error) {
    console.error('Error updating documents:', error);
  }
};
// Call the function to write data to Firestore
writeDataToFirestore();
