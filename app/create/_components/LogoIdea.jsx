"use client";
import React, { useEffect, useState } from 'react';
import HeadingDescription from './HeadingDescription';
import Lookup from '@/app/_data/Lookup';
import axios from 'axios';
import Prompt from '@/app/_data/Prompt';
import { Loader2Icon } from 'lucide-react';

function LogoIdea({ onHandleInputChange, formData, onNext, onPrev }) {
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOption, setSelectedOption] = useState(formData?.idea || "");

  useEffect(() => {
    generateLogoDesignIdea();
  }, []);

  const generateLogoDesignIdea = async () => {
    setLoading(true);
    setError(null);
    try {
      const PROMPT = Prompt.DESIGN_IDEA_PROMPT
        .replace('{logoType}', formData?.design?.title || "tech")
        .replace('{logoTitle}', formData?.title || "Untitled")
        .replace('{logoDesc}', formData?.desc || "A modern brand")
        .replace('{logoPrompt}', formData?.design?.prompt || "modern minimalist");

      const result = await axios.post('/api/ai-design-ideas', {
        prompt: PROMPT,
        industry: formData?.design?.title || "tech",
        style: formData?.design?.prompt || "modern minimalist",
        logoTitle: formData?.title || "Untitled", // Add logoTitle
        logoDesc: formData?.desc || "A modern brand", // Add logoDesc
      });
      console.log("API Response:", result.data);

      if (result.data.ideas.length === 0) {
        throw new Error(result.data.error || "No ideas generated");
      }

      setIdeas(result.data.ideas);
    } catch (error) {
      console.error("Error generating logo ideas:", error.message);
      console.error("Error details:", error.response?.data);
      setError(error.response?.data?.error || "Failed to generate logo ideas. Please try again.");
      setIdeas([]); // Clear ideas on error
    } finally {
      setLoading(false);
    }
  };

  const handleIdeaSelect = (idea) => {
    setSelectedOption(idea);
    onHandleInputChange(idea);
  };

  return (
    <div className="my-10">
      <HeadingDescription
        title={Lookup?.LogoIdeaTitle || "Select Your Design Idea"}
        description={Lookup?.LogoIdeaDesc || "Choose a design style that aligns with your vision, or skip to receive a random suggestion."}
      />
      
      {loading ? (
        <div className="flex justify-center my-8">
          <Loader2Icon className="animate-spin text-pink-600 h-10 w-10" />
        </div>
      ) : error ? (
        <div className="text-red-600 text-center my-8">
          {error}
          <button
            className="ml-2 text-pink-600 underline"
            onClick={generateLogoDesignIdea}
          >
            Retry
          </button>
        </div>
      ) : ideas.length === 0 ? (
        <div className="text-gray-600 text-center my-8">
          No ideas generated. Please try again.
          <button
            className="ml-2 text-pink-600 underline"
            onClick={generateLogoDesignIdea}
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="mt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ideas.map((idea, index) => (
              <div
                key={index}
                className={`p-6 border-2 rounded-xl cursor-pointer text-center transition-all
                  ${selectedOption === idea ? 'border-pink-600 bg-pink-50' : 'border-gray-200 hover:border-pink-300'}`}
                onClick={() => handleIdeaSelect(idea)}
              >
                <div className="font-medium text-gray-800">{idea}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LogoIdea;