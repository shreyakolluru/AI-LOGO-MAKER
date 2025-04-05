// app/api/ai-logo-model/route.jsx
import { AILogoPrompt } from "@/configs/AiModel"; // Gemini chat session for text prompt
import { db } from "../../../configs/FirebaseConfigs"; // Firestore ADMIN instance
import axios from "axios";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { NextResponse } from "next/server";
import Replicate from "replicate";
import sharp from "sharp"; // For image processing with Replicate result

export const maxDuration = 60; // Timeout for the API route

// Define constants
const HF_MODEL_URL = 'https://api-inference.huggingface.co/models/strangerzonehf/Flux-Midjourney-Mix2-LoRA';
const REPLICATE_MODEL_ENDPOINT = "bytedance/hyper-flux-8step:81946b1e09b256c543b35f37333a30d0d02ee2cd8c4f77cd915873a1ca622bad";
const HUGGING_FACE_TOKEN = process.env.HUGGING_FACE_API_TOKEN;
const REPLICATE_TOKEN = process.env.REPLICATE_API_TOKEN;

// --- Helper Function to Convert Replicate Image URL to Base64 ---
async function ConvertImageUrlToBase64(imageUrl) {
    try {
        console.log("Fetching image from URL:", imageUrl);
        // Fetch image data from the URL returned by Replicate
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });

        if (response.status !== 200 || !response.data || response.data.byteLength === 0) {
            throw new Error(`Failed to fetch image from Replicate URL (status: ${response.status})`);
        }

        console.log(`Image fetched (size: ${response.data.byteLength} bytes). Compressing...`);
        // Compress and resize using sharp
        const compressedImageBuffer = await sharp(response.data)
            .resize({ width: 700 }) // Resize for consistency/size reduction
            .jpeg({ quality: 85 }) // Compress as JPEG (good for photos/complex images)
            .toBuffer();

        console.log(`Image compressed (new size: ${compressedImageBuffer.length} bytes). Converting to Base64.`);
        // Convert compressed buffer to Base64 Data URI
        return `data:image/jpeg;base64,${compressedImageBuffer.toString('base64')}`;
    } catch (error) {
        console.error("Error in ConvertImageUrlToBase64:", error);
        throw new Error(`Failed to process image from URL: ${error.message}`); // Rethrow to be caught by main handler
    }
}
// --- End Helper Function ---


export async function POST(req) {
    console.log("API route /api/ai-logo-model hit");

    const { prompt: metaPrompt, email, title, desc, type = 'Free', userCredits } = await req.json(); // Default type to Free
    let base64ImageWithMime = '';
    let generatedImagePrompt = '';

    // --- Initial Validation and Configuration Checks ---
    if (!metaPrompt || !email || !title || !desc) {
        return NextResponse.json({ error: "Missing required fields: prompt, email, title, desc" }, { status: 400 });
    }
    if (!AILogoPrompt) {
        console.error("AILogoPrompt (Gemini Chat) failed to initialize.");
        return NextResponse.json({ error: "Server configuration error: AI prompt generator not ready." }, { status: 500 });
    }
    if (type === 'Free' && !HUGGING_FACE_TOKEN) {
        console.error("HUGGING_FACE_API_TOKEN is not set for Free generation.");
        return NextResponse.json({ error: "Server configuration error: Missing Hugging Face token." }, { status: 500 });
    }
    if (type !== 'Free' && !REPLICATE_TOKEN) {
        console.error("REPLICATE_API_TOKEN is not set for Paid generation.");
        return NextResponse.json({ error: "Server configuration error: Missing Replicate token." }, { status: 500 });
    }
    if (type !== 'Free' && (userCredits === undefined || userCredits === null || Number(userCredits) <= 0)) {
        console.warn(`Attempted paid generation for user ${email} with insufficient credits (${userCredits})`);
        return NextResponse.json({ error: "Insufficient credits for this operation." }, { status: 402 }); // 402 Payment Required
    }
    // --- End Validation ---

    try {
        // === STEP 1: Generate Image Prompt via Gemini ===
        console.log("Step 1: Generating image prompt via Gemini...");
        try {
            const AiPromptResult = await AILogoPrompt.sendMessage(metaPrompt);

             // Add check for blocked response
             if (AiPromptResult.response.promptFeedback?.blockReason) {
                console.error('Gemini Prompt Generation Blocked:', AiPromptResult.response.promptFeedback.blockReason);
                throw new Error(`AI prompt generation failed due to safety settings: ${AiPromptResult.response.promptFeedback.blockReason}`);
             }

            const responseText = AiPromptResult.response.text();
            const parsedResponse = JSON.parse(responseText.replace(/^```json\s*|```$/gs, "").trim()); // Clean potential markdown

            if (!parsedResponse.prompt || typeof parsedResponse.prompt !== 'string' || parsedResponse.prompt.trim() === '') {
                console.error("Gemini response missing or invalid 'prompt' field:", responseText);
                throw new Error("AI failed to generate a valid image prompt text.");
            }
            generatedImagePrompt = parsedResponse.prompt;
            console.log("Generated Image Prompt:", generatedImagePrompt.substring(0, 100) + "...");
        } catch (geminiError) {
            console.error("Error calling Gemini or parsing response:", geminiError);
            let message = `Failed to generate image prompt via AI: ${geminiError.message || 'Unknown error'}`;
            if (geminiError.message?.includes('[429')) message = "AI prompt generation rate limit hit.";
            if (geminiError.message?.includes('[401') || geminiError.message?.includes('[403')) message = "AI prompt generation auth error. Check API Key.";
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
                        headers: { Authorization: `Bearer ${HUGGING_FACE_TOKEN}`,"Content-Type": "application/json", },
                        responseType: "arraybuffer",
                    }
                );

                if (response.status !== 200) {
                     let errorDetail = `Status code ${response.status}`;
                     console.error(`Hugging Face API returned non-200 status: ${response.status}`);
                     throw new Error(`Hugging Face image generation failed: ${errorDetail}`);
                }
                if (!response.data || response.data.byteLength === 0) throw new Error("Hugging Face returned empty image data.");

                const buffer = Buffer.from(response.data);
                const base64Image = buffer.toString("base64");
                const contentType = response.headers['content-type'] || 'image/png';
                base64ImageWithMime = `data:${contentType};base64,${base64Image}`;
                console.log(`Hugging Face image generated (size: ${buffer.length} bytes).`);
            } catch (hfError) {
                console.error("Error during Hugging Face API call:", hfError.response?.status, hfError.message);
                let userMessage = `Failed to generate image (Free): ${hfError.message}`;
                if (hfError.response?.status === 429) userMessage = "Image generation (Free) rate limit reached.";
                if (hfError.response?.status === 401) userMessage = "Image generation (Free) auth failed.";
                if (hfError.response?.status === 503) userMessage = "Image generation model (Free) is loading/unavailable.";
                if (axios.isAxiosError(hfError) && !hfError.response) userMessage = `Network error connecting to Hugging Face.`;
                throw new Error(userMessage); // Propagate error
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
                            aspect_ratio: "1:1", // As per reference code
                            output_format: "png", // As per reference code
                            guidance_scale: 3.5, // As per reference code
                            output_quality: 80, // As per reference code
                            num_inference_steps: 8 // As per reference code
                        }
                    }
                );
                console.log("Replicate Output URL(s):", output);

                // Assuming output is an array of URLs, take the first one
                if (!Array.isArray(output) || output.length === 0 || !output[0]) {
                    throw new Error("Replicate did not return a valid image URL.");
                }
                base64ImageWithMime = await ConvertImageUrlToBase64(output[0]); // Process the URL
                console.log("Replicate image generated and processed.");

            } catch (replicateError) {
                console.error("Error during Replicate API call or processing:", replicateError);
                // Replicate errors often have useful messages
                let userMessage = `Failed to generate image (Paid): ${replicateError.message || 'Unknown Replicate error'}`;
                // Check for common Replicate status codes if available in error details
                throw new Error(userMessage); // Propagate error
            }
        }

        // === STEP 3: Save to Firebase (if image generation was successful) ===
        if (!base64ImageWithMime) {
             // This should ideally be caught earlier, but acts as a final check
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
                id: timestamp, // Use timestamp as ID and field
                promptUsed: generatedImagePrompt, // Store the prompt used for the image
                modelUsed: type === 'Free' ? HF_MODEL_URL : REPLICATE_MODEL_ENDPOINT,
                createdAt: new Date().toISOString(),
            });
            console.log(`Logo ${logoId} saved successfully to Firestore for user ${email}.`);
        } catch (firestoreError) {
            console.error("Firestore Error: Failed to save logo:", firestoreError);
            // Log the error but don't fail the *entire* request just for this
            // The user still received the image
        }

        // === STEP 4: Deduct Credits (if paid type) ===
        if (type !== 'Free') {
             console.log(`Step 4: Updating credits for paid generation. User: ${email}, Current: ${userCredits}`);
             try {
                 const docRef = doc(db, 'users', email);
                 const newCredits = Number(userCredits) - 1; // Already validated credits > 0

                await updateDoc(docRef, { credits: newCredits });
                console.log(`Credits updated successfully to ${newCredits} for user ${email}.`);

             } catch (creditError) {
                 console.error("Firestore Error: Failed to update user credits:", creditError);
                 // Log error, but don't fail request
             }
        }

        // === STEP 5: Return Success Response ===
        console.log("API call successful. Returning image.");
        return NextResponse.json({ image: base64ImageWithMime });

    } catch (error) { // Catch errors propagated from any step
        console.error("API Error in POST /api/ai-logo-model:", error.message);
        // Return the specific error message caught
        return NextResponse.json({ error: error.message || "An unknown server error occurred." }, { status: 500 });
    }
}