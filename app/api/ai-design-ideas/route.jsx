import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini with your API key
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

export async function POST(request) {
  try {
    // 1. Log the API key to ensure it's loaded
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error("API Key Missing: GOOGLE_GENERATIVE_AI_API_KEY is not set.");
      throw new Error("API key is not configured.");
    }
    console.log("API Key Loaded:", process.env.GOOGLE_GENERATIVE_AI_API_KEY);

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
      Format requirements:
      - Return ONLY a bulleted list with exactly 6 items
      - No numbering or additional text
      - Each idea should be 5-8 words
      Example:
      - Abstract geometric mountain silhouette
      - Mascot owl with glasses
    `;
    console.log("Full Prompt:", fullPrompt);

    // 6. Generate content with a single attempt
    let ideas = [];
    try {
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
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