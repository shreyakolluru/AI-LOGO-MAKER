// app/api/ai-logo-model/route.jsx
import { AILogoPrompt } from "@/configs/AiModel"; // Gemini chat session for text prompt
import { db } from "../../../configs/FirebaseConfigs"; // Firestore ADMIN instance
import axios from "axios";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore"; // Added getDoc
import { NextResponse } from "next/server";
import Replicate from "replicate";
import sharp from "sharp"; // For image processing with Replicate result

export const maxDuration = 60; // Vercel timeout for the API route

// --- Define constants ---
// Use the API endpoint URL for the free model
const HF_MODEL_URL = 'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5';
const REPLICATE_MODEL_ENDPOINT = "bytedance/hyper-flux-8step:81946b1e09b256c543b35f37333a30d0d02ee2cd8c4f77cd915873a1ca622bad";
const HUGGING_FACE_TOKEN = process.env.HUGGING_FACE_API_TOKEN;
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

// --- Helper Function to Convert Replicate Image URL to Base64 ---
async function ConvertImageUrlToBase64(imageUrl) {
    try {
        console.log("Fetching image from URL:", imageUrl);
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });

        if (response.status !== 200 || !response.data || response.data.byteLength === 0) {
            throw new Error(`Failed to fetch image from Replicate URL (status: ${response.status}, size: ${response.data?.byteLength})`);
        }

        console.log(`Image fetched (size: ${response.data.byteLength} bytes). Compressing...`);
        const compressedImageBuffer = await sharp(response.data)
            .resize({ width: 700, height: 700, fit: 'inside' }) // Resize, fit inside bounds
            .jpeg({ quality: 85, progressive: true }) // Compress as JPEG
            .toBuffer();

        console.log(`Image compressed (new size: ${compressedImageBuffer.length} bytes). Converting to Base64.`);
        return `data:image/jpeg;base64,${compressedImageBuffer.toString('base64')}`;
    } catch (error) {
        console.error("Error in ConvertImageUrlToBase64:", error.message);
        // Include URL in error for easier debugging
        throw new Error(`Failed to process image from URL (${imageUrl}): ${error.message}`);
    }
}
// --- End Helper Function ---

export async function POST(req) {
    console.log("API route /api/ai-logo-model hit");
    let userCreditsFromDB = null; // To store credits fetched from DB

    try { // Wrap the initial part to catch req.json() errors
        const { prompt: metaPrompt, email, title, desc, type = 'Free' } = await req.json(); // Default type to Free
        let base64ImageWithMime = '';
        let generatedImagePrompt = '';

        // --- Initial Validation and Configuration Checks ---
        if (!metaPrompt || !email || !title || !desc) {
            console.error("Validation Error: Missing required fields", { metaPrompt: !!metaPrompt, email: !!email, title: !!title, desc: !!desc });
            return NextResponse.json({ error: "Missing required fields: prompt, email, title, desc" }, { status: 400 });
        }
        if (!AILogoPrompt) {
            console.error("Server Error: AILogoPrompt (Gemini Chat) failed to initialize.");
            return NextResponse.json({ error: "Server configuration error: AI prompt generator not ready." }, { status: 500 });
        }
        if (type === 'Free' && !HUGGING_FACE_TOKEN) {
            console.error("Server Error: HUGGING_FACE_API_TOKEN is not set for Free generation.");
            return NextResponse.json({ error: "Server configuration error: Missing Hugging Face token." }, { status: 500 });
        }
        if (type !== 'Free' && !REPLICATE_TOKEN) {
            console.error("Server Error: REPLICATE_API_TOKEN is not set for Paid generation.");
            return NextResponse.json({ error: "Server configuration error: Missing Replicate token." }, { status: 500 });
        }

        // --- Credit Check for Paid Tier (Fetch from DB for accuracy) ---
        if (type !== 'Free') {
            console.log(`Paid tier request for user ${email}. Fetching credits...`);
            try {
                const userDocRef = doc(db, 'users', email);
                const userDocSnap = await getDoc(userDocRef);

                if (!userDocSnap.exists()) {
                    console.error(`User document not found for email: ${email}`);
                    return NextResponse.json({ error: "User profile not found." }, { status: 404 });
                }

                userCreditsFromDB = Number(userDocSnap.data()?.credits ?? 0); // Get credits from DB
                console.log(`User ${email} has ${userCreditsFromDB} credits.`);

                if (userCreditsFromDB <= 0) {
                    console.warn(`Attempted paid generation for user ${email} with insufficient DB credits (${userCreditsFromDB})`);
                    return NextResponse.json({ error: "Insufficient credits for this operation." }, { status: 402 }); // 402 Payment Required
                }
            } catch (dbError) {
                console.error(`Firestore Error: Failed to fetch credits for user ${email}:`, dbError);
                return NextResponse.json({ error: "Failed to verify user credits. Please try again." }, { status: 500 });
            }
        }
        // --- End Validation and Credit Check ---

        // --- Main Generation Logic ---
        try { // Wrap the core generation process
            // === STEP 1: Generate Image Prompt via Gemini ===
            console.log("Step 1: Generating image prompt via Gemini...");
            try {
                const AiPromptResult = await AILogoPrompt.sendMessage(metaPrompt);

                if (AiPromptResult.response.promptFeedback?.blockReason) {
                    const blockReason = AiPromptResult.response.promptFeedback.blockReason;
                    console.error('Gemini Prompt Generation Blocked:', blockReason);
                    return NextResponse.json({ error: `AI prompt generation blocked: ${blockReason}` }, { status: 400 });
                }

                const responseText = AiPromptResult.response.text();
                // Added try-catch for JSON parsing
                let parsedResponse;
                try {
                    parsedResponse = JSON.parse(responseText.replace(/^```json\s*|```$/gs, "").trim());
                } catch (parseError) {
                     console.error("Gemini response parsing error:", parseError);
                     console.error("Original Gemini response text:", responseText);
                     throw new Error("AI failed to generate a valid image prompt format.");
                }


                if (!parsedResponse.prompt || typeof parsedResponse.prompt !== 'string' || parsedResponse.prompt.trim() === '') {
                    console.error("Gemini response missing or invalid 'prompt' field:", responseText);
                    throw new Error("AI failed to generate a valid image prompt text.");
                }
                generatedImagePrompt = parsedResponse.prompt;
                console.log("Generated Image Prompt:", generatedImagePrompt.substring(0, 100) + "...");
            } catch (geminiError) {
                console.error("Error calling Gemini or parsing response:", geminiError);
                let message = `Failed to generate image prompt via AI: ${geminiError.message || 'Unknown error'}`;
                 // Add more specific error mapping if needed
                throw new Error(message); // Propagate error
            }

            // === STEP 2: Generate Logo Image (Conditional) ===
            console.log(`Step 2: Generating image via ${type === 'Free' ? 'Hugging Face' : 'Replicate'}...`);

            if (type === 'Free') {
                // --- Hugging Face Call ---
                try {
                    const response = await axios.post(
                        HF_MODEL_URL,
                        { inputs: generatedImagePrompt },
                        {
                            headers: { Authorization: `Bearer ${HUGGING_FACE_TOKEN}`, "Content-Type": "application/json" },
                            responseType: "arraybuffer",
                            timeout: 55000 // ~55 seconds timeout for HF
                        }
                    );

                    // HF might return 200 OK with an error message (e.g., model loading)
                    // We need to check the content type before assuming it's an image
                    const contentType = response.headers['content-type'];
                    console.log(`Hugging Face Response Status: ${response.status}, Content-Type: ${contentType}`);

                    if (response.status !== 200 || !contentType?.startsWith('image/')) {
                        let errorDetail = `Status code ${response.status}. Content-Type: ${contentType}.`;
                        let errorBody = "";
                         // Try to read error message if not an image
                        if (response.data && !contentType?.startsWith('image/')) {
                            try { errorBody = Buffer.from(response.data).toString(); } catch {}
                        }
                        console.error(`Hugging Face API returned non-image response: ${errorDetail}`, errorBody);

                        // Handle specific HF errors like model loading
                        if (errorBody.includes("currently loading") || response.status === 503) {
                             throw new Error("Image generation model (Free) is loading/unavailable. Please try again shortly.");
                        }
                        throw new Error(`Hugging Face image generation failed: ${errorDetail} ${errorBody}`);
                    }

                    if (!response.data || response.data.byteLength === 0) throw new Error("Hugging Face returned empty image data.");

                    const buffer = Buffer.from(response.data);
                    // Use the actual content type returned
                    base64ImageWithMime = `data:${contentType};base64,${buffer.toString("base64")}`;
                    console.log(`Hugging Face image generated (size: ${buffer.length} bytes).`);

                } catch (hfError) {
                    // Log detailed Axios error if available
                    if (axios.isAxiosError(hfError)) {
                        console.error("Axios Error during Hugging Face call:", {
                             message: hfError.message,
                             code: hfError.code,
                             status: hfError.response?.status,
                             data: hfError.response?.data ? Buffer.from(hfError.response.data).toString() : 'N/A' // Try converting error data buffer to string
                        });
                    } else {
                        console.error("Error during Hugging Face API call:", hfError.message);
                    }

                    let userMessage = hfError.message; // Start with the original error message
                    // Refine user message based on known conditions
                    if (userMessage.includes("loading/unavailable")) {
                        userMessage = "Image generation model (Free) is loading/unavailable. Please try again shortly.";
                    } else if (hfError.response?.status === 401) {
                        userMessage = "Image generation (Free) auth failed. Check HF Token.";
                    } else if (hfError.response?.status === 429) {
                         userMessage = "Image generation (Free) rate limit reached.";
                    } else if (!hfError.response && (hfError.code === 'ECONNABORTED' || hfError.message.includes('timeout'))) {
                         userMessage = "Image generation (Free) timed out. Please try again.";
                    } else if (!hfError.response) {
                         userMessage = `Network error connecting to Hugging Face.`;
                    } else {
                         // Keep potentially useful info from original message for other errors
                         userMessage = `Failed to generate image (Free): ${hfError.message}`;
                    }
                    throw new Error(userMessage); // Propagate refined error
                }
            } else {
                // --- Replicate Call ---
                try {
                    const replicate = new Replicate({ auth: REPLICATE_TOKEN });
                    console.log(`Calling Replicate model: ${REPLICATE_MODEL_ENDPOINT}`);
                    const output = await replicate.run(
                        REPLICATE_MODEL_ENDPOINT,
                        {
                            input: {
                                prompt: generatedImagePrompt,
                                num_outputs: 1,
                                aspect_ratio: "1:1",
                                output_format: "png", // Replicate usually gives PNG URL
                                guidance_scale: 3.5,
                                output_quality: 80,
                                num_inference_steps: 8
                            }
                        }
                    );
                    console.log("Replicate Output URL(s):", output);

                    if (!Array.isArray(output) || output.length === 0 || !output[0]) {
                        console.error("Replicate did not return a valid image URL array:", output);
                        throw new Error("Replicate did not return a valid image URL.");
                    }
                    // Process the first URL, assuming PNG from Replicate, converted to JPEG base64
                    base64ImageWithMime = await ConvertImageUrlToBase64(output[0]);
                    console.log("Replicate image generated and processed.");

                } catch (replicateError) {
                    console.error("Error during Replicate API call or processing:", replicateError);
                    let userMessage = `Failed to generate image (Paid): ${replicateError.message || 'Unknown Replicate error'}`;
                    // Add specific Replicate error checks if needed (e.g., rate limits, billing)
                    throw new Error(userMessage);
                }
            }

            // === STEP 3: Save to Firebase (if image generation was successful) ===
            if (!base64ImageWithMime) {
                throw new Error("Image generation process completed without producing image data.");
            }
            console.log("Step 3: Saving generated logo to Firestore...");
            try {
                const timestamp = Date.now();
                const logoId = timestamp.toString();
                await setDoc(doc(db, "users", email, "logos", logoId), {
                    image: base64ImageWithMime,
                    title: title,
                    desc: desc,
                    id: timestamp,
                    promptUsed: generatedImagePrompt,
                    modelUsed: type === 'Free' ? HF_MODEL_URL : REPLICATE_MODEL_ENDPOINT,
                    createdAt: new Date().toISOString(),
                });
                console.log(`Logo ${logoId} saved successfully to Firestore for user ${email}.`);
            } catch (firestoreError) {
                console.error("Firestore Error: Failed to save logo:", firestoreError);
                // Log error but proceed - user got the image, saving is secondary
            }

            // === STEP 4: Deduct Credits (if paid type and successful generation) ===
            if (type !== 'Free') {
                 // Use credits fetched from DB for calculation
                 console.log(`Step 4: Updating credits for paid generation. User: ${email}, DB Credits Before: ${userCreditsFromDB}`);
                 try {
                     const docRef = doc(db, 'users', email);
                     // Calculate new credits based on DB value
                     const newCredits = Math.max(0, userCreditsFromDB - 1);

                    await updateDoc(docRef, { credits: newCredits });
                    console.log(`Credits updated successfully to ${newCredits} for user ${email}.`);

                 } catch (creditError) {
                     console.error("Firestore Error: Failed to update user credits:", creditError);
                     // Log error, maybe notify admin, but don't fail the request for the user
                 }
            }

            // === STEP 5: Return Success Response ===
            console.log("API call successful. Returning image.");
            return NextResponse.json({ image: base64ImageWithMime });

        } catch (error) { // Catch errors propagated from any step within the core logic
            console.error("API Error during generation process:", error.message);
            // Return the specific error message caught
            return NextResponse.json({ error: error.message || "An unknown server error occurred during generation." }, { status: 500 });
        }

    } catch (initialError) { // Catch errors from req.json() or initial validation phase
         console.error("API Error during initial request processing:", initialError);
         return NextResponse.json({ error: initialError.message || "Server error processing request." }, { status: 500 });
    }
}