import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function ChatBox({ session }) {
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    // Load latest chat messages (simple: fetch last chat for user)
    (async () => {
      if (!session) return;
      const { data: chats } = await supabase
        .from('chats').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(1);
      const chatId = chats?.[0]?.id;
      if (!chatId) return;
      const { data: msgs } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
      if (msgs) setMessages(msgs.map(m=>({ role: m.role, content: m.content, metadata: m.metadata })));
    })();
  }, [session]);

  useEffect(()=> bottomRef.current?.scrollIntoView({ behavior:'smooth' }), [messages]);

  async function handleSend(e) {
    e?.preventDefault();
    if (!input.trim()) return;
    const q = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ question: q })
      });
      const data = await res.json();
      if (data?.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        // show top-k chunk preview if exists
        if (data?.chunks?.length) {
          setMessages(prev => [...prev, { role: 'system', content: `Top source: ${data.chunks[0].document_title || data.chunks[0].document_id} (sim:${data.chunks[0].similarity})` }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Gagal mendapatkan jawaban dari server.' }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Terjadi error jaringan.' }]);
    } finally {
      setLoading(false);
    }
  }

  function copyText(text) {
    navigator.clipboard.writeText(text);
    alert('Teks disalin');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '60vh' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12, display:'flex', flexDirection:'column', gap:8 }}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble ${m.role==='user' ? 'user' : m.role==='assistant' ? 'assistant' : ''}`}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            <div style={{ marginTop: 6 }} className="small">
              {m.role === 'assistant' && <button onClick={()=>copyText(m.content)}>Salin</button>}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} style={{ marginTop: 8 }}>
        <div style={{ display:'flex', gap:8 }}>
          <input value={input} onChange={e=>setInput(e.target.value)} placeholder="Tanya sesuatu..." />
          <button type="submit" disabled={loading}>{loading ? '...' : 'Kirim'}</button>
        </div>
      </form>
    </div>
  )
}
