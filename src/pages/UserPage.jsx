import React, { useEffect, useState } from 'react';
import ChatBox from '../components/ChatBox';
import { supabase } from '../lib/supabase';

/**
 * UserPage (compact history)
 * - Single "Riwayat" button -> opens modal with list of chats
 * - Click chat -> modal shows messages for that chat (with Back button)
 * - Separate card/button for Speech-to-Speech page navigation
 */

export default function UserPage({ session, profile, navigateToSpeechPage }) {
  const [topChunks, setTopChunks] = useState([]); // top chunks dari ChatBox
  const [hasContext, setHasContext] = useState(false);
  const [expanded, setExpanded] = useState({});

  // History states
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);

  // Modal states: modalVisible + mode('list'|'messages') + selectedChat + messages
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('list'); // 'list' atau 'messages'
  const [selectedChat, setSelectedChat] = useState(null); // {id, title, created_at}
  const [modalMessages, setModalMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (session) fetchChats();
    else {
      setChats([]);
    }
    // eslint-disable-next-line
  }, [session]);

  async function fetchChats() {
    if (!session) return;
    setLoadingChats(true);
    try {
      const { data, error } = await supabase
        .from('chats')
        .select('id, title, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(200); // batas wajar; UI paginasi bisa ditambah kalau perlu
      if (error) throw error;
      setChats(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('fetchChats err', err);
      setChats([]);
    } finally {
      setLoadingChats(false);
    }
  }

  // open modal (default to list)
  function openHistoryModal() {
    setModalMode('list');
    setSelectedChat(null);
    setModalMessages([]);
    setModalVisible(true);
    // refresh list whenever modal dibuka (optional)
    fetchChats();
  }

  function closeModal() {
    setModalVisible(false);
    setModalMode('list');
    setSelectedChat(null);
    setModalMessages([]);
  }

  // ketika klik chat di daftar
  async function openChatMessages(chat) {
    if (!chat) return;
    setSelectedChat(chat);
    setModalMode('messages');
    setModalMessages([]);
    setLoadingMessages(true);
    try {
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('role, content, created_at')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setModalMessages(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      console.error('openChatMessages err', err);
      setModalMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }

  // Top-k from ChatBox
  function handleTopChunksChange(chunksArray, ctxFlag) {
    setTopChunks(Array.isArray(chunksArray) ? chunksArray.slice(0, 3) : []);
    setHasContext(Boolean(ctxFlag));
    setExpanded({});
  }

  function toggleExpand(idx) {
    setExpanded(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  function clearTopK() {
    setTopChunks([]);
    setHasContext(false);
    setExpanded({});
  }

  const PREVIEW_LENGTH = 300;

  return (
    <div className="container" style={{ padding: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>
        <div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Chat</h3>
            <ChatBox session={session} profile={profile} onTopChunksChange={handleTopChunksChange} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Button Riwayat (single) */}
          <div className="card" style={{ padding: 12 }}>
            <h4 style={{ margin: 0 }}>Riwayat</h4>
            <p className="small" style={{ marginTop: 6 }}>Lihat semua riwayat chat kamu dalam popup.</p>
            <div style={{ marginTop: 8 }}>
              <button onClick={openHistoryModal}>Buka Riwayat</button>
              <button onClick={fetchChats} style={{ marginLeft: 8 }}>Refresh</button>
            </div>
          </div>

          {/* Speech-to-speech navigation card (terpisah) */}
          <div className="card" style={{ padding: 12 }}>
            <h4 style={{ margin: 0 }}>Speech-to-Speech</h4>
            <p className="small" style={{ marginTop: 6 }}>Beralih ke halaman Speech-to-Speech untuk fitur suara.</p>
            <div style={{ marginTop: 8 }}>
              {/* navigateToSpeechPage optional prop; jika tidak ada, gunakan window.location */}
              <button onClick={() => {
                if (typeof navigateToSpeechPage === 'function') navigateToSpeechPage();
                else window.location.href = '/speech'; // sesuaikan route kalau perlu
              }}>Buka Speech-to-Speech</button>
            </div>
          </div>

          {/* Top-k Source card (jawaban terakhir) */}
          <div className="card" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0 }}>Top-k Source</h4>
                <p className="small" style={{ marginTop: 6 }}>Sumber relevan untuk jawaban terakhir (1–3 chunk).</p>
              </div>
              <div>
                <button onClick={clearTopK}>Clear</button>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13 }}>
                {hasContext ? <strong style={{ color: '#0a74da' }}>Konteks: YA</strong> : <strong style={{ color: '#b33' }}>Konteks: TIDAK</strong>}
              </div>

              <div style={{ marginTop: 8 }}>
                {(!topChunks || topChunks.length === 0) ? (
                  <div style={{ color: '#666', fontSize: 13 }}>Tidak ada sumber relevan untuk jawaban terakhir.</div>
                ) : (
                  topChunks.map((c, idx) => {
                    const isExpanded = !!expanded[idx];
                    const text = c.text || '';
                    const preview = text.length > PREVIEW_LENGTH ? text.slice(0, PREVIEW_LENGTH) + '…' : text;
                    return (
                      <div key={idx} style={{ marginBottom: 10, padding: 10, borderRadius: 6, background: '#fafafa', border: '1px solid #eee' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontWeight: 600 }}>{idx + 1}. {c.document_title}</div>
                          <div style={{ fontSize: 12, color: '#666' }}>
                            idx: {c.chunk_index} — sim: {c.similarity === null || typeof c.similarity === 'undefined' ? 'n/a' : Number(c.similarity).toFixed(4)}
                          </div>
                        </div>

                        <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', fontSize: 13, color: '#222' }}>
                          {isExpanded ? text : preview}
                        </div>

                        <div style={{ marginTop: 8 }}>
                          {text.length > PREVIEW_LENGTH && (
                            <button onClick={() => toggleExpand(idx)} style={{ marginRight: 8 }}>
                              {isExpanded ? 'View less' : 'View more'}
                            </button>
                          )}
                          <button onClick={() => navigator.clipboard.writeText(text)} style={{ marginRight: 8 }}>Salin isi chunk</button>
                          <button onClick={() => navigator.clipboard.writeText(`${c.document_title} (sim:${c.similarity})`)}>Salin meta</button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: digunakan untuk BOTH list view dan messages view */}
      {modalVisible && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.5)', zIndex: 9999, padding: 12
        }}>
          <div style={{ width: '100%', maxWidth: 920, maxHeight: '85vh', overflow: 'auto', background: '#fff', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>{modalMode === 'list' ? 'Daftar Riwayat Chat' : (selectedChat?.title || 'Chat')}</h3>
                {modalMode === 'list' ? (
                  <div className="small" style={{ color: '#666' }}>{chats.length} chat ditemukan.</div>
                ) : (
                  <div className="small" style={{ color: '#666' }}>{selectedChat ? new Date(selectedChat.created_at).toLocaleString() : ''}</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {modalMode === 'messages' && <button onClick={() => { setModalMode('list'); setSelectedChat(null); setModalMessages([]); }}>Kembali</button>}
                <button onClick={closeModal}>Tutup</button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {modalMode === 'list' ? (
                // list view
                <div>
                  {loadingChats ? (
                    <div className="small">Memuat riwayat...</div>
                  ) : chats.length === 0 ? (
                    <div style={{ color: '#666' }}>Belum ada riwayat chat tersimpan.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {chats.map(c => (
                        <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderRadius: 6, border: '1px solid #eee', background: '#fafafa' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{c.title || 'Chat tanpa judul'}</div>
                            <div className="small" style={{ color: '#666' }}>{new Date(c.created_at).toLocaleString()}</div>
                          </div>
                          <div>
                            <button onClick={() => openChatMessages(c)}>Buka</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // messages view
                <div>
                  {loadingMessages ? (
                    <div className="small">Memuat pesan...</div>
                  ) : modalMessages.length === 0 ? (
                    <div style={{ color: '#666' }}>Tidak ada pesan untuk chat ini.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {modalMessages.map((m, i) => (
                        <div key={i} style={{ padding: 10, borderRadius: 6, background: m.role === 'user' ? '#e6f0ff' : '#f4f4f4' }}>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                          <div className="small" style={{ marginTop: 6, color: '#666' }}>{new Date(m.created_at).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
