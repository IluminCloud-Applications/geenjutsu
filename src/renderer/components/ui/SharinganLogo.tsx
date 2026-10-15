import React from 'react';
import { clsx } from 'clsx';
import { AppIcon } from './BrandLogo';

export { AppIcon };

interface SharinganLogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
  spinning?: boolean;
}

export const SharinganLogo: React.FC<SharinganLogoProps> = ({
  size = 42,
  className = '',
  glow = true,
  spinning = false,
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer subtle glow */}
      {glow && (
        <div
          className={clsx(
            'absolute inset-0 rounded-full pointer-events-none transition-all duration-500',
            spinning
              ? 'bg-red-600/70 blur-xl scale-150 animate-pulse'
              : 'bg-red-600/30 blur-md animate-pulse'
          )}
          style={{ transform: spinning ? 'scale(1.4)' : 'scale(1.15)' }}
        />
      )}

      {/* SVG Sharingan (3-tomoe) */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={clsx(
          'relative z-10 transition-all',
          spinning
            ? 'animate-sharingan-spin drop-shadow-[0_0_16px_rgba(239,68,68,0.95)]'
            : 'transition-transform duration-700 hover:rotate-180 cursor-pointer drop-shadow-[0_0_8px_rgba(220,38,38,0.7)]'
        )}
      >
        <defs>
          <radialGradient id="irisGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff2a2a" />
            <stop offset="45%" stopColor="#d90429" />
            <stop offset="85%" stopColor="#8d0801" />
            <stop offset="100%" stopColor="#2b0505" />
          </radialGradient>
          <filter id="shadowGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#000" floodOpacity="0.8" />
          </filter>
        </defs>

        {/* Outer Dark Ring */}
        <circle cx="50" cy="50" r="48" fill="#150202" stroke="#450a0a" strokeWidth="2.5" />

        {/* Red Iris */}
        <circle cx="50" cy="50" r="44" fill="url(#irisGrad)" />

        {/* Tomoe Track Ring */}
        <circle
          cx="50"
          cy="50"
          r="26"
          fill="none"
          stroke="#110202"
          strokeWidth="2.2"
          strokeOpacity="0.85"
        />

        {/* Center Pupil */}
        <circle cx="50" cy="50" r="9" fill="#080202" />

        {/* 3 Tomoe Marks */}
        {/* Tomoe 1 (Top) */}
        <g transform="translate(50, 50) rotate(0) translate(-50, -50)">
          <path
            d="M 50 24 C 54.5 24 57 28 55 31.5 C 53 35 48.5 35 47 31 C 45 26 47 24 50 24 Z"
            fill="#090101"
          />
          <path
            d="M 52.5 31 C 55 37 53 43 45 42 C 48 40 50 37 49 32 Z"
            fill="#090101"
          />
        </g>

        {/* Tomoe 2 (Bottom Right - 120deg) */}
        <g transform="translate(50, 50) rotate(120) translate(-50, -50)">
          <path
            d="M 50 24 C 54.5 24 57 28 55 31.5 C 53 35 48.5 35 47 31 C 45 26 47 24 50 24 Z"
            fill="#090101"
          />
          <path
            d="M 52.5 31 C 55 37 53 43 45 42 C 48 40 50 37 49 32 Z"
            fill="#090101"
          />
        </g>

        {/* Tomoe 3 (Bottom Left - 240deg) */}
        <g transform="translate(50, 50) rotate(240) translate(-50, -50)">
          <path
            d="M 50 24 C 54.5 24 57 28 55 31.5 C 53 35 48.5 35 47 31 C 45 26 47 24 50 24 Z"
            fill="#090101"
          />
          <path
            d="M 52.5 31 C 55 37 53 43 45 42 C 48 40 50 37 49 32 Z"
            fill="#090101"
          />
        </g>
      </svg>
    </div>
  );
};
