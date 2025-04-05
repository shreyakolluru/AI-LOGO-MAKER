"use client";
import React, { useState, useEffect } from "react";
import HeadingDescription from "./HeadingDescription";
import Lookup from "@/app/_data/Lookup";


export default function LogoDesc({ onHandleInputChange,formData }) {
  
  return (
    <div className="my-10">
      <HeadingDescription 
        title={Lookup?.LogoDescTitle} 
        description={Lookup?.LogoDescDesc} 
      />
      <input
        type="text"
        placeholder={Lookup.InputTitlePlaceholder} 
        className="p-4 border rounded-lg w-full shadow-md mt-5"
        value={formData?.desc || ""} 
        onChange={(e) => {
          onHandleInputChange(e.target.value);
        }}
      />
    </div>
  );
}


