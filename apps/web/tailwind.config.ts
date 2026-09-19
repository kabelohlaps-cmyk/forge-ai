import type { Config } from 'tailwindcss';
export default {
  content:['./app/**/*.{ts,tsx}','./components/**/*.{ts,tsx}','../../packages/ui/src/**/*.{ts,tsx}'],
  theme:{extend:{
    colors:{eden:{deep:'#0B2B1A',moss:'#1E4D2B',leaf:'#3E7B47',sage:'#A8C79A',gold:'#D4A64B','gold-light':'#F0D48A',cream:'#F5EFE0',sky:'#8FBFD9',sunset:'#E08A5C',stone:'#6B6357'}},
    fontFamily:{serif:['"Cormorant Garamond"','Georgia','serif'],sans:['Inter','system-ui','sans-serif'],mono:['"JetBrains Mono"','monospace']},
    keyframes:{sway:{'0%,100%':{transform:'translateY(0) rotate(-1deg)'},'50%':{transform:'translateY(-6px) rotate(1deg)'}},glow:{'0%,100%':{opacity:'0.4'},'50%':{opacity:'0.8'}}},
    animation:{sway:'sway 6s ease-in-out infinite',glow:'glow 4s ease-in-out infinite'},
  }},
  plugins:[],
} satisfies Config;
