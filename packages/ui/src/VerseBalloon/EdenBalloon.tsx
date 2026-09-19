export function EdenBalloon({size=64}:{size?:number}){
  return (<svg width={size} height={size*1.4} viewBox="0 0 64 90" fill="none" aria-hidden>
    <defs>
      <linearGradient id="bb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F0D48A"/><stop offset="55%" stopColor="#D4A64B"/><stop offset="100%" stopColor="#E08A5C"/></linearGradient>
      <linearGradient id="bs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8FBFD9"/><stop offset="100%" stopColor="#4F8B57"/></linearGradient>
    </defs>
    <path d="M32 4 C 14 4, 6 18, 6 32 C 6 46, 18 54, 28 58 L 36 58 C 46 54, 58 46, 58 32 C 58 18, 50 4, 32 4 Z" fill="url(#bb)" stroke="#3A352C" strokeWidth="1"/>
    <path d="M22 6 C 18 20, 18 44, 24 58" stroke="url(#bs)" strokeWidth="2" fill="none" opacity="0.9"/>
    <path d="M42 6 C 46 20, 46 44, 40 58" stroke="url(#bs)" strokeWidth="2" fill="none" opacity="0.9"/>
    <path d="M32 4 L 32 58" stroke="#3A352C" strokeWidth="0.6" opacity="0.5"/>
    <path d="M28 58 L 27 68 M36 58 L 37 68" stroke="#6B6357" strokeWidth="0.8"/>
    <rect x="24" y="68" width="16" height="10" rx="2" fill="#6B6357" stroke="#3A352C" strokeWidth="0.8"/>
    <rect x="29" y="65" width="6" height="4" rx="1" fill="#F5EFE0" stroke="#D4A64B" strokeWidth="0.5"/>
    <ellipse cx="32" cy="80" rx="10" ry="3" fill="#F0D48A" opacity="0.25"/>
  </svg>);
}
