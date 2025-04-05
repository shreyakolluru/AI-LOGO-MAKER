// app/api/users/route.js

// Make sure db is correctly initialized using Firebase Admin SDK
// e.g., import admin from 'firebase-admin';
// if (!admin.apps.length) { admin.initializeApp({...}); }
// const db = admin.firestore();
// OR import { db } from '@/configs/FirebaseConfigs'; <--- Ensure this provides Admin DB

import { db } from "@/configs/FirebaseConfigs"; // Assuming this imports the ADMIN SDK db instance
import { NextResponse } from "next/server";
// Import ServerTimestamp if you use it
// import admin from 'firebase-admin'; // If needed for ServerTimestamp

export async function POST(req) {
  try {
    const body = await req.json();
    const { userEmail, userName } = body;

    console.log("API /api/users received:", { userEmail, userName });

    // Validate input
    if (!userEmail || typeof userEmail !== 'string') {
      console.error("Missing or invalid email in request");
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }

    try {
      // --- Use Admin SDK methods ---
      const docRef = db.collection("users").doc(userEmail); // Reference using Admin SDK

      console.log("Checking if user exists:", userEmail);
      const docSnap = await docRef.get(); // Get document snapshot

      if (docSnap.exists) {
        console.log("User exists, returning data:", docSnap.data());
        return NextResponse.json(docSnap.data());
      } else {
        console.log("Creating new user:", userEmail);
        const data = {
          name: userName || "User", // Default name if not provided
          email: userEmail,
          credits: 5, // Default credits
          // Use ISO string for simplicity, or configure ServerTimestamp
          createdAt: new Date().toISOString()
          // OR: createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Create the document using .set()
        await docRef.set(data);
        console.log("User created successfully");

        return NextResponse.json(data, { status: 201 }); // Return 201 Created status
      }
    } catch (firestoreError) {
      console.error("Firestore error:", firestoreError);
      console.error("Firestore error code:", firestoreError.code); // Log code if available
      return NextResponse.json(
        { error: "Database operation failed", details: firestoreError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    // Catch errors like req.json() failing
    console.error("API error (outside Firestore block):", error);
    return NextResponse.json(
      { error: "Server error processing request", details: error.message },
      { status: 500 }
    );
  }
}