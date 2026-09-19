import { MODES } from '@forge/core';
export default function ModesPage(){
  return (<div>
    <h1 className="font-serif text-4xl tracking-widest text-eden-cream mb-8">The Garden of Modes</h1>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {MODES.map((m)=>(<a key={m.id} href={`/projects?mode=${m.id}`} className="eden-panel p-6 hover:border-eden-gold/40 transition group">
        <div className="text-4xl mb-3 group-hover:scale-110 transition">{m.icon}</div>
        <div className="font-serif text-eden-gold-light text-lg">{m.label}</div>
        <div className="text-xs text-eden-stone mt-1 capitalize">{m.family}</div>
        <div className="text-[10px] uppercase tracking-widest text-eden-sage/60 mt-3">{m.tier} tier</div>
      </a>))}
    </div>
  </div>);
}
