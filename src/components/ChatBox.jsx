import React, { useEffect, useRef, useState } from 'react';
import { joinApiUrl } from '../utils/url';

/**
 * ChatBox (clean) - versi minimal namun lebih robust
 * - Menghindari double-slash di URL
 * - Menangani response non-JSON (HTML 404)
 * - Membatalkan request sebelumnya jika user cepat mengirim
 */

function stripGenerativePreface(text) {
  if (!text) return text;
  const regex = /^\s*(?:(?:Catatan|Note|Disclaimer)[\s\S]*?)\n{2,}/i;
  if (regex.test(text)) {
    return text.replace(regex, '').trim();
  }
  const shortPrefRegex = /^\s*(?:Catatan[:\s].{0,200}|Note[:\s].{0,200}|Disclaimer[:\s].{0,200})/i;
  if (shortPrefRegex.test(text) && /generatif|luar cakupan|di luar cakupan/i.test(text)) {
    const idx = text.indexOf('\n');
    if (idx > 0) return text.slice(idx).trim();
  }
  return text;
}

export default function ChatBox({ session, onTopChunksChange = () => {} }) {
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();
  const abortRef = useRef(null);

  useEffect(() => {
    // Clear chat when session changes (if logged out or new login)
    setMessages([]);
    setInput('');
    setLoading(false);
    try { onTopChunksChange([], false); } catch (e) {}
    // cleanup abort if session changed
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
      abortRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  useEffect(() => {
    return () => {
      // cleanup on unmount
      if (abortRef.current) {
        try { abortRef.current.abort(); } catch {}
        abortRef.current = null;
      }
    };
  }, []);

  async function handleSend(e) {
    e?.preventDefault();
    if (!input.trim()) return;
    const q = input.trim();

    // push user message (local only)
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);

    // clear parent top-k immediately
    try { onTopChunksChange([], false); } catch (e) {}

    // abort previous request if any
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
      abortRef.current = null;
    }
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const backendBase = import.meta.env.VITE_BACKEND_URL || '';
      const url = joinApiUrl(backendBase, '/api/chat');

      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ question: q }),
        signal: controller.signal
      });

      // read text first (safer) so we can debug HTML 404 or other non-json bodies
      const text = await res.text().catch(() => '');
      const contentType = res.headers.get('content-type') || '';

      if (!res.ok) {
        console.error('API responded with non-OK status', res.status, text);
        setMessages(prev => [...prev, { role: 'assistant', content: `Server error: ${res.status}. Lihat console untuk detail.` }]);
        try { onTopChunksChange([], false); } catch (e) {}
        return;
      }

      if (!contentType.includes('application/json')) {
        console.error('Expected JSON but got:', contentType, text);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Response server bukan JSON (cek server logs).' }]);
        try { onTopChunksChange([], false); } catch (e) {}
        return;
      }

      const data = text ? JSON.parse(text) : {};

      // normalize chunks (prefer top_chunks)
      const chunksSource = Array.isArray(data?.top_chunks) && data.top_chunks.length > 0
        ? data.top_chunks
        : Array.isArray(data?.chunks) && data.chunks.length > 0
          ? data.chunks.slice(0, 3)
          : null;

      const normalized = chunksSource
        ? chunksSource.slice(0, 3).map(c => ({
            document_title: c?.document_title || c?.document_id || 'unknown',
            chunk_index: typeof c?.chunk_index !== 'undefined' ? c.chunk_index : 'n/a',
            similarity: typeof c?.similarity !== 'undefined' ? Number(c.similarity) : null,
            text: c?.text ?? '(tidak ada teks chunk)'
          }))
        : [];

      const hasCtx = normalized.length > 0 ? true
        : (typeof data?.has_context !== 'undefined' ? Boolean(data.has_context) : !(Boolean(data?.out_of_context)));

      // prepare reply: if hasCtx true, strip generative preface
      let reply = data?.reply ?? null;
      if (reply && hasCtx) {
        reply = stripGenerativePreface(reply);
      }

      if (reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: reply, metadata: { saved: data?.saved ?? false } }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Gagal mendapatkan jawaban dari server.' }]);
      }

      // inform parent of top-k & context
      try { onTopChunksChange(normalized, hasCtx); } catch (e) {}
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('Request aborted');
      } else {
        console.error('Network / unexpected error while calling /api/chat', err);
        setMessages(prev => [...prev, { role: 'assistant', content: 'Terjadi error jaringan.' }]);
        try { onTopChunksChange([], false); } catch (e) {}
      }
    } finally {
      setLoading(false);
      // clear abortRef if still pointing to same controller
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function copyText(text) {
    navigator.clipboard.writeText(text).then(()=> { try{ alert('Teks disalin'); }catch{} }).catch(()=>{ try{ alert('Gagal menyalin teks'); }catch{} });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
      {/* Simplified Controls (no history controls) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: '#666' }}>
          {session ? `Login sebagai ${session?.user?.email ?? session?.user?.id ?? 'user'}` : 'Belum login'}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display:'flex', flexDirection:'column', gap:8 }}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role === 'user' ? 'user' : 'assistant'}`}
               style={{
                 padding: 10, borderRadius: 8, alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                 maxWidth: '85%', background: m.role === 'user' ? '#e6f0ff' : '#f4f4f4'
               }}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            <div style={{ marginTop: 6 }} className="small">
              {m.role === 'assistant' && <button onClick={() => copyText(m.content)}>Salin</button>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{ marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder={session ? "Tanya sesuatu..." : "Silakan login untuk mengirim pertanyaan"} disabled={!session || loading}
                 onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}} style={{ flex: 1, padding: 8 }} />
          <button type="submit" disabled={loading || !session} style={{ padding: '8px 12px' }}>{loading ? '...' : 'Kirim'}</button>
        </div>
      </form>
    </div>
  );
}
