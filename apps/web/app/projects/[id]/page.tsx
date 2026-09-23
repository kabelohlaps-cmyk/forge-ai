'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { ChatPanel } from '../../../components/ChatPanel';
import SketchCanvas from '../../../components/SketchCanvas';
import { SKETCH_TEMPLATES } from '../../../lib/sketchTemplates';
import { SKETCH_PARTS } from '../../../lib/sketchParts';
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
    if (sta
