'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { ChatPanel } from '../../../components/ChatPanel';
import SketchCanvas from '../../../components/SketchCanvas';
import { SKETCH_TEMPLATES } from '../../../lib/sketchTemplates';
import { apiFetch } from '../../../lib/api';

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
}

export default function ProjectChatPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const projectId = params.id as string;
  const backendToken = (session as any)?.backendToken;

  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      .catch((e) => setError(e.message));
  }, [status, backendToken, projectId]);

  async function handleSend(text: string) {
    if (!backendToken || !project) return;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);
    try {
      const res = await apiFetch('/agent/invoke', backendToken, {
        method: 'POST',
        body: JSON.stringify({ project_id: project.id, mode: project.mode, prompt: text }),
      });
      setMessages((prev) => [...prev, { role: 'agent', content: res.reply }]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  async function handleGenerateImage(index: number) {
    if (!backendToken || !project) return;
    const msg = messages[index];
    if (!msg || msg.role !== 'agent') return;

    setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, imageLoading: true } : m)));
    try {
      const res = await apiFetch('/agent/generate-image', backendToken, {
        method: 'POST',
        body: JSON.stringify({ project_id: project.id, mode: project.mode, prompt: msg.content }),
      });
      setMessages((prev) =>
        prev.map((m, i) => (i === index ? { ...m, imageLoading: false, image_data_uri: res.image_data_uri } : m))
      );
    } catch (e: any) {
      setError(e.message);
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, imageLoading: false } : m)));
    }
  }

  function handleOpenSketch(index: number) {
    setTemplateId('none');
    setSketchIndex(index);
  }

  function handleCancelSketch() {
    setSketchIndex(null);
  }

  async function handleSketchSave(dataUri: string) {
    if (!backendToken || !project || sketchIndex === null) return;
    const index = sketchIndex;
    const msg = messages[index];
    setSketchIndex(null);
    if (!msg) return;

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
    } catch (e: any) {
      setError(e.message);
      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, imageLoading: false } : m)));
    }
  }

  if (error) return <p className="text-eden-sunset">{error}</p>;
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
      <div className="flex-1 min-h-0">
        <ChatPanel
          messages={messages}
          onSend={handleSend}
          onGenerateImage={handleGenerateImage}
          onOpenSketch={handleOpenSketch}
        />
      </div>
      {sending && <p className="text-xs text-eden-stone mt-2">The Gardener is thinking…</p>}
    </div>
  );
}
