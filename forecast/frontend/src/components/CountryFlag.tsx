'use client';

import React from 'react';
import { Globe } from 'lucide-react';

interface CountryFlagProps {
  code?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  xs: { w: 14, h: 10, rounded: 'rounded-[2px]' },
  sm: { w: 18, h: 12, rounded: 'rounded-xs' },
  md: { w: 22, h: 15, rounded: 'rounded-xs' },
  lg: { w: 32, h: 22, rounded: 'rounded-md' }
};

export default function CountryFlag({ code = 'ALL', size = 'sm', className = '' }: CountryFlagProps) {
  const norm = (code || '').toUpperCase().trim();
  const { w, h, rounded } = SIZES[size] || SIZES.sm;

  if (norm === 'ALL' || norm === 'TODOS' || norm === 'GLOBAL' || norm === '') {
    const iconSize = size === 'xs' ? 12 : size === 'sm' ? 14 : size === 'md' ? 16 : 24;
    return <Globe size={iconSize} className={`text-blue-500 shrink-0 ${className}`} />;
  }

  // Argentina
  if (norm === 'AR' || norm === 'ARG' || norm.includes('ARGENTINA')) {
    return (
      <span className={`inline-flex shrink-0 overflow-hidden shadow-2xs border border-slate-300/80 ${rounded} ${className}`} style={{ width: w, height: h }}>
        <svg viewBox="0 0 640 480" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <path fill="#74acdf" d="M0 0h640v480H0z"/>
          <path fill="#ffffff" d="M0 160h640v160H0z"/>
          <circle fill="#f6b40e" stroke="#855114" strokeWidth="6" cx="320" cy="240" r="38"/>
          <circle fill="#855114" cx="310" cy="235" r="4"/>
          <circle fill="#855114" cx="330" cy="235" r="4"/>
          <path fill="none" stroke="#855114" strokeWidth="4" d="M312 250c4 4 12 4 16 0"/>
        </svg>
      </span>
    );
  }

  // Chile
  if (norm === 'CL' || norm === 'CHL' || norm.includes('CHILE')) {
    return (
      <span className={`inline-flex shrink-0 overflow-hidden shadow-2xs border border-slate-300/80 ${rounded} ${className}`} style={{ width: w, height: h }}>
        <svg viewBox="0 0 640 480" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <path fill="#d52b1e" d="M0 240h640v240H0z"/>
          <path fill="#ffffff" d="M240 0h400v240H240z"/>
          <path fill="#0039a6" d="M0 0h240v240H0z"/>
          <polygon fill="#ffffff" points="120,48 136,98 188,98 146,128 162,178 120,148 78,178 94,128 52,98 104,98"/>
        </svg>
      </span>
    );
  }

  // Colombia
  if (norm === 'CO' || norm === 'COL' || norm.includes('COLOMBIA')) {
    return (
      <span className={`inline-flex shrink-0 overflow-hidden shadow-2xs border border-slate-300/80 ${rounded} ${className}`} style={{ width: w, height: h }}>
        <svg viewBox="0 0 640 480" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <path fill="#fcd116" d="M0 0h640v240H0z"/>
          <path fill="#003893" d="M0 240h640v120H0z"/>
          <path fill="#ce1126" d="M0 360h640v120H0z"/>
        </svg>
      </span>
    );
  }

  // México
  if (norm === 'MX' || norm === 'MEX' || norm.includes('MEXICO') || norm.includes('MÉXICO')) {
    return (
      <span className={`inline-flex shrink-0 overflow-hidden shadow-2xs border border-slate-300/80 ${rounded} ${className}`} style={{ width: w, height: h }}>
        <svg viewBox="0 0 640 480" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <path fill="#006847" d="M0 0h213.3v480H0z"/>
          <path fill="#ffffff" d="M213.3 0h213.4v480H213.3z"/>
          <path fill="#ce1126" d="M426.7 0H640v480H426.7z"/>
          <circle fill="#8B5A2B" cx="320" cy="240" r="26"/>
          <path fill="#556b2f" d="M305 245c10-15 20-15 30 0-5 8-25 8-30 0z"/>
        </svg>
      </span>
    );
  }

  // Estados Unidos (USA)
  if (norm === 'US' || norm === 'USA' || norm.includes('ESTADOS UNIDOS')) {
    return (
      <span className={`inline-flex shrink-0 overflow-hidden shadow-2xs border border-slate-300/80 ${rounded} ${className}`} style={{ width: w, height: h }}>
        <svg viewBox="0 0 640 480" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <g fill="#bf0a30">
            <path d="M0 0h640v37H0zm0 74h640v37H0zm0 74h640v37H0zm0 74h640v37H0zm0 74h640v37H0zm0 74h640v37H0zm0 74h640v36H0z"/>
          </g>
          <path fill="#ffffff" d="M0 37h640v37H0zm0 74h640v37H0zm0 74h640v37H0zm0 74h640v37H0zm0 74h640v37H0zm0 74h640v37H0z"/>
          <path fill="#002868" d="M0 0h260v259H0z"/>
          <circle fill="#ffffff" cx="50" cy="40" r="8"/>
          <circle fill="#ffffff" cx="100" cy="40" r="8"/>
          <circle fill="#ffffff" cx="150" cy="40" r="8"/>
          <circle fill="#ffffff" cx="200" cy="40" r="8"/>
          <circle fill="#ffffff" cx="75" cy="85" r="8"/>
          <circle fill="#ffffff" cx="125" cy="85" r="8"/>
          <circle fill="#ffffff" cx="175" cy="85" r="8"/>
          <circle fill="#ffffff" cx="50" cy="130" r="8"/>
          <circle fill="#ffffff" cx="100" cy="130" r="8"/>
          <circle fill="#ffffff" cx="150" cy="130" r="8"/>
          <circle fill="#ffffff" cx="200" cy="130" r="8"/>
          <circle fill="#ffffff" cx="75" cy="175" r="8"/>
          <circle fill="#ffffff" cx="125" cy="175" r="8"/>
          <circle fill="#ffffff" cx="175" cy="175" r="8"/>
          <circle fill="#ffffff" cx="50" cy="220" r="8"/>
          <circle fill="#ffffff" cx="100" cy="220" r="8"/>
          <circle fill="#ffffff" cx="150" cy="220" r="8"/>
          <circle fill="#ffffff" cx="200" cy="220" r="8"/>
        </svg>
      </span>
    );
  }

  // Perú
  if (norm === 'PE' || norm === 'PER' || norm.includes('PERU') || norm.includes('PERÚ')) {
    return (
      <span className={`inline-flex shrink-0 overflow-hidden shadow-2xs border border-slate-300/80 ${rounded} ${className}`} style={{ width: w, height: h }}>
        <svg viewBox="0 0 640 480" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <path fill="#d91023" d="M0 0h213.3v480H0zM426.7 0H640v480H426.7z"/>
          <path fill="#ffffff" d="M213.3 0h213.4v480H213.3z"/>
        </svg>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center justify-center font-bold text-[9px] text-slate-700 bg-slate-100 border border-slate-300 ${rounded} ${className}`} style={{ width: w, height: h }}>
      {norm.slice(0, 2)}
    </span>
  );
}
