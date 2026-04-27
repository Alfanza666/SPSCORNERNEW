import React, { useState } from 'react';
import LogoIcon from './ui/logo-icon.png';
import LogoUtama from './ui/logo-utama.png';
import LogoLandscape from './ui/logo-landscape.png';
import { ShieldCheck } from 'lucide-react';

interface SPSLogoProps {
  className?: string;
  variant?: 'icon' | 'wide' | 'stack' | 'horizontal' | 'vertical';
  showText?: boolean;
}

export default function SPSLogo({ className = "h-12", variant = 'wide', showText = true }: SPSLogoProps) {
  const [hasError, setHasError] = useState(false);
  // Map legacy variants to new ones
  const effectiveVariant = variant === 'horizontal' ? 'wide' : variant === 'vertical' ? 'stack' : variant;

  let src = LogoUtama;
  if (effectiveVariant === 'icon') {
    src = LogoIcon;
  } else if (effectiveVariant === 'wide') {
    src = LogoLandscape;
  } else if (effectiveVariant === 'stack') {
    src = LogoUtama;
  }

  if (hasError) {
    return (
      <div className={`${className} flex items-center justify-center font-black text-amber-600 gap-2 overflow-hidden`}>
        <ShieldCheck className="w-auto h-full max-h-8" />
        {effectiveVariant !== 'icon' && (
          <div className="flex flex-col items-start leading-none justify-center">
            <span className="text-xl -mb-1 tracking-tighter">SPS</span>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Corner</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt="SPS Corner Logo" 
      className={`${className} object-contain`}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
    />
  );
}
