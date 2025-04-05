import React,{useState} from 'react';
import HeadingDescription from './HeadingDescription';
import Lookup from '@/app/_data/Lookup';
import Image from 'next/image';
import LogoDesign from "@/app/_data/LogoDesign";

function LogoDesigns({onHandleInputChange,formData}) {
    const[selectedOption,setSelectedOption]=useState(formData?.design?.title)
  return (
    <div className='my-10'>
        <HeadingDescription
        title={Lookup.LogoDesignTitle}
        description={Lookup.LogoDesignDesc}/>
        <div className='grid grid-cols-2 md:grid-cols-3 gap-10'>
            {LogoDesign.map((design,index)=>(
                <div key={index} 
                onClick={()=> {setSelectedOption(design.title);
                    onHandleInputChange(design)
                }}
                className={`p-1 hover:border-2 border-primary rounded-xl cursor cursor-pointer ${selectedOption==design.title&&'border-2 rounded-xl border-primary'}`}>
                    <Image src={design.image} alt={design.title} width={300} height={200}
                    className='w-full rounded-lg h-[250px] object-cover'
                    />

                </div>
            ))}
        </div>
    </div>
  );
}

export default LogoDesigns;