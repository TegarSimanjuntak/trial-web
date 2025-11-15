// src/pages/UserPage.jsx
import React, { useEffect, useState } from 'react';
import ChatBox from '../components/ChatBox';
import { supabase } from '../lib/supabase';

/**
 * UserPage (UI putih & rapi)
 * - Layout 2 kolom (chat besar di kiri, panel info di kanan)
 * - Tema putih/abu lembut, card dengan shadow
 * - Modal riwayat tetap sama fungsinya
 * - Top-k source tetap sama logika & datanya
 * - Navigasi Speech-to-Speech tetap sama
 */

export default function UserPage({ session, profile, navigateToSpeechPage }) {
  const [topChunks, setTopChunks] = useState([]); // top chunks dari ChatBox
  const [hasContext, setHasContext] = useState(false);
  const [expanded, setExpanded] = useState({});

  // History states
  const [chats, setChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('list'); // 'list' atau 'messages'
  const [selectedChat, setSelectedChat] = useState(null);
  const [modalMessages, setModalMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (session) fetchChats();
    else setChats([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        .limit(200);
      if (error) throw error;
      setChats(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('fetchChats err', err);
      setChats([]);
    } finally {
      setLoadingChats(false);
    }
  }

  function openHistoryModal() {
    setModalMode('list');
    setSelectedChat(null);
    setModalMessages([]);
    setModalVisible(true);
    fetchChats();
  }

  function closeModal() {
    setModalVisible(false);
    setModalMode('list');
    setSelectedChat(null);
    setModalMessages([]);
  }

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

  const userName =
    profile?.full_name ||
    profile?.name ||
    profile?.username ||
    'Mahasiswa';

  return (
    <>
      {/* Styling khusus UserPage */}
      <style>
        {`
          .fade-in-up {
            opacity: 0;
            transform: translateY(8px);
            animation: fadeInUp 0.35s ease-out forwards;
          }
          @keyframes fadeInUp {
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .user-root {
            min-height: 100vh;
            background: #f3f4f6;
            padding: 24px 16px;
            display: flex;
            justify-content: center;
          }
          .user-shell {
            width: 100%;
            max-width: 1180px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .user-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
          }
          .user-header-title {
            margin: 0;
            font-size: 22px;
            font-weight: 700;
            color: #111827;
          }
          .user-header-sub {
            margin: 4px 0 0;
            font-size: 13px;
            color: #6b7280;
          }
          .user-pill {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            padding: 6px 10px;
            border-radius: 999px;
            background: #eef2ff;
            color: #4f46e5;
            white-space: nowrap;
          }

          .user-grid {
            display: grid;
            grid-template-columns: minmax(0, 2.2fr) minmax(320px, 1fr);
            gap: 16px;
          }
          .user-card {
            background: #ffffff;
            border-radius: 18px;
            box-shadow: 0 18px 40px rgba(15,23,42,0.06);
            border: 1px solid #e5e7eb;
            padding: 16px 16px 18px;
          }
          .user-card-title {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #111827;
          }
          .user-card-sub {
            margin: 6px 0 0;
            font-size: 13px;
            color: #6b7280;
          }

          .btn-primary {
            border: none;
            border-radius: 999px;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            background: linear-gradient(90deg, #4f46e5, #22c55e);
            color: #ffffff;
            box-shadow: 0 10px 25px rgba(79,70,229,0.35);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
          }
          .btn-primary:hover {
            filter: brightness(1.03);
            box-shadow: 0 12px 30px rgba(79,70,229,0.4);
          }
          .btn-primary:active {
            transform: scale(0.97);
            box-shadow: 0 8px 18px rgba(79,70,229,0.3);
          }

          .btn-soft {
            border-radius: 999px;
            border: 1px solid #e5e7eb;
            background: #ffffff;
            color: #374151;
            padding: 8px 14px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: background 0.12s ease, border-color 0.12s ease, transform 0.12s ease;
          }
          .btn-soft:hover {
            background: #f9fafb;
            border-color: #d1d5db;
          }
          .btn-soft:active {
            transform: scale(0.97);
          }

          .btn-ghost {
            border-radius: 999px;
            border: 1px solid #e5e7eb;
            background: #f9fafb;
            color: #374151;
            padding: 6px 10px;
            font-size: 12px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            transition: background 0.12s ease, border-color 0.12s ease;
          }
          .btn-ghost:hover {
            background: #f3f4f6;
            border-color: #d1d5db;
          }

          .badge-context {
            font-size: 12px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 999px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .badge-context-yes {
            background: #dcfce7;
            color: #166534;
          }
          .badge-context-no {
            background: #fee2e2;
            color: #b91c1c;
          }

          .chunk-card {
            margin-bottom: 10px;
            padding: 10px;
            border-radius: 10px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
          }

          .history-modal-backdrop {
            position: fixed;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(15,23,42,0.32);
            z-index: 9999;
            padding: 12px;
          }
          .history-modal-body {
            width: 100%;
            maxWidth: 920px;
            max-height: 85vh;
            overflow: auto;
            background: #ffffff;
            border-radius: 16px;
            padding: 14px 14px 16px;
            box-shadow: 0 18px 45px rgba(15,23,42,0.35);
          }

          @media (max-width: 900px) {
            .user-grid {
              grid-template-columns: minmax(0, 1fr);
            }
          }
        `}
      </style>

      <div className="user-root">
        <div className="user-shell fade-in-up">
          {/* Header atas */}
          <header className="user-header">
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 1.3,
                  textTransform: 'uppercase',
                  color: '#6b7280',
                }}
              >
                Tutor Cerdas
              </p>
              <h1 className="user-header-title">
                Halo, {userName} 👋
              </h1>
              <p className="user-header-sub">
                Ajukan pertanyaan tentang materi kuliahmu. Riwayat dan sumber
                jawaban dicatat rapi di samping.
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 6,
              }}
            >
              <span className="user-pill">Student Mode</span>
              {profile?.role && (
                <span
                  style={{
                    fontSize: 11,
                    color: '#9ca3af',
                  }}
                >
                  Role: {profile.role}
                </span>
              )}
            </div>
          </header>

          {/* Grid utama: Chat + panel samping */}
          <div className="user-grid">
            {/* Kolom kiri: Chat */}
            <div>
              <div className="user-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <h2 className="user-card-title">Chat dengan Tutor Cerdas</h2>
                    <p className="user-card-sub">
                      Tanyakan konsep, tugas, atau soal sulit. Sistem akan
                      mencari referensi dari dokumen yang sudah dimasukkan.
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: 6 }}>
                  <ChatBox
                    session={session}
                    profile={profile}
                    onTopChunksChange={handleTopChunksChange}
                  />
                </div>
              </div>
            </div>

            {/* Kolom kanan: Info panel (Riwayat, Speech, Top-k) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Card Riwayat */}
              <div className="user-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div>
                    <h3 className="user-card-title" style={{ fontSize: 15 }}>
                      Riwayat Chat
                    </h3>
                    <p className="user-card-sub">
                      Lihat, buka kembali, dan pelajari ulang percakapan
                      sebelumnya.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <button className="btn-primary" onClick={openHistoryModal}>
                    Buka Riwayat
                  </button>
                  <button className="btn-soft" onClick={fetchChats}>
                    Refresh
                  </button>
                </div>

                {loadingChats && (
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: '#6b7280',
                    }}
                  >
                    Memuat riwayat...
                  </p>
                )}
                {!loadingChats && chats.length > 0 && (
                  <p
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: '#9ca3af',
                    }}
                  >
                    {chats.length} chat tersimpan.
                  </p>
                )}
              </div>

              {/* Card Speech-to-Speech */}
              <div className="user-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <div>
                    <h3 className="user-card-title" style={{ fontSize: 15 }}>
                      Speech-to-Speech
                    </h3>
                    <p className="user-card-sub">
                      Gunakan mode suara untuk berbicara langsung dengan Tutor
                      Cerdas. Cocok untuk latihan lisan & penjelasan cepat.
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      if (typeof navigateToSpeechPage === 'function') {
                        navigateToSpeechPage();
                      } else {
                        window.location.href = '/speech';
                      }
                    }}
                  >
                    Buka Speech-to-Speech
                  </button>
                </div>
              </div>

              {/* Card Top-k Source */}
              <div className="user-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div>
                    <h3 className="user-card-title" style={{ fontSize: 15 }}>
                      Top-k Sumber Jawaban
                    </h3>
                    <p className="user-card-sub">
                      Lihat potongan dokumen yang paling relevan untuk jawaban
                      terakhir (maksimal 3 chunk).
                    </p>
                  </div>
                  <button className="btn-ghost" onClick={clearTopK}>
                    Clear
                  </button>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div>
                    {hasContext ? (
                      <span className="badge-context badge-context-yes">
                        <span>●</span> Konteks: YA
                      </span>
                    ) : (
                      <span className="badge-context badge-context-no">
                        <span>●</span> Konteks: TIDAK
                      </span>
                    )}
                  </div>

                  <div style={{ marginTop: 10 }}>
                    {!topChunks || topChunks.length === 0 ? (
                      <div
                        style={{
                          color: '#6b7280',
                          fontSize: 13,
                          background: '#f9fafb',
                          borderRadius: 10,
                          border: '1px dashed #d1d5db',
                          padding: 10,
                        }}
                      >
                        Belum ada sumber relevan untuk jawaban terakhir. Kirim
                        pertanyaan dulu di kotak chat.
                      </div>
                    ) : (
                      topChunks.map((c, idx) => {
                        const isExpanded = !!expanded[idx];
                        const text = c.text || '';
                        const preview =
                          text.length > PREVIEW_LENGTH
                            ? text.slice(0, PREVIEW_LENGTH) + '…'
                            : text;
                        return (
                          <div key={idx} className="chunk-card">
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8,
                              }}
                            >
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: 13,
                                  color: '#111827',
                                }}
                              >
                                {idx + 1}. {c.document_title}
                              </div>
                              <div
                                style={{
                                  fontSize: 11,
                                  color: '#6b7280',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                idx: {c.chunk_index} — sim:{' '}
                                {c.similarity === null ||
                                typeof c.similarity === 'undefined'
                                  ? 'n/a'
                                  : Number(c.similarity).toFixed(4)}
                              </div>
                            </div>

                            <div
                              style={{
                                marginTop: 8,
                                whiteSpace: 'pre-wrap',
                                fontSize: 13,
                                color: '#111827',
                              }}
                            >
                              {isExpanded ? text : preview}
                            </div>

                            <div
                              style={{
                                marginTop: 8,
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 6,
                              }}
                            >
                              {text.length > PREVIEW_LENGTH && (
                                <button
                                  className="btn-ghost"
                                  onClick={() => toggleExpand(idx)}
                                >
                                  {isExpanded ? 'View less' : 'View more'}
                                </button>
                              )}
                              <button
                                className="btn-ghost"
                                onClick={() =>
                                  navigator.clipboard.writeText(text)
                                }
                              >
                                Salin isi chunk
                              </button>
                              <button
                                className="btn-ghost"
                                onClick={() =>
                                  navigator.clipboard.writeText(
                                    `${c.document_title} (sim:${c.similarity})`,
                                  )
                                }
                              >
                                Salin meta
                              </button>
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

          {/* Modal Riwayat (list & messages) */}
          {modalVisible && (
            <div className="history-modal-backdrop">
              <div className="history-modal-body fade-in-up">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 17,
                        fontWeight: 600,
                        color: '#111827',
                      }}
                    >
                      {modalMode === 'list'
                        ? 'Daftar Riwayat Chat'
                        : selectedChat?.title || 'Chat'}
                    </h3>
                    {modalMode === 'list' ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#6b7280',
                          marginTop: 4,
                        }}
                      >
                        {chats.length} chat ditemukan.
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: 12,
                          color: '#6b7280',
                          marginTop: 4,
                        }}
                      >
                        {selectedChat
                          ? new Date(
                              selectedChat.created_at,
                            ).toLocaleString()
                          : ''}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {modalMode === 'messages' && (
                      <button
                        className="btn-soft"
                        onClick={() => {
                          setModalMode('list');
                          setSelectedChat(null);
                          setModalMessages([]);
                        }}
                      >
                        Kembali ke daftar
                      </button>
                    )}
                    <button className="btn-soft" onClick={closeModal}>
                      Tutup
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 4 }}>
                  {modalMode === 'list' ? (
                    // List view
                    <div>
                      {loadingChats ? (
                        <div
                          style={{
                            fontSize: 13,
                            color: '#6b7280',
                          }}
                        >
                          Memuat riwayat...
                        </div>
                      ) : chats.length === 0 ? (
                        <div
                          style={{
                            color: '#6b7280',
                            fontSize: 13,
                            background: '#f9fafb',
                            borderRadius: 10,
                            border: '1px dashed #d1d5db',
                            padding: 10,
                          }}
                        >
                          Belum ada riwayat chat tersimpan.
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'grid',
                            gap: 8,
                            marginTop: 4,
                          }}
                        >
                          {chats.map(c => (
                            <div
                              key={c.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: 10,
                                borderRadius: 10,
                                border: '1px solid #e5e7eb',
                                background: '#f9fafb',
                                gap: 8,
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    fontSize: 14,
                                    color: '#111827',
                                  }}
                                >
                                  {c.title || 'Chat tanpa judul'}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: '#6b7280',
                                    marginTop: 2,
                                  }}
                                >
                                  {new Date(
                                    c.created_at,
                                  ).toLocaleString()}
                                </div>
                              </div>
                              <div>
                                <button
                                  className="btn-soft"
                                  onClick={() => openChatMessages(c)}
                                >
                                  Buka
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Messages view
                    <div>
                      {loadingMessages ? (
                        <div
                          style={{
                            fontSize: 13,
                            color: '#6b7280',
                          }}
                        >
                          Memuat pesan...
                        </div>
                      ) : modalMessages.length === 0 ? (
                        <div
                          style={{
                            color: '#6b7280',
                            fontSize: 13,
                            background: '#f9fafb',
                            borderRadius: 10,
                            border: '1px dashed #d1d5db',
                            padding: 10,
                          }}
                        >
                          Tidak ada pesan untuk chat ini.
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            marginTop: 4,
                          }}
                        >
                          {modalMessages.map((m, i) => (
                            <div
                              key={i}
                              style={{
                                padding: 10,
                                borderRadius: 10,
                                background:
                                  m.role === 'user'
                                    ? '#e0edff'
                                    : '#f4f4f5',
                                border: '1px solid #e5e7eb',
                              }}
                            >
                              <div
                                style={{
                                  whiteSpace: 'pre-wrap',
                                  fontSize: 13,
                                  color: '#111827',
                                }}
                              >
                                {m.content}
                              </div>
                              <div
                                style={{
                                  marginTop: 6,
                                  fontSize: 11,
                                  color: '#6b7280',
                                }}
                              >
                                {new Date(
                                  m.created_at,
                                ).toLocaleString()}
                              </div>
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
      </div>
    </>
  );
}
