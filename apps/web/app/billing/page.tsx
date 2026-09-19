'use client';
import { useState } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { PLANS, PlanTier } from '@forge/core';
const CID=process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!;
export default function BillingPage(){
  const [selectedTier,setSelectedTier]=useState<PlanTier>(PlanTier.CREATOR);
  const [error,setError]=useState<string|null>(null);
  return (<PayPalScriptProvider options={{clientId:CID,vault:true,intent:'subscription',components:'buttons',currency:'USD'}}>
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="font-serif text-4xl tracking-widest text-eden-cream mb-8">Choose Your Path</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {Object.entries(PLANS).map(([tier,cfg])=>(<button key={tier} onClick={()=>setSelectedTier(tier as PlanTier)} className={`eden-panel p-6 text-left transition ${selectedTier===tier?'border-eden-gold':'hover:border-eden-sage/40'}`}>
          <h3 className="text-xl font-serif capitalize text-eden-gold-light">{tier}</h3>
          <p className="text-3xl font-bold mt-2 text-eden-cream">${cfg.price_usd}<span className="text-sm font-normal text-eden-stone">/mo</span></p>
          <ul className="mt-4 space-y-1 text-sm text-eden-sage">{cfg.features.map(f=><li key={f}>✓ {f}</li>)}</ul>
        </button>))}
      </div>
      {error&&<div className="mb-4 p-3 bg-eden-sunset/20 text-eden-sunset rounded-lg text-sm">{error}</div>}
      <PayPalButtons style={{layout:'vertical',shape:'rect',label:'subscribe',color:'gold'}}
        createSubscription={async()=>{
          const res=await fetch('/api/billing/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tier:selectedTier})});
          if(!res.ok){const e=await res.json();setError(e.detail||'Failed');throw new Error('fail');}
          const {subscription_id}=await res.json();return subscription_id;
        }}
        onApprove={async(d)=>{console.log('approved',d.subscriptionID);window.location.href='/dashboard?billing=success';}}
        onError={(e)=>{setError('PayPal error.');console.error(e);}}/>
    </div>
  </PayPalScriptProvider>);
}
