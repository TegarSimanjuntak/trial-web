import React, { useEffect, useState } from 'react';

export default function SpeechPage({ session }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [synthText, setSynthText] = useState('');

  useEffect(() => {
    // nothing on mount
  }, []);

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return alert('SpeechRecognition tidak didukung di browser ini.');
    const rec = new SpeechRecognition();
    rec.lang = 'id-ID';
    rec.interimResults = false;
    rec.onresult = (e) => {
      setTranscript(e.results[0][0].transcript);
    };
    rec.onend = () => setListening(false);
    rec.start();
    setListening(true);
  }

  function stopAndSpeak(text) {
    if (!('speechSynthesis' in window)) return alert('TTS tidak didukung di browser ini.');
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = 'id-ID';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(ut);
  }

  return (
    <div className="container">
      <div className="card">
        <h3>Speech to Speech</h3>
        <div className="col">
          <div>
            <button onClick={startListening} disabled={listening}>{listening ? 'Listening…' : 'Mulai Rekam'}</button>
            <div className="small">Transkripsi: {transcript}</div>
          </div>

          <div>
            <label>Text ke Suara (TTS)</label>
            <textarea rows={4} value={synthText} onChange={e=>setSynthText(e.target.value)} />
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>stopAndSpeak(synthText)}>Mainkan</button>
              <button onClick={()=>setSynthText('')}>Hapus</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
