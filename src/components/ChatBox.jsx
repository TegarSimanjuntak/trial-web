import React, { useEffect, useRef, useState } from 'react';
import { joinApiUrl } from '../utils/url';

/**
 * ChatBox
 * - LOGIKA TETAP SAMA (handleSend, /api/chat, onTopChunksChange, dsb)
 * - Hanya tampilan yang dipoles: bubble, header, input bar, dan indikator loading
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: `Server error: ${res.status}. Lihat console untuk detail.`
          }
        ]);
        try { onTopChunksChange([], false); } catch (e) {}
        return;
      }

      if (!contentType.includes('application/json')) {
        console.error('Expected JSON but got:', contentType, text);
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Response server bukan JSON (cek server logs).' }
        ]);
        try { onTopChunksChange([], false); } catch (e) {}
        return;
      }

      const data = text ? JSON.parse(text) : {};

      // normalize chunks (prefer top_chunks)
      const chunksSource =
        Array.isArray(data?.top_chunks) && data.top_chunks.length > 0
          ? data.top_chunks
          : Array.isArray(data?.chunks) && data.chunks.length > 0
          ? data.chunks.slice(0, 3)
          : null;

      const normalized = chunksSource
        ? chunksSource.slice(0, 3).map(c => ({
            document_title: c?.document_title || c?.document_id || 'unknown',
            chunk_index:
              typeof c?.chunk_index !== 'undefined' ? c.chunk_index : 'n/a',
            similarity:
              typeof c?.similarity !== 'undefined'
                ? Number(c.similarity)
                : null,
            text: c?.text ?? '(tidak ada teks chunk)'
          }))
        : [];

      const hasCtx =
        normalized.length > 0
          ? true
          : typeof data?.has_context !== 'undefined'
          ? Boolean(data.has_context)
          : !Boolean(data?.out_of_context);

      // prepare reply: if hasCtx true, strip generative preface
      let reply = data?.reply ?? null;
      if (reply && hasCtx) {
        reply = stripGenerativePreface(reply);
      }

      if (reply) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: reply,
            metadata: { saved: data?.saved ?? false }
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'Gagal mendapatkan jawaban dari server.'
          }
        ]);
      }

      // inform parent of top-k & context
      try {
        onTopChunksChange(normalized, hasCtx);
      } catch (e) {}
    } catch (err) {
      if (err.name === 'AbortError') {
        console.warn('Request aborted');
      } else {
        console.error('Network / unexpected error while calling /api/chat', err);
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Terjadi error jaringan.' }
        ]);
        try { onTopChunksChange([], false); } catch (e) {}
      }
    } finally {
      setLoading(false);
      // clear abortRef if still pointing to same controller
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function copyText(text) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        try {
          alert('Teks disalin');
        } catch {}
      })
      .catch(() => {
        try {
          alert('Gagal menyalin teks');
        } catch {}
      });
  }

  const userLabel = session
    ? session?.user?.email || session?.user?.id || 'user'
    : null;

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .cb-root {
            display: flex;
            flex-direction: column;
            height: 70vh;
          }
          .cb-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
          }
          .cb-header-left {
            font-size: 12px;
            color: #6b7280;
          }
          .cb-header-pill {
            font-size: 11px;
            padding: 4px 8px;
            border-radius: 999px;
            background: #eef2ff;
            color: #4f46e5;
          }

          .cb-messages {
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            border-radius: 14px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .cb-bubble {
            padding: 9px 11px;
            border-radius: 14px;
            max-width: 80%;
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
          }
          .cb-bubble-user {
            align-self: flex-end;
            background: #e0edff;
            border-top-right-radius: 4px;
          }
          .cb-bubble-assistant {
            align-self: flex-start;
            background: #f4f4f5;
            border-top-left-radius: 4px;
          }
          .cb-meta-row {
            margin-top: 6px;
            display: flex;
            justify-content: flex-end;
          }
          .cb-copy-btn {
            border-radius: 999px;
            border: none;
            background: #e5e7eb;
            font-size: 11px;
            padding: 3px 8px;
            cursor: pointer;
          }
          .cb-copy-btn:hover {
            background: #d4d4d8;
          }

          .cb-input-wrapper {
            margin-top: 10px;
          }
          .cb-input-row {
            display: flex;
            gap: 8px;
            align-items: center;
          }
          .cb-input {
            flex: 1;
            border-radius: 999px;
            border: 1px solid #e5e7eb;
            padding: 9px 12px;
            font-size: 13px;
            outline: none;
          }
          .cb-input:focus {
            border-color: #4f46e5;
            box-shadow: 0 0 0 1px #4f46e5, 0 0 0 4px rgba(79,70,229,0.08);
          }
          .cb-send-btn {
            border-radius: 999px;
            border: none;
            font-size: 13px;
            font-weight: 600;
            padding: 9px 14px;
            cursor: pointer;
            background: linear-gradient(90deg, #4f46e5, #22c55e);
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            box-shadow: 0 10px 24px rgba(79,70,229,0.35);
          }
          .cb-send-btn:disabled {
            opacity: 0.7;
            cursor: default;
            box-shadow: none;
          }

          .cb-loading-row {
            margin-top: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: #6b7280;
          }
          .cb-spinner-small {
            width: 14px;
            height: 14px;
            border-radius: 999px;
            border: 2px solid #e5e7eb;
            border-top: 2px solid #4f46e5;
            animation: spin 0.8s linear infinite;
          }
        `}
      </style>

      <div className="cb-root">
        {/* Header kecil di atas chat */}
        <div className="cb-header">
          <div className="cb-header-left">
            {userLabel
              ? `Login sebagai ${userLabel}`
              : 'Belum login (silakan login untuk mengirim pertanyaan).'}
          </div>
          <div className="cb-header-pill">Chat Mode</div>
        </div>

        {/* Chat area */}
        <div className="cb-messages">
          {messages.length === 0 && (
            <div
              style={{
                fontSize: 13,
                color: '#9ca3af',
                textAlign: 'center',
                marginTop: 10
              }}
            >
              Mulai dengan mengetik pertanyaan tentang materi kuliahmu di bawah.
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={
                'cb-bubble ' +
                (m.role === 'user'
                  ? 'cb-bubble-user'
                  : 'cb-bubble-assistant')
              }
            >
              {m.content}
              {m.role === 'assistant' && (
                <div className="cb-meta-row">
                  <button
                    type="button"
                    className="cb-copy-btn"
                    onClick={() => copyText(m.content)}
                  >
                    Salin
                  </button>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="cb-input-wrapper">
          <div className="cb-input-row">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={
                session
                  ? 'Tanya sesuatu... (Enter untuk kirim)'
                  : 'Silakan login untuk mengirim pertanyaan'
              }
              disabled={!session || loading}
              className="cb-input"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              type="submit"
              disabled={loading || !session}
              className="cb-send-btn"
            >
              {loading && <span className="cb-spinner-small" />}
              <span>{loading ? 'Memproses...' : 'Kirim'}</span>
            </button>
          </div>

          {loading && (
            <div className="cb-loading-row">
              <div className="cb-spinner-small" />
              <span>Tutor Cerdas sedang menyusun jawaban...</span>
            </div>
          )}
        </form>
      </div>
    </>
  );
}
