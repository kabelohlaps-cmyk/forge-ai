'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getVerseOfTheDay, type Verse } from '@forge/core';
import { EdenBalloon } from './EdenBalloon';
export function VerseBalloon({oncePerSession=true,driftDuration=38000}:{oncePerSession?:boolean;driftDuration?:number}){
  const [verse,setVerse]=useState<Verse|null>(null);
  const [visible,setVisible]=useState(false);
  const [modalOpen,setModalOpen]=useState(false);
  useEffect(()=>{
    const k='forge-eden-balloon-shown';
    if(oncePerSession&&sessionStorage.getItem(k))return;
    const t=setTimeout(()=>{setVerse(getVerseOfTheDay());setVisible(true);sessionStorage.setItem(k,'1');},4500);
    return ()=>clearTimeout(t);
  },[oncePerSession]);
  useEffect(()=>{ if(!visible)return; const h=setTimeout(()=>setVisible(false),driftDuration); return ()=>clearTimeout(h); },[visible,driftDuration]);
  if(!verse)return null;
  return (<>
    <AnimatePresence>
      {visible&&(<motion.div className="pointer-events-none fixed top-16 left-0 z-40 w-full" initial={{x:'-15vw',opacity:0}} animate={{x:'115vw',opacity:1}} exit={{opacity:0}} transition={{x:{duration:driftDuration/1000,ease:'linear'},opacity:{duration:1.2}}}>
        <button onClick={()=>{setModalOpen(true);setVisible(false);}} className="pointer-events-auto flex flex-col items-center gap-1 group" aria-label={`Verse: ${verse.reference}`}>
          <motion.div animate={{y:[0,-6,0]}} transition={{duration:4,repeat:Infinity,ease:'easeInOut'}}><EdenBalloon size={64}/></motion.div>
          <div className="rounded-full bg-eden-deep/85 backdrop-blur-sm border border-eden-gold/40 px-3 py-1 shadow-lg group-hover:border-eden-gold transition">
            <span className="font-serif italic text-eden-gold-light text-xs tracking-wide">{verse.reference}</span>
          </div>
        </button>
      </motion.div>)}
    </AnimatePresence>
    <VerseModal verse={verse} open={modalOpen} onClose={()=>setModalOpen(false)}/>
  </>);
}
function VerseModal({verse,open,onClose}:{verse:Verse;open:boolean;onClose:()=>void}){
  if(!open)return null;
  return (<AnimatePresence>
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-6" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}>
      <div className="absolute inset-0 bg-eden-deep/80 backdrop-blur-sm"/>
      <motion.div className="relative max-w-lg w-full rounded-2xl border border-eden-gold/40 bg-eden-moss/95 p-8 shadow-2xl" initial={{scale:0.9,y:20}} animate={{scale:1,y:0}} exit={{scale:0.9,y:20}} onClick={(e)=>e.stopPropagation()}>
        <LeafCorner className="absolute top-2 left-2"/>
        <LeafCorner className="absolute top-2 right-2 scale-x-[-1]"/>
        <LeafCorner className="absolute bottom-2 left-2 scale-y-[-1]"/>
        <LeafCorner className="absolute bottom-2 right-2 scale-[-1]"/>
        <p className="font-serif text-2xl leading-relaxed text-eden-cream text-center italic">"{verse.text}"</p>
        <p className="mt-6 text-center font-serif tracking-widest text-eden-gold text-sm">— {verse.reference} —</p>
        <button onClick={onClose} className="mt-8 mx-auto block rounded-full border border-eden-gold/50 px-6 py-2 text-eden-gold-light hover:bg-eden-gold/10 transition text-sm">Amen</button>
      </motion.div>
    </motion.div>
  </AnimatePresence>);
}
function LeafCorner({className=''}:{className?:string}){
  return (<svg width="32" height="32" viewBox="0 0 32 32" className={className} aria-hidden>
    <path d="M2 2 C 10 4, 16 10, 18 18 C 10 16, 4 10, 2 2 Z" fill="#3E7B47" stroke="#A8C79A" strokeWidth="0.8"/>
    <path d="M2 2 L 18 18" stroke="#A8C79A" strokeWidth="0.6"/>
  </svg>);
}
