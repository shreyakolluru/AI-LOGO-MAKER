"use client"
import React from 'react';
import Image from 'next/image';
import { UserButton, useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';

export default function Header() {
  // Fix: Add parentheses to call the useUser hook
  const { user } = useUser();

  return (
    <div className='px-10 lg:px-32 xl:px-48 2xl:px-56 flex justify-between items-center py-4'>
      <Image src={'/logo.svg'} alt="logo" width={180} height={100} />
      <div className='flex gap-3 items-center'>
        {user ? (
          // Show only Dashboard button for signed-in users
          <Button>Dashboard</Button>
        ) : (
          // Show Get Started button for non-signed-in users
          <button className="bg-primary text-white px-4 py-2 rounded-md">Get Started</button>
        )}
        <UserButton />
      </div>
    </div>
  );
}
  