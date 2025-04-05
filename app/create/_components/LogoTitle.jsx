"use client";
import React, { useState, useEffect } from "react";
import HeadingDescription from "./HeadingDescription";
import Lookup from "@/app/_data/Lookup";
import { useSearchParams } from "next/navigation";

export default function LogoTitle({ onHandleInputChange }) {
    const searchParam = useSearchParams();
    const [title, setTitle] = useState(
      searchParam?.get("title") || "" // Initialize with URL param or empty string
    );
  
    // More robust URL param handling
    useEffect(() => {
      const titleFromURL = searchParam?.get("title");
      if (titleFromURL) {
        setTitle(titleFromURL);
      }
    }, [searchParam]);
  

  return (
    <div className="my-10">
      <HeadingDescription 
        title={Lookup?.LogoTitle || "Logo Title"} 
        description={Lookup?.LogoTitleDesc || "Enter a description for your logo"} 
      />
      <input 
        type="text" 
        placeholder={Lookup?.InputTitlePlaceholder || "Enter your logo name"} 
        className="p-4 border rounded-lg w-full shadow-md mt-5"
        value={title || ""}
        onChange={(e) => {
          setTitle(e.target.value);
          onHandleInputChange(e.target.value);
        }}
      />
    </div>
  );
}
