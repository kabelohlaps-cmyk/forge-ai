'use client';
import { motion } from 'framer-motion';
import { EdenTree } from '@forge/ui';

interface Message {
  role: 'user' | 'agent';
  content: string;
  image_data_uri?: string;
  imageLoading?: boolean;
}

export function ChatPanel({
  messages,
  onSend,
  onGenerateImage,
  onOpenSketch,
}: {
  messages: Message[];
  onSend: (t: string) => void;
  onGenerateImage?: (index: number) => void;
  onOpenSketch?: (index: number) => void;
}) {
  return (
    <div className="eden-panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-eden-sage/10 px-4 py-3">
        <EdenTree size={22} variant="icon" />
        <h2 className="font-serif tracking-wider text-eden-gold-light text-sm">The Gardener</h2>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-eden-stone">Forging</span>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className={m.role === 'user' ? 'text-right' : ''}
          >
            {m.role === 'agent' && (
              <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-eden-sage/70">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-eden-gold animate-glow" />
                Gardener
              </div>
            )}
            <div
              className={
                m.role === 'user'
                  ? 'inline-block max-w-[85%] rounded-2xl rounded-tr-sm bg-eden-leaf/40 px-4 py-2 text-eden-cream'
                  : 'max-w-[92%] font-serif text-lg leading-relaxed text-eden-cream/95'
              }
            >
              {m.content}
            </div>

            {m.role === 'agent' && m.image_data_uri && (
              <img
                src={m.image_data_uri}
                alt="Generated design concept"
                className="mt-3 max-w-[92%] rounded-xl border border-eden-gold/20 shadow-lg"
              />
            )}

            {m.role === 'agent' && !m.image_data_uri && (onGenerateImage || onOpenSketch) && (
              <div className="mt-2 flex gap-2">
                {onGenerateImage && (
                  <button
                    onClick={() => onGenerateImage(i)}
                    disabled={m.imageLoading}
                    className="eden-btn text-xs disabled:opacity-50"
                  >
                    {m.imageLoading ? 'Rendering…' : '✦ Generate Image'}
                  </button>
                )}
                {onOpenSketch && (
                  <button
                    onClick={() => onOpenSketch(i)}
                    disabled={m.imageLoading}
                    className="eden-btn text-xs disabled:opacity-50"
                  >
                    ✎ Sketch &amp; Refine
                  </button>
                )}
              </div>
            )}
          </motion.div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem('prompt') as HTMLInputElement;
          if (input.value.trim()) {
            onSend(input.value.trim());
            input.value = '';
          }
        }}
        className="border-t border-eden-sage/10 p-3"
      >
        <div className="flex items-center gap-2 rounded-full border border-eden-sage/20 bg-eden-deep/60 px-4 py-2 focus-within:border-eden-gold/50 transition">
          <input
            name="prompt"
            autoComplete="off"
            placeholder="Describe what you want to create…"
            className="flex-1 bg-transparent text-eden-cream placeholder:text-eden-stone focus:outline-none"
          />
          <button type="submit" className="eden-btn text-xs">Forge</button>
        </div>
      </form>
    </div>
  );
}
