import React from 'react';
import LogoIcon from './ui/logo-icon.png';
import LogoUtama from './ui/logo-utama.png';
import LogoLandscape from './ui/logo-landscape.png';

interface SPSLogoProps {
  className?: string;
  variant?: 'icon' | 'wide' | 'stack' | 'horizontal' | 'vertical';
  showText?: boolean;
}

export default function SPSLogo({ className = "h-12", variant = 'wide', showText = true }: SPSLogoProps) {
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

  return (
    <img 
      src={src} 
      alt="SPS Corner Logo" 
      className={`${className} object-contain`}
      referrerPolicy="no-referrer"
    />
  );
}
