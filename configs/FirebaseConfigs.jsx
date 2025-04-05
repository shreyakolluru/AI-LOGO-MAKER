// configs/FirebaseConfigs.js
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

let db;

// Initialize Firebase Admin SDK only if it hasn't been initialized yet
if (!admin.apps.length) {
  try {
    console.log('Attempting Firebase Admin SDK initialization...');
    
    // First try with service account from env variable
    const serviceAccountKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKeyJson) {
      // Initialize with explicit service account
      const serviceAccount = JSON.parse(serviceAccountKeyJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialized with service account.');
    } else {
      // Fallback to application default credentials
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.log('Firebase Admin SDK initialized with application default credentials.');
    }
  } catch (error) {
    console.error('!!! FIREBASE ADMIN SDK INITIALIZATION ERROR:', error.stack);
    throw new Error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
  }
} else {
  console.log('Firebase Admin SDK already initialized.');
}

// Get Firestore instance
try {
  db = getFirestore();
  console.log('Firestore instance obtained successfully.');
} catch (error) {
  console.error('!!! FAILED TO GET FIRESTORE INSTANCE:', error.stack);
  throw new Error(`Failed to get Firestore instance: ${error.message}`);
}

export { db };
