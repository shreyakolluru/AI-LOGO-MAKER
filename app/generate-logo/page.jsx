// app/generate-logo/page.jsx
"use client"
import React, { Suspense, useContext, useEffect, useState } from 'react'
import { UserDetailContext } from '../_context/UserDetailContext' // Correct context import name
import Lookup from '../_data/Lookup';
import Prompt from '../_data/Prompt';
import axios from 'axios';
import Image from 'next/image';
import { DownloadIcon, LayoutDashboard, LoaderIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';

// Wrapper component to safely use useSearchParams
function GenerateLogoContent() {
    const { userDetail, setUserDetail, loadingUser } = useContext(UserDetailContext);
    const [formData, setFormData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [logoImage, setLogoImage] = useState(null);
    const [error, setError] = useState(null);
    // Flag to ensure generation is attempted only once per relevant data load
    const [generationAttemptedForId, setGenerationAttemptedForId] = useState(null);

    const searchParams = useSearchParams();
    // Default to 'Free' if type param is missing
    const modelType = searchParams.get('type') || 'Free';

    // Effect to load formData from localStorage
    useEffect(() => {
        // Ensure window exists for localStorage access
        if (typeof window === 'undefined') return;

        if (!loadingUser && userDetail?.email) {
            const storage = localStorage.getItem('formData');
            if (storage) {
                try {
                    const parsedData = JSON.parse(storage);
                    // Prevent infinite loops by only setting state if data differs
                    if (JSON.stringify(parsedData) !== JSON.stringify(formData)) {
                        setFormData(parsedData);
                        console.log("Loaded formData from storage:", parsedData);
                        setGenerationAttemptedForId(null); // Reset attempt flag for new data
                        setLogoImage(null); // Clear previous image
                        setError(null); // Clear previous error
                    }
                } catch (e) {
                    console.error("Failed to parse formData from localStorage", e);
                    localStorage.removeItem('formData'); // Clear invalid data
                    setFormData({});
                    setGenerationAttemptedForId(null);
                }
            } else {
                 console.log("No formData found in localStorage.");
                 // Only clear if state isn't already null/empty
                 if (formData !== null && Object.keys(formData).length === 0) {
                    setFormData({});
                    setGenerationAttemptedForId(null);
                 }
            }
        } else if (!loadingUser && !userDetail?.email) {
             // Clear state if user logs out or context loads without user
             if (formData !== null || logoImage !== null || error !== null || generationAttemptedForId !== null) {
                setFormData(null);
                setLogoImage(null);
                setError(null);
                setGenerationAttemptedForId(null);
                localStorage.removeItem('formData'); // Also clear storage if user logs out
             }
        }
        // formData removed from dependency array to prevent loop if JSON check fails
        // Re-assess if needed, but current check `JSON.stringify(parsedData) !== JSON.stringify(formData)` should handle it
    }, [userDetail, loadingUser]);

    // Effect to trigger logo generation
    useEffect(() => {
        const currentAttemptId = formData ? `${formData.title}-${formData.desc}-${formData.palette}` : null;

        if (!loadingUser && formData && formData.title && !loading && generationAttemptedForId !== currentAttemptId && currentAttemptId) {
            console.log(`Attempting generation for ID: ${currentAttemptId}, Type: ${modelType}`);
            setGenerationAttemptedForId(currentAttemptId);
            GenerateAILogo();
        }
        // Added modelType to dependencies in case the user navigates back/forward changing the type param
    }, [formData, loading, generationAttemptedForId, loadingUser, modelType]);

    // Function to call the backend API
    const GenerateAILogo = async () => {
        if (!formData || !formData.title) { // Added check for title presence
             console.error("Cannot generate logo, formData is not loaded or incomplete.");
             // Avoid setting error if component might be unmounting or formData is clearing
             if (formData !== null && Object.keys(formData).length !== 0) {
                 setError("Logo details not available or incomplete.");
                 toast.error("Logo details not available or incomplete.");
             }
             setLoading(false); // Ensure loading is stopped
             return;
        }

        // Check credits before API call for paid types
        // Use the modelType determined from searchParams
        if (modelType !== 'Free' && (!userDetail?.credits || Number(userDetail.credits) <= 0)) {
            console.log("Not Enough Credits for Paid Generation");
            toast.error('Not enough credits to generate premium logo!');
            setError('Not enough credits.');
            setLoading(false); // Stop loading indicator
            // Allow manual retry by not resetting attempt flag automatically
            return;
        }

        setLoading(true);
        setError(null);
        setLogoImage(null);

        // Construct the meta-prompt for Gemini
        const PROMPT_FOR_AI_PROMPT = Prompt.LOGO_PROMPT
            .replace('{logoTitle}', formData?.title || 'logo')
            .replace('{logoDesc}', formData?.desc || 'design')
            .replace('{logoColor}', formData?.palette || 'vibrant colors') // Assuming palette is string like "Ocean Blues"
            .replace('{logoIdea}', formData?.idea || 'a unique concept')
            .replace('{logoDesign}', formData?.design?.title || 'modern')
            .replace('{logoPrompt}', formData?.design?.prompt || '');

        console.log("--- Sending Meta-Prompt to /api/ai-logo-model ---");
        // console.log(PROMPT_FOR_AI_PROMPT);
        console.log("-------------------------------------------------");

        try {
            const payload = {
                prompt: PROMPT_FOR_AI_PROMPT,
                email: userDetail?.email,
                title: formData.title,
                desc: formData.desc,
                type: modelType, // Pass the correct type
                userCredits: userDetail?.credits
            };
            console.log("API Payload:", { ...payload, prompt: payload.prompt.substring(0,100)+"..."});

            const result = await axios.post('/api/ai-logo-model', payload);

            console.log("API Response Data Received:", result.data);

            if (result.data && typeof result.data.image === 'string' && result.data.image.startsWith('data:image')) {
                setLogoImage(result.data.image);
                toast.success(`Logo generated successfully using ${modelType} model!`);

                 // Clear formData from localStorage only on success
                 if (typeof window !== 'undefined') {
                     localStorage.removeItem('formData');
                     // Maybe set formData to {} to prevent re-triggering effect if user stays on page
                     // setFormData({}); // Optional: prevents re-trigger if user stays
                 }

                 // Update credits in context if it was a paid generation
                 if(modelType !== 'Free' && setUserDetail) {
                    setUserDetail(prev => {
                        const currentCredits = Number(prev?.credits ?? 0);
                        return {
                            ...prev,
                            credits: Math.max(0, currentCredits - 1) // Ensure credits don't go below 0
                        };
                    });
                 }
            } else if (result.data && result.data.error) {
                console.error("API returned an error:", result.data.error);
                const specificError = result.data.error;
                setError(specificError);
                toast.error(`Error: ${specificError}`);
                // Reset attempt flag to allow retry on specific API errors
                setGenerationAttemptedForId(null);
            } else {
                console.error("API response did not contain a valid image string or error:", result.data);
                setError("Received an invalid response format from the server.");
                toast.error("Error: Invalid response from server.");
                setGenerationAttemptedForId(null); // Allow retry
            }
        } catch (err) {
            console.error("Error calling API:", err);
            // Extract more specific error from Axios response if available
            const backendError = err.response?.data?.error || err.message || "An unknown network or server error occurred.";
            setError(backendError);
            toast.error(`Error: ${backendError}`);
             // Reset attempt flag to allow retry on network/server errors
             setGenerationAttemptedForId(null);
        } finally {
            setLoading(false);
        }
    };

    // Download function
    const onDownload = () => {
        if (!logoImage) return;
        const link = document.createElement('a');
        link.href = logoImage;
        // Extract file extension from base64 mime type
        const mimeMatch = logoImage.match(/^data:(image\/(.+));base64,/);
        const extension = mimeMatch && mimeMatch[2] ? mimeMatch[2].split('+')[0] : 'png'; // Default to png, handle svg+xml etc.
        // Sanitize title for filename
        const safeTitle = formData?.title?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'logo';
        link.download = `${safeTitle}-${Date.now()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Logo downloaded!");
    };

    // --- Conditional Rendering ---
    let displayContent;
    if (loadingUser) {
        // Loading user data (initial state)
        displayContent = <div className='flex justify-center items-center h-[200px]'><LoaderIcon className='animate-spin h-8 w-8 text-primary' /> <span className='ml-2 text-gray-600'>Loading user details...</span></div>;
    } else if (!userDetail?.email) {
        // User not logged in
        displayContent = <p className='text-center text-red-600'>Please log in to generate logos.</p>;
    } else if (formData === null && !loading) {
        // User loaded, waiting for formData from localStorage (or no data found)
        displayContent = <div className='flex justify-center items-center h-[200px]'><LoaderIcon className='animate-spin h-8 w-8 text-primary' /> <span className='ml-2 text-gray-600'>Loading logo details...</span></div>;
    } else if (loading) {
        // API call in progress
        displayContent = (
            <div className='flex flex-col items-center mt-2 text-center'>
                <h2 className='font-bold text-3xl text-primary'>{Lookup.LoadingWaitTitle || "Generating Your Logo..."}</h2>
                <p className='text-xl text-gray-500 mt-2'>{Lookup.LoadingWaitDesc || "Please wait, this may take a moment."}</p>
                <LoaderIcon className='animate-spin h-10 w-10 mt-4 text-primary' />
                <Image src={'/loading.gif'} alt='loading animation' width={200} height={200} className='mt-6' unoptimized={true} priority={true} />
                <h2 className='mt-2 font-medium text-2xl text-gray-500'>Do Not Refresh!</h2>
            </div>
        );
    } else if (logoImage) {
        // Success - Logo generated
        displayContent = (
            <div className='mt-5 flex flex-col items-center'>
                <h2 className='text-2xl font-semibold mb-4'>Your Logo is Ready!</h2>
                <div className='p-2 border rounded-lg shadow-lg bg-gray-50'>
                    <Image src={logoImage} alt='Generated logo' width={300} height={300}
                        className='rounded-md' />
                </div>
                <div className='mt-6 flex flex-wrap items-center justify-center gap-4'>
                    <Button onClick={onDownload}> <DownloadIcon className='mr-2 h-4 w-4' /> Download</Button>
                    <Link href={'/dashboard'}>
                        <Button variant="outline"> <LayoutDashboard className='mr-2 h-4 w-4' /> Dashboard</Button>
                    </Link>
                </div>
            </div>
        );
    } else if (error) {
        // Error occurred during generation
         displayContent = (
             <div className='mt-5 flex flex-col items-center text-center max-w-lg mx-auto'>
                 <h2 className='text-2xl font-semibold mb-4 text-red-600'>Generation Failed</h2>
                 <p className='text-gray-700 mb-4'>Sorry, an error occurred:</p>
                 {/* Display specific error message */}
                 <p className='text-red-700 bg-red-100 p-3 rounded border border-red-300 w-full break-words text-sm'>{error}</p>
                 <div className='mt-6 flex flex-wrap items-center justify-center gap-4'>
                    {/* Allow retry by resetting the attempt flag */}
                    <Button onClick={() => setGenerationAttemptedForId(null)} disabled={loading}>Retry Generation</Button>
                    <Link href={'/dashboard'} >
                            <Button variant="outline"> <LayoutDashboard className='mr-2 h-4 w-4' /> Dashboard</Button>
                    </Link>
                 </div>
             </div>
         );
    } else if (generationAttemptedForId && !loading && !logoImage && !error) {
         // Generation finished without image or error (might happen if API returns unexpected empty success)
          displayContent = (
            <div className='mt-5 flex flex-col items-center text-center'>
                 <p className='text-gray-700 mb-4'>Logo generation finished, but no image was produced. This might be due to the prompt or model limitations.</p>
                 <div className='mt-6 flex flex-wrap items-center justify-center gap-4'>
                    <Button onClick={() => setGenerationAttemptedForId(null)} disabled={loading}>Try Again</Button>
                    <Link href={'/dashboard'} >
                            <Button variant="outline"> <LayoutDashboard className='mr-2 h-4 w-4' /> Dashboard</Button>
                    </Link>
                 </div>
             </div>
        );
    } else if (!formData?.title && !loading) {
        // User loaded but formData is empty or lacks title (e.g., user navigated directly)
        displayContent = (
           <div className='mt-5 flex flex-col items-center text-center'>
               <p className='text-gray-700 mb-4'>Please complete the logo details form first to generate a logo.</p>
               <Link href={'/'} className='mt-6'>
                       <Button>Go to Form</Button>
                </Link>
           </div>
        );
   } else {
       // Default state while waiting for effects or if formData is present but generation hasn't started
       displayContent = <p className='text-gray-600'>Preparing logo generation...</p>;
   }


    return (
        <div className='mt-16 flex flex-col items-center justify-center p-4 min-h-[calc(100vh-200px)]'>
            {displayContent}
        </div>
    );
}

// Wrapper component needed for useSearchParams
function GenerateLogoPage() {
    return (
        // Suspense boundary for useSearchParams
        <Suspense fallback={<div className='flex justify-center items-center h-[calc(100vh-200px)]'><LoaderIcon className='animate-spin h-8 w-8 text-primary'/> Loading...</div>}>
            <GenerateLogoContent />
        </Suspense>
    )
}

export default GenerateLogoPage;