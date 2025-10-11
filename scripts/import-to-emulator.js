// Script to import production Firestore data to emulator
// Run this with: node scripts/import-to-emulator.js

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// You need to set up Application Default Credentials first:
// Run: firebase login
// Then: gcloud auth application-default login

async function importToEmulator() {
  try {
    // Initialize Firebase Admin with default credentials
    admin.initializeApp({
      projectId: 'ashishdrugagencies-e5b9a'
    });

    const db = admin.firestore();
    
    // Connect to the emulator (make sure emulators are running)
    db.settings({
      host: 'localhost:8081',
      ssl: false
    });

    console.log('Connected to Firestore emulator at localhost:8081');
    
    // Get all collections from production
    const collections = await db.listCollections();
    console.log(`Found ${collections.length} collections to import`);
    
    for (const collection of collections) {
      console.log(`\nImporting collection: ${collection.id}`);
      
      // Get all documents from production
      const snapshot = await collection.get();
      console.log(`  Found ${snapshot.size} documents`);
      
      // Import each document to emulator
      const batch = db.batch();
      let batchCount = 0;
      
      snapshot.forEach(doc => {
        const docRef = db.collection(collection.id).doc(doc.id);
        batch.set(docRef, doc.data());
        batchCount++;
        
        // Firestore batch limit is 500 operations
        if (batchCount >= 500) {
          batch.commit();
          batchCount = 0;
        }
      });
      
      // Commit remaining operations
      if (batchCount > 0) {
        await batch.commit();
      }
      
      console.log(`  ✓ Imported ${snapshot.size} documents to emulator`);
    }
    
    console.log('\n✅ Import complete!');
    
  } catch (error) {
    console.error('❌ Error importing data:', error);
  }
}

importToEmulator();

