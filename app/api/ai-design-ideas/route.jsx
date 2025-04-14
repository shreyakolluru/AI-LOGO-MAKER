// In /api/generate-ideas/route.js
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini with your API key
const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

export async function POST(request) {
  try {
    // 1. Log the API key to ensure it's loaded
    if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
      console.error("API Key Missing: NEXT_PUBLIC_GEMINI_API_KEY is not set.");
      throw new Error("API key is not configured.");
    }
    console.log("API Key Loaded:", process.env.NEXT_PUBLIC_GEMINI_API_KEY);

    // 2. Get user input from request
    const { prompt, industry, style, logoTitle, logoDesc } = await request.json();
    console.log("Request Body:", { prompt, industry, style, logoTitle, logoDesc });

    // 3. Validate input
    if (!prompt || !logoTitle || !logoDesc) {
      return NextResponse.json(
        { error: "Prompt, logoTitle, and logoDesc are required" },
        { status: 400 }
      );
    }

    // 4. Initialize Gemini model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // 5. Construct dynamic prompt using all user inputs
    const fullPrompt = `
  You are a creative logo designer. Generate exactly 6 unique logo design ideas for a company named "${logoTitle}" with the following description: "${logoDesc}".
  The company operates in the ${industry || "tech"} industry, and the preferred style is ${style || "modern minimalist"}.

  **IMPORTANT FORMATTING RULES:**
  - You MUST return ONLY a bulleted list.
  - Each item in the list MUST start with a hyphen and a space ('- ').
  - There MUST be exactly 6 items in the list.
  - Each idea MUST be concise, between 5 and 8 words long.
  - Do NOT include any introductory text, concluding text, explanations, or numbering.

  **Example of CORRECT output format:**
  - Abstract geometric mountain silhouette concept
  - Friendly mascot owl wearing glasses logo
  - Minimalist wave icon in circle design
  - Vintage letterpress style wordmark idea
  - Hand-drawn leaf motif emblem design
  - Tech circuit board pattern mark

  Generate the 6 ideas now based on the inputs provided.
`;
    console.log("Full Prompt:", fullPrompt);

    // 6. Generate content with a single attempt
    let ideas = [];
    try {
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;

      // *** ADD THIS CHECK ***
      if (response.promptFeedback?.blockReason) {
        console.error('Gemini Response Blocked:', response.promptFeedback.blockReason);
        // Return a specific error for blocking
        return NextResponse.json(
          { error: `Content generation blocked: ${response.promptFeedback.blockReason}` },
          { status: 400 }
        );
      }
      // *** END ADDED CHECK ***

      const text = response.text();
      console.log('Gemini Response:', text);

      // 7. Parse response into array
      ideas = text
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^-/, '').trim());

      // 8. Validate the number of ideas
      if (ideas.length !== 6) {
        throw new Error(`Expected 6 ideas, got ${ideas.length}`);
      }
    } catch (error) {
      console.error('Gemini API Error:', error.message);
      throw new Error("Failed to generate ideas: " + error.message);
    }

    // 9. Return formatted response
    return NextResponse.json({
      ideas,
      metadata: {
        model: "gemini-1.5-pro",
        generated_at: new Date().toISOString(),
      },
    }, { status: 200 });

  } catch (error) {
    console.error("Final Error:", error.message, error.stack);
    return NextResponse.json(
      { 
        ideas: [], // Return an empty array instead of static ideas
        error: "Failed to generate logo ideas: " + error.message,
      },
      { status: 500 }
    );
  }
}