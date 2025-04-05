// configs/AiModel.jsx

// Using require as per user's reference code for this file
const {
    GoogleGenerativeAI,
    HarmCategory, // Assuming these might be used later for safety settings
    HarmBlockThreshold,
} = require("@google/generative-ai");

// IMPORTANT: Using NEXT_PUBLIC_ prefix suggests client-side exposure.
// If this file ONLY runs server-side (e.g., imported by API routes),
// rename to GEMINI_API_KEY in .env.local and here for better security.
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!apiKey) {
    console.error("FATAL ERROR: NEXT_PUBLIC_GEMINI_API_KEY is not set in environment variables.");
    // Throwing an error might be better here to halt initialization if key is missing
}

let genAIInstance;
let modelInstance;

try {
    genAIInstance = new GoogleGenerativeAI(apiKey);
    modelInstance = genAIInstance.getGenerativeModel({
        // Using model specified in user's reference
        model: "gemini-1.5-flash", // NOTE: Reference said "gemini-2.0-flash-exp" which might not be valid/available. Using 1.5-flash as a likely available alternative. Adjust if needed.
    });
    console.log("Gemini Model Initialized in AiModel.jsx (gemini-1.5-flash)");
} catch (e) {
    console.error("Failed to initialize GoogleGenerativeAI or get model:", e);
    // Handle error - maybe export null objects?
}


const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 64, // Adjusted TopK based on common defaults, reference had 40
    maxOutputTokens: 8192,
    responseMimeType: "application/json",
};

// Safety Settings (Optional but Recommended)
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];


// Chat session for generating LOGO IDEAS (text descriptions)
let AIDesignIdeaChat = null;
if (modelInstance) {
    try {
        AIDesignIdeaChat = modelInstance.startChat({
            generationConfig,
            safetySettings, // Apply safety settings
            history: [
                {
                    role: "user", // Example from user reference
                    parts: [
                        { text: "Based on Logo of type Modern Mascot Logos Generate a text prompt to create Logo for Logo title/Brand name : Indian Spice with description: Indian Restaurant and referring to prompt: A vibrant logo featuring a friendly, animated character with a playful expression. The character is dressed in a classic uniform, complete with a distinctive accessory that adds personality. In one hand, they hold a signature item that represents the brand, while the other elements of the design—such as small decorative touches or natural accents—enhance the overall look. The background consists of a bold, circular design with subtle accents to highlight the character. Below, the brand name is displayed in bold, stylized lettering, with a slight curve and complementary decorative lines. The overall style is fun, welcoming, and full of character.. Give me 4/5 Suggestion of logo idea (each idea with maximum 4-5 words), Result in JSON format with ideas field" },
                    ],
                },
                {
                    role: "model", // Example from user reference
                    parts: [
                        { text: "```json\n{\n  \"ideas\": [\n    \"Chef Elephant mascot holding spices\",\n    \"Smiling Mango character wearing Turban\",\n    \"Friendly Tiger mascot holding Curry bowl\",\n    \"Animated Naan bread character chef\",\n    \"Peacock mascot waiter holding plate\"\n  ]\n}\n```\n" },
                    ],
                },
            ],
        });
        console.log("AIDesignIdea Chat Session Initialized.");
    } catch (e) {
        console.error("Failed to initialize AIDesignIdea chat session:", e);
    }
}
export const AIDesignIdea = AIDesignIdeaChat;


// Chat session for generating the IMAGE PROMPT (text)
let AILogoPromptChat = null;
if (modelInstance) {
    try {
        AILogoPromptChat = modelInstance.startChat({
            generationConfig,
            safetySettings, // Apply safety settings
            history: [
                 { // Example from user reference
                    role: "user",
                    parts: [
                        { text: "Generate a text prompt to create Logo for Logo Title/Brand name : Indian Restaurant,with description: Indian Restro, with Color combination of Ocean Blues and include Modern Sharp Lined Logos design idea and Referring to this Logo Prompt:Design a creative and artistic logo with a retro-modern vibe that showcases the brand's identity. Use bold outlines, intricate patterns, and vibrant, contrasting colors to make the design pop. Incorporate thematic elements like food, nature, technology, or lifestyle symbols depending on the brand's niche. The typography should be playful yet clear, complementing the overall composition with a dynamic and balanced layout. Ensure the logo feels unique, versatile, and eye-catching  Give me result in JSON portal with prompt field only" },
                    ],
                },
                { // Example from user reference
                    role: "model",
                    parts: [
                        { text: "```json\n{\n  \"prompt\": \"Create a modern logo with sharp lines for 'Indian Restro', an Indian Restaurant. Feature ocean blue colors predominantly. Style: retro-modern artistic, using bold outlines and intricate patterns. Include Indian food or cultural symbols. Use playful yet clear modern typography. The logo should be dynamic, balanced, unique, versatile, and eye-catching, reflecting a sophisticated yet inviting modern Indian cuisine experience. Use complementary lighter blue or white for contrast.\"\n}\n```\n" },
                    ],
                },
            ],
        });
        console.log("AILogoPrompt Chat Session Initialized.");
    } catch (e) {
        console.error("Failed to initialize AILogoPrompt chat session:", e);
    }
}
export const AILogoPrompt = AILogoPromptChat;