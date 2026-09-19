'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { ChatPanel } from '../../../components/ChatPanel';
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

  if (error) return <p className="text-eden-sunset">{error}</p>;
  if (!project) return <p className="text-eden-sage">Loading project…</p>;

  return (
    <div className="h-[75vh] flex flex-col">
      <div className="mb-4">
        <h1 className="font-serif text-2xl text-eden-cream">{project.title}</h1>
        {project.brief && <p className="text-sm text-eden-stone mt-1">{project.brief}</p>}
      </div>
      <div className="flex-1 min-h-0">
        <ChatPanel messages={messages} onSend={handleSend} />
      </div>
      {sending && <p className="text-xs text-eden-stone mt-2">The Gardener is thinking…</p>}
    </div>
  );
}
