"use client"
import React, { useEffect } from 'react';
import HeadingDescription from './HeadingDescription';
import Lookup from '@/app/_data/Lookup';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useUser } from '@clerk/nextjs';
import { SignInButton } from '@clerk/clerk-react';

function PricingModel({formData}){
    const {user}=useUser();
    useEffect(()=>{
        if(formData?.title&&typeof window!=='undefined')
        {
            localStorage.setItem('formData',JSON.stringify (formData))
        }
            
            
        },[formData])
    return(
        <div>
            <HeadingDescription
            title={Lookup.LogoPricingModelTitle}
            description={Lookup.LogoPricingModelDesc}
            />
            <div className='grid grid-cols-2 md:grid-cols-2 gap-10 mt-10'>
                {Lookup.pricingOption.map((pricing,index)=>(
                    <div key={index} className='flex flex-col items-center p-5 border rounded-xl'>
                        <Image src={pricing.icon} alt={pricing.title} width={60} height={60}/>
                        <h2 className='font-medium text-2xl'>{pricing.title}</h2>
                        <div>
                            {pricing.features.map((features, index)=>(
                                <h2 className='text-lg mt-3' key={index}>{features}</h2>
                            ))}
                        </div>
                        {!user ? (
  <SignInButton 
    mode="modal"
    redirectUrl={`/generate-logo?type=${encodeURIComponent(pricing.title)}`}
  >
    <Button className='mt-5'>{pricing.button}</Button>
  </SignInButton>
) : (
  // If user is already signed in, use a direct link button
  <Button 
    className='mt-5' 
    onClick={() => window.location.href = `/generate-logo?type=${encodeURIComponent(pricing.title)}`}
  >
    {pricing.button}
  </Button>
)}
                        
                    </div>
                ))}
            </div>

        </div>
    )
}

export default PricingModel;