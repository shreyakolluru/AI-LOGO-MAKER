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
    const modelType = searchParams.get('type') || 'Free';

    // Effect to load formData from localStorage
    useEffect(() => {
        if (!loadingUser && userDetail?.email && typeof window !== 'undefined') {
            const storage = localStorage.getItem('formData');
            if (storage) {
                try {
                    const parsedData = JSON.parse(storage);
                    // Only update state if formData has actually changed
                    // This helps prevent unnecessary effect triggers if userDetail re-renders but data is same
                    if (JSON.stringify(parsedData) !== JSON.stringify(formData)) {
                        setFormData(parsedData);
                        console.log("Loaded formData from storage:", parsedData);
                        // Reset generation attempt flag ONLY when new formData is loaded
                        setGenerationAttemptedForId(null);
                        setLogoImage(null);
                        setError(null);
                    }
                } catch (e) {
                    console.error("Failed to parse formData from localStorage", e);
                    localStorage.removeItem('formData');
                    setFormData({}); // Reset state
                    setGenerationAttemptedForId(null);
                }
            } else {
                 console.log("No formData found in localStorage.");
                 if (formData !== null || generationAttemptedForId !== null){ // Avoid setting state if already cleared
                    setFormData({});
                    setGenerationAttemptedForId(null);
                 }
            }
        } else if (!loadingUser && !userDetail?.email) {
             // Clear state if user logs out or context loads without user
             if (formData !== null || generationAttemptedForId !== null) {
                setFormData(null);
                setLogoImage(null);
                setError(null);
                setGenerationAttemptedForId(null);
             }
        }
    }, [userDetail, loadingUser, formData]); // formData added to dependency to check if update needed

    // Effect to trigger logo generation
    useEffect(() => {
        // Create a unique ID for the current generation attempt based on key formData
        // This ensures we only try once per unique set of inputs loaded
        const currentAttemptId = formData ? `${formData.title}-${formData.desc}-${formData.palette}` : null;

        // Conditions:
        // 1. User context loaded
        // 2. formData loaded and has a title
        // 3. Not currently loading an AI generation
        // 4. Haven't already attempted generation for this specific formData ID
        // 5. The currentAttemptId is valid
        if (!loadingUser && formData && formData.title && !loading && generationAttemptedForId !== currentAttemptId && currentAttemptId) {
            console.log(`Attempting generation for ID: ${currentAttemptId}`);
            setGenerationAttemptedForId(currentAttemptId); // Mark this specific attempt as started
            GenerateAILogo();
        }
    }, [formData, loading, generationAttemptedForId, loadingUser]); // Dependencies

    // Function to call the backend API
    const GenerateAILogo = async () => {
        if (!formData) {
             console.error("Cannot generate logo, formData is not loaded.");
             setError("Logo details not available.");
             toast.error("Logo details not available.");
             return;
        }
        // Check credits before API call for paid types
        if (modelType !== 'Free' && (!userDetail?.credits || userDetail.credits <= 0)) {
            console.log("Not Enough Credits");
            toast.error('Not enough credits to generate logo!');
            setError('Not enough credits.');
            // Don't reset attempt flag here, let user manually retry if credits added
            return;
        }

        setLoading(true);
        setError(null);
        setLogoImage(null);

        // Construct the meta-prompt for Gemini
        const PROMPT_FOR_AI_PROMPT = Prompt.LOGO_PROMPT
            .replace('{logoTitle}', formData?.title || 'logo')
            .replace('{logoDesc}', formData?.desc || 'design')
            .replace('{logoColor}', formData?.palette || 'vibrant colors')
            .replace('{logoIdea}', formData?.idea || 'a unique concept')
            .replace('{logoDesign}', formData?.design?.title || 'modern')
            .replace('{logoPrompt}', formData?.design?.prompt || '');

        console.log("--- Sending Meta-Prompt to /api/ai-logo-model ---");
        // console.log(PROMPT_FOR_AI_PROMPT); // Log full prompt if needed for debugging
        console.log("-------------------------------------------------");

        try {
            const payload = {
                prompt: PROMPT_FOR_AI_PROMPT,
                email: userDetail?.email,
                title: formData.title,
                desc: formData.desc,
                type: modelType,
                userCredits: userDetail?.credits
            };
            console.log("API Payload:", { ...payload, prompt: payload.prompt.substring(0,100)+"..."});

            const result = await axios.post('/api/ai-logo-model', payload);

            console.log("API Response Data Received:", result.data);

            if (result.data && typeof result.data.image === 'string' && result.data.image.startsWith('data:image')) {
                setLogoImage(result.data.image);
                toast.success('Logo generated successfully!');
                 if (typeof window !== 'undefined') {
                     localStorage.removeItem('formData');
                 }
                 if(modelType !== 'Free' && setUserDetail) {
                    setUserDetail(prev => ({
                        ...prev,
                        credits: Number(prev.credits) - 1 >= 0 ? Number(prev.credits) - 1 : 0 // Ensure credits don't go below 0
                    }));
                 }
            } else if (result.data && result.data.error) {
                console.error("API returned an error:", result.data.error);
                setError(result.data.error);
                toast.error(`Error: ${result.data.error}`);
                // Do NOT reset generationAttemptedForId on recoverable errors automatically
            } else {
                console.error("API response did not contain a valid image string or error:", result.data);
                setError("Received an invalid response format from the server.");
                toast.error("Error: Invalid response from server.");
            }
        } catch (err) {
            console.error("Error calling API:", err);
            const backendError = err.response?.data?.error || err.message || "An unknown network or server error occurred.";
            setError(backendError);
            toast.error(`Error: ${backendError}`);
             // Do NOT reset generationAttemptedForId on errors automatically
        } finally {
            setLoading(false);
        }
    };

    // Download function
    const onDownload = () => {
        // ... (download function remains the same) ...
        if (!logoImage) return;
        const link = document.createElement('a');
        link.href = logoImage;
        const mimeMatch = logoImage.match(/^data:(image\/(.+));base64,/);
        const extension = mimeMatch ? mimeMatch[2] : 'png';
        link.download = `${formData?.title?.replace(/\s+/g, '_') || 'logo'}-${Date.now()}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Logo downloaded!");
    };

    // --- Conditional Rendering ---
     let displayContent;
      if (loadingUser) {
          displayContent = <div className='flex justify-center items-center h-[200px]'><LoaderIcon className='animate-spin h-8 w-8' /> <span className='ml-2'>Loading user details...</span></div>;
     }
     else if (!userDetail?.email) {
        displayContent = <p>Please log in to generate logos.</p>;
    } else if (formData === null && !loadingUser) { // Check !loadingUser here too
        displayContent = <p>Loading logo details...</p>; // State when user is loaded but form data isn't yet
    } else if (loading) {
        displayContent = (
            <div className='flex flex-col items-center mt-2'>
                <h2 className='font-bold text-3xl text-primary'>{Lookup.LoadingWaitTitle || "Generating Your Logo..."}</h2>
                <p className='text-xl text-gray-500 mt-2'>{Lookup.LoadingWaitDesc || "Please wait, this may take a moment."}</p>
                <LoaderIcon className='animate-spin h-10 w-10 mt-4 text-primary' />
                 {/* Ensure loading.gif is in /public */}
                <Image src={'/loading.gif'} alt='loading' width={200} height={200} className='mt-6' unoptimized={true} />
                <h2 className='mt-2 font-medium text-2xl text-gray-500'>Do Not Refresh!</h2>
            </div>
        );
    } else if (logoImage) {
        // ... (logo image display remains the same) ...
        displayContent = (
            <div className='mt-5 flex flex-col items-center'>
                <h2 className='text-2xl font-semibold mb-4'>Your Logo is Ready!</h2>
                <Image src={logoImage} alt='Generated logo' width={300} height={300}
                    className='rounded-xl border shadow-lg' />
                <div className='mt-6 flex flex-wrap items-center justify-center gap-4'>
                    <Button onClick={onDownload}> <DownloadIcon className='mr-2 h-4 w-4' /> Download</Button>
                    <Link href={'/dashboard'}>
                        <Button variant="outline"> <LayoutDashboard className='mr-2 h-4 w-4' /> Dashboard</Button>
                    </Link>
                </div>
            </div>
        );
    } else if (error) {
        // ... (error display remains the same, add Retry button) ...
         displayContent = (
             <div className='mt-5 flex flex-col items-center text-center'>
                 <h2 className='text-2xl font-semibold mb-4 text-red-600'>Generation Failed</h2>
                 <p className='text-gray-700 mb-4'>Sorry, an error occurred:</p>
                 <p className='text-red-500 bg-red-100 p-3 rounded border border-red-300 max-w-md break-words'>{error}</p>
                 <div className='mt-6 flex flex-wrap items-center justify-center gap-4'>
                     {/* Reset attempt flag to allow retry */}
                    <Button onClick={() => setGenerationAttemptedForId(null)} disabled={loading}>Retry Generation</Button>
                    <Link href={'/dashboard'} >
                            <Button variant="outline"> <LayoutDashboard className='mr-2 h-4 w-4' /> Dashboard</Button>
                    </Link>
                 </div>
             </div>
         );
    } else if (generationAttemptedForId && !loading && !logoImage) {
         // ... (handle case where generation finished with no image/error, add Retry button) ...
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
    }
     // ... (handle case where form data isn't ready) ...
      else if (!formData?.title && !loading && !loadingUser) {
         displayContent = (
            <div className='mt-5 flex flex-col items-center text-center'>
                <p className='text-gray-700 mb-4'>Please complete the logo details form first to generate a logo.</p>
                <Link href={'/'} className='mt-6'>
                        <Button>Go to Form</Button>
                 </Link>
            </div>
         );
    }
    else {
        displayContent = <p>Preparing logo generation...</p>;
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
        <Suspense fallback={<div className='mt-16 text-center'><LoaderIcon className='animate-spin h-8 w-8 inline-block'/> Loading...</div>}>
            <GenerateLogoContent />
        </Suspense>
    )
}

export default GenerateLogoPage;