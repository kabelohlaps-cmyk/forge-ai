import { EdenTree } from '@forge/ui';
import { getVerseOfTheDay } from '@forge/core';
export default function Home(){
  const verse=getVerseOfTheDay();
  return (<div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
    <div className="relative">
      <div className="absolute inset-0 -z-10 animate-glow"><div className="h-64 w-64 rounded-full bg-eden-gold/20 blur-3xl mx-auto"/></div>
      <EdenTree size={160} className="animate-sway"/>
    </div>
    <h1 className="mt-8 font-serif text-5xl tracking-widest text-eden-cream">FORGE</h1>
    <p className="font-serif italic text-eden-gold text-lg mt-1">design in Eden</p>
    <div className="eden-divider w-40 my-8"/>
    <p className="max-w-md font-serif italic text-eden-gold-light/90 text-lg leading-relaxed">"{verse.text}"</p>
    <p className="mt-3 text-xs tracking-widest text-eden-stone">{verse.reference}</p>
    <div className="mt-10 flex gap-3">
      <a href="/projects" className="eden-btn-primary">Enter the Garden</a>
      <a href="/modes" className="eden-btn">Browse Modes</a>
    </div>
  </div>);
}
