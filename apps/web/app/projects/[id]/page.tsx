'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { ChatPanel } from '../../../components/ChatPanel';
import SketchCanvas from '../../../components/SketchCanvas';
import { SKETCH_TEMPLATES } from '../../../lib/sketchTemplates';
import { SKETCH_PARTS } from '../../../lib/sketchParts';
import { ApiError, apiFetch } from '../../../lib/api';

interface Project {
  id: number;
  title: string;
  mode: string;
  brief: string;
}

interface Message {
  role: 'user' | 'agent';
  content: string;
  image_data_uri?: string;
  imageLoading?: boolean;
  failed?: boolean; // a user message the agent never answered
}

// An action that failed while the chat stays usable. 403 means a plan limit.
interface ActionError {
  message: string;
  planLimit: boolean;
}

function toActionError(e: unknown): ActionError {
  return {
    message: e instanceof Error ? e.message : 'Something went wrong. Please try again.',
    planLimit: e instanceof ApiError && e.status === 403,
  };
}

export default function ProjectChatPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const projectId = params.id as string;
  const backendToken = (session as any)?.backendToken;

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  // loadError replaces the page (nothing to show); actionError is a banner over the chat.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<ActionError | null>(null);

  const [sketchIndex, setSketchIndex] = useState<number | null>(null);
  const [templateId, setTemplateId] = useState('none');

  useEffect(() => {
    if (status !== 'authenticated' || !backendToken) return;
    Promise.all([
      apiFetch(`/projects/${projectId}`, backendToken),
      apiFetch(`/projects/${projectId}/messages`, backendToken),
    ])
      .then(([proj, hist]) => {
        setProject(proj);
        setMessages(hist.messages);
      })
      .catch((e) => setLoadError(e.message));
  }, [status, backendToken, projectId]);

  // retryIndex: resend a failed user message in place instead of adding a new one.
  async function handleSend(text: string, retryIndex?: number) {
    if (!backendToken || !project || sending) return;
    setActionError(null);
    // Safe to take from the current state: `sending` allows one send at a time.
    const index = retryIndex ?? messages.length;
    setMessages((prev) =>
      retryIndex !== undefined
        ? prev.map((m, i) => (i === retryIndex ? { ...m, failed: false } : m))
        : [...prev, { role: 'user', content: text }]
    );
    setSending(true);
    try {
      const res = await apiFetch('/agent/invoke', backendToken, {
        method: 'POST',
        body: JSON.stringify({ project_id: project.id, mode: project.mode, prompt: text }),
      });
      setMessages((prev) => {
        const next = [...prev];
        next.splice(index + 1, 0, { role: 'agent', content: res.reply });
        return next;
      });
    } catch (e) {
      setActionError(toActionError(e));
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, failed: true } : m)));
    } finally {
      setSending(false);
    }
  }

  function handleRetry(index: number) {
    const msg = messages[index];
    if (msg?.role === 'user' && msg.failed) handleSend(msg.content, index);
  }

  async function handleGenerateImage(index: number) {
    if (!backendToken || !project) return;
    const msg = messages[index];
    if (!msg || msg.role !== 'agent') return;

    setActionError(null);
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, imageLoading: true } : m)));
    try {
      const res = await apiFetch('/agent/generate-image', backendToken, {
        method: 'POST',
        body: JSON.stringify({ project_id: project.id, mode: project.mode, prompt: msg.content }),
      });
      setMessages((prev) =>
        prev.map((m, i) => (i === index ? { ...m, imageLoading: false, image_data_uri: res.image_data_uri } : m))
      );
    } catch (e) {
      setActionError(toActionError(e));
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, imageLoading: false } : m)));
    }
  }

  function handleOpenSketch(index: number) {
    setTemplateId('none');
    setSketchIndex(index);
  }

  function handleCancelSketch() {
    setSketchIndex(null);
  }async function handleSketchSave(dataUri: string) {
    if (!backendToken || !project || sketchIndex === null) return;
    const index = sketchIndex;
    const msg = messages[index];
    setSketchIndex(null);
    if (!msg) return;

    setActionError(null);
    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, imageLoading: true } : m)));
    try {
      const res = await apiFetch('/agent/generate-image', backendToken, {
        method: 'POST',
        body: JSON.stringify({
          project_id: project.id,
          mode: project.mode,
          prompt: msg.content,
          sketch_data_uri: dataUri,
        }),
      });
      setMessages((prev) =>
        prev.map((m, i) => (i === index ? { ...m, imageLoading: false, image_data_uri: res.image_data_uri } : m))
      );
    } catch (e) {
      setActionError(toActionError(e));
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, imageLoading: false } : m)));
    }
  }

  if (loadError)
    return (
      <div className="space-y-2">
        <p className="text-eden-sunset">{loadError}</p>
        <a href="/projects" className="text-sm text-eden-gold-light hover:underline">← Back to your projects</a>
      </div>
    );
  if (!project) return <p className="text-eden-sage">Loading project…</p>;

  if (sketchIndex !== null) {
    const activeTemplate = SKETCH_TEMPLATES.find((t) => t.id === templateId);
    return (
      <div className="h-[75vh] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-xl text-eden-cream">Sketch &amp; Refine</h1>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="eden-btn text-xs bg-eden-deep/60"
          >
            {SKETCH_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <SketchCanvas
            onSave={handleSketchSave}
            onCancel={handleCancelSketch}
            guideOverlayUrl={activeTemplate?.url || null}
            parts={SKETCH_PARTS}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-[75vh] flex flex-col">
      <div className="mb-4">
        <h1 className="font-serif text-2xl text-eden-cream">{project.title}</h1>
        {project.brief && <p className="text-sm text-eden-stone mt-1">{project.brief}</p>}
      </div>
      {actionError && (
        <div role="alert" data-testid="action-error" className="mb-3 flex items-start gap-3 rounded-lg border border-eden-sunset/40 bg-eden-sunset/10 px-4 py-2 text-sm text-eden-sunset">
          <span className="flex-1">
            {actionError.message}
            {actionError.planLimit && (
              <>
                {' '}
                <a href="/billing" className="text-eden-gold-light hover:underline">See plans</a>
              </>
            )}
          </span>
          <button onClick={() => setActionError(null)} aria-label="Dismiss" className="text-eden-stone hover:text-eden-cream">
            ✕
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0">
        <ChatPanel
          messages={messages}
          onSend={(text) => handleSend(text)}
          onRetry={handleRetry}
          onGenerateImage={handleGenerateImage}
          onOpenSketch={handleOpenSketch}
          sending={sending}
          emptyHint={project.brief ? `Start with your brief: "${project.brief}"` : undefined}
        />
      </div>
      {sending && <p className="text-xs text-eden-stone mt-2">The Gardener is thinking…</p>}
    </div>
  );
               }
