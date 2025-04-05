// app/Provider.jsx
"use client";
import React, { Suspense, createContext, useEffect, useState } from 'react';
import Header from './_components/Header'; // Assuming path is correct
import axios from 'axios';
import { useUser } from '@clerk/nextjs';
import { UserDetailContext } from './_context/UserDetailContext'; // Correct import name
import { Toaster } from "sonner"; // Changed import to use sonner directly
  
function Provider({ children }) {
    const { user, isLoaded } = useUser(); // Use isLoaded from Clerk
    const [userDetail, setUserDetail] = useState(null); // Init with null
    const [loadingUser, setLoadingUser] = useState(true); // State to track initial user load

    useEffect(() => {
        // Only run CheckUserAuth if Clerk has loaded and user object exists
        if (isLoaded && user) {
            console.log("Clerk user loaded:", user.fullName);
            CheckUserAuth();
        } else if (isLoaded && !user) {
             // Handle case where Clerk is loaded but user is not signed in
             console.log("Clerk loaded, no user signed in.");
             setUserDetail(null); // Clear user detail if logged out
             setLoadingUser(false); // Finished loading (no user)
        }
         // If !isLoaded, we are still waiting for Clerk
    }, [user, isLoaded]); // Depend on both user and isLoaded

    const CheckUserAuth = async () => {
        setLoadingUser(true); // Start loading specific user data
        console.log("Checking/Saving user data via API...");
        try {
            const payload = {
                userName: user?.fullName,
                userEmail: user?.primaryEmailAddress?.emailAddress
            };
            console.log("Sending user data to API:", payload);
            const result = await axios.post('/api/users', payload);

            if (result.data && result.data.email) {
                console.log("API response (user data):", result.data);
                setUserDetail(result.data);
            } else {
                 console.error("API response for user check/creation was invalid:", result.data);
                 // Handle error - maybe show a message? For now, set userDetail to null.
                 setUserDetail(null);
            }
        } catch (error) {
            console.error("Error calling /api/users:", error.response?.data || error.message);
            // Handle API error - maybe show a message?
            setUserDetail(null); // Clear user detail on error
        } finally {
             setLoadingUser(false); // Finished loading user data (success or fail)
        }
    };

    return (
        <UserDetailContext.Provider value={{ userDetail, setUserDetail, loadingUser }}>
            <Header />
            {/* Conditionally render children or a loading state */}
            {loadingUser ? (
                 <div className='flex justify-center items-center h-[calc(100vh-80px)]'> {/* Adjust height as needed */}
                     <p>Loading user data...</p> {/* Or a spinner component */}
                 </div>
            ) : (
                 <div className='px-4 sm:px-10 lg:px-32 xl:px-48 2xl:px-56'> {/* Added responsive padding */}
                     {children}
                 </div>
            )}
             <Toaster /> {/* Add Sonner Toaster for notifications */}
        </UserDetailContext.Provider>
    );
}

// Wrap Provider in Suspense if it uses hooks like useSearchParams directly,
// but here it only uses useEffect/useState/useContext which don't require it.
export default Provider;