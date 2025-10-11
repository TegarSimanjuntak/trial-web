import React from 'react';
import ChatBox from '../components/ChatBox';

export default function UserPage({ session, profile }) {
  return (
    <div className="container">
      <div style={{ display:'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>
        <div>
          <div className="card">
            <h3>Chat</h3>
            <ChatBox session={session} profile={profile} />
          </div>
        </div>

        <div>
          <div className="card">
            <h4>Riwayat / Chats</h4>
            <p className="small">Fitur riwayat chat akan memuat chat yang tersimpan di Supabase.</p>
            {/* For brevity, we show simple link to chat list later */}
            <div style={{ marginTop: 8 }}>
              <a href="/speech">Ke Speech to Speech</a>
            </div>
          </div>
          <div style={{ height: 12 }} />
          <div className="card">
            <h4>Top-k Source</h4>
            <p className="small">Setiap jawaban menampilkan chunk sumber teratas (jika ada).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
