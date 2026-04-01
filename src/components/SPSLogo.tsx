import React from 'react';

interface SPSLogoProps {
  className?: string;
  variant?: 'icon' | 'wide' | 'stack' | 'horizontal' | 'vertical';
  showText?: boolean;
}

export default function SPSLogo({ className = "h-12", variant = 'wide', showText = true }: SPSLogoProps) {
  // Map legacy variants to new ones
  const effectiveVariant = variant === 'horizontal' ? 'wide' : variant === 'vertical' ? 'stack' : variant;

  if (effectiveVariant === 'icon') {
    return (
      <img 
        src="/logos/sps-logo-icon.png" 
        alt="SPS Corner Icon" 
        className={`${className} object-contain`}
        referrerPolicy="no-referrer"
      />
    );
  }

  if (effectiveVariant === 'stack') {
    return (
      <img 
        src="/logos/sps-logo-stack.png" 
        alt="SPS Corner Stacked Logo" 
        className={`${className} object-contain`}
        referrerPolicy="no-referrer"
      />
    );
  }

  // Default to wide/horizontal
  return (
    <img 
      src="/logos/sps-logo-wide.png" 
      alt="SPS Corner Wide Logo" 
      className={`${className} object-contain`}
      referrerPolicy="no-referrer"
    />
  );
}
