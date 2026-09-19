'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MODES } from '@forge/core';
import { apiFetch } from '../../lib/api';

interface Project {
  id: number;
  title: string;
  mode: string;
  brief: string;
  created_at: string;
}

export default function ProjectsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const presetMode = searchParams.get('mode');

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(!!presetMode);
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState(presetMode || MODES[0].id);
  const [brief, setBrief] = useState('');
  const [creating, setCreating] = useState(false);

  const backendToken = (session as any)?.backendToken;

  useEffect(() => {
    if (status !== 'authenticated' || !backendToken) return;
    apiFetch('/projects/', backendToken)
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, backendToken]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!backendToken) return;
    setCreating(true);
    try {
      const project = await apiFetch('/projects/', backendToken, {
        method: 'POST',
        body: JSON.stringify({ title, mode, brief }),
      });
      router.push(`/projects/${project.id}`);
    } catch (e: any) {
      setError(e.message);
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl tracking-widest text-eden-cream">Your Projects</h1>
        <button onClick={() => setShowForm((v) => !v)} className="eden-btn text-sm">
          {showForm ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="eden-panel p-6 space-y-4">
          {error && <p className="text-sm text-eden-sunset">{error}</p>}
          <input
            type="text"
            placeholder="Project title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-eden-sage/20 bg-eden-deep/60 px-4 py-2 text-eden-cream focus:outline-none focus:border-eden-gold/50"
            required
          />
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="w-full rounded-lg border border-eden-sage/20 bg-eden-deep/60 px-4 py-2 text-eden-cream focus:outline-none focus:border-eden-gold/50"
          >
            {MODES.map((m) => (
              <option key={m.id} value={m.id}>{m.icon} {m.label}</option>
            ))}
          </select>
          <textarea
            placeholder="What are you building? (optional brief)"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-eden-sage/20 bg-eden-deep/60 px-4 py-2 text-eden-cream focus:outline-none focus:border-eden-gold/50"
          />
          <button type="submit" disabled={creating} className="eden-btn-primary disabled:opacity-50">
            {creating ? 'Creating…' : 'Create Project'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-eden-sage">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="text-eden-stone">No projects yet — start one above.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projects.map((p) => {
            const modeInfo = MODES.find((m) => m.id === p.mode);
            return (
              <a key={p.id} href={`/projects/${p.id}`} className="eden-panel p-6 hover:border-eden-gold/40 transition">
                <div className="text-2xl mb-2">{modeInfo?.icon || '✦'}</div>
                <div className="font-serif text-eden-gold-light text-lg">{p.title}</div>
                <div className="text-xs text-eden-stone mt-1 capitalize">{modeInfo?.label || p.mode}</div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
