import React from 'react';

interface EdenTreeProps {
  size?: number;
  variant?: 'detailed' | 'icon';
  className?: string;
}

/**
 * The Eden tree mark, in two weights:
 *  - "detailed": layered canopy, glow, gradient trunk with root arcs.
 *    Use for splash screens, marketing pages, the login screen -- anywhere
 *    it renders large enough (120px+) for the leaf clusters to read clearly.
 *  - "icon": flattened silhouette, flat fills, no gradients or fine detail.
 *    Use for the nav bar, app icon, and favicon -- anywhere under ~48px,
 *    where the detailed version's leaf clusters would just turn to mud.
 */
export function EdenTree({ size = 48, variant = 'detailed', className = '' }: EdenTreeProps) {
  if (variant === 'icon') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        className={className}
        role="img"
        aria-label="FORGE AI"
      >
        <path
          d="M22 50 C 16 50, 12 44, 14 38 M42 50 C 48 50, 52 44, 50 38"
          stroke="#D4A64B"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M32 52 C 31 44, 30 38, 30 32 C 30 29, 31 26, 32 23 C 33 26, 34 29, 34 32 C 34 38, 33 44, 32 52 Z"
          fill="#D4A64B"
        />
        <ellipse cx="32" cy="20" rx="17" ry="12" fill="#3E7B47" />
        <ellipse cx="20" cy="25" rx="9" ry="7" fill="#4F8B57" />
        <ellipse cx="44" cy="25" rx="9" ry="7" fill="#4F8B57" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size * (240 / 220)}
      viewBox="0 0 220 240"
      fill="none"
      className={className}
      role="img"
      aria-label="FORGE AI"
    >
      <defs>
        <linearGradient id="eden-trunk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0D48A" />
          <stop offset="100%" stopColor="#B8863A" />
        </linearGradient>
        <radialGradient id="eden-glow" cx="50%" cy="35%" r="55%">
          <stop offset="0%" stopColor="#F0D48A" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#F0D48A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="110" cy="110" r="95" fill="url(#eden-glow)" />
      <path
        d="M60 195 C 40 195, 28 175, 32 150 M160 195 C 180 195, 192 175, 188 150"
        stroke="url(#eden-trunk)"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M110 200 C 108 175, 106 155, 108 138 C 109 128, 110 118, 110 105 C 110 118, 111 128, 112 138 C 114 155, 112 175, 110 200 Z"
        fill="url(#eden-trunk)"
      />
      <path
        d="M110 150 C 98 140, 84 136, 70 138 M110 150 C 122 140, 136 136, 150 138 M110 130 C 100 122, 88 118, 76 120 M110 130 C 120 122, 132 118, 144 120 M110 112 C 104 106, 96 103, 88 104 M110 112 C 116 106, 124 103, 132 104"
        stroke="url(#eden-trunk)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
      <g fill="#3E7B47">
        <ellipse cx="60" cy="90" rx="30" ry="22" />
        <ellipse cx="90" cy="65" rx="28" ry="24" />
        <ellipse cx="130" cy="65" rx="28" ry="24" />
        <ellipse cx="160" cy="90" rx="30" ry="22" />
        <ellipse cx="110" cy="55" rx="26" ry="20" />
      </g>
      <g fill="#5EA469">
        <ellipse cx="72" cy="80" rx="18" ry="14" />
        <ellipse cx="148" cy="80" rx="18" ry="14" />
        <ellipse cx="110" cy="68" rx="20" ry="15" />
      </g>
      <g fill="#8FCB93">
        <circle cx="65" cy="72" r="4" />
        <circle cx="85" cy="58" r="4" />
        <circle cx="110" cy="50" r="4.5" />
        <circle cx="135" cy="58" r="4" />
        <circle cx="155" cy="72" r="4" />
        <circle cx="50" cy="95" r="3.5" />
        <circle cx="170" cy="95" r="3.5" />
        <circle cx="75" cy="95" r="3.5" />
        <circle cx="145" cy="95" r="3.5" />
      </g>
    </svg>
  );
}

export function EdenTreeLockup({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <EdenTree size={size} variant="icon" />
      <div className="flex flex-col leading-none">
        <span className="font-serif tracking-widest text-eden-cream" style={{ fontSize: size * 0.55 }}>
          FORGE
        </span>
        <span className="font-serif italic tracking-wider text-eden-gold" style={{ fontSize: size * 0.32 }}>
          in Eden
        </span>
      </div>
    </div>
  );
}
