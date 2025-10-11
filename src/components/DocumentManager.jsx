import React, { useEffect, useState } from 'react';

export default function DocumentManager({ session }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [docs, setDocs] = useState([]);

  useEffect(()=> { loadDocs(); }, []);

  async function loadDocs() {
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/documents`, {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    const data = await res.json();
    setDocs(data.items || []);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return alert('Pilih file PDF');
    if (file.size > 10 * 1024 * 1024) return alert('Maks 10MB');
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);

    // NOTE: admin upload requires header x-service-key = ADMIN_UPLOAD_KEY configured in backend
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/documents`, {
      method: 'POST',
      headers: {
        // do not set Content-Type — browser will set multipart boundary
        'x-service-key': import.meta.env.VITE_ADMIN_UPLOAD_KEY
      },
      body: form
    });
    const data = await res.json();
    if (data?.ok) {
      alert('Uploaded');
      setFile(null);
      setTitle('');
      loadDocs();
    } else {
      alert('Upload gagal: ' + (data?.error || JSON.stringify(data)));
    }
  }

  async function triggerProcess(id) {
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/admin/process/${id}`, {
      method: 'POST',
      headers: { 'x-service-key': import.meta.env.VITE_ADMIN_UPLOAD_KEY }
    });
    const data = await res.json();
    if (data?.ok) alert('Diproses');
    else alert('Gagal trigger: ' + JSON.stringify(data));
  }

  return (
    <div className="col">
      <form onSubmit={handleUpload} className="card">
        <h3>Upload PDF (Admin)</h3>
        <label>Title</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} />
        <label>File (PDF, ≤10MB)</label>
        <input type="file" accept="application/pdf" onChange={e=>setFile(e.target.files[0])} />
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button type="submit">Upload</button>
        </div>
      </form>

      <div className="card">
        <h3>Daftar Dokumen</h3>
        <div className="col">
          {docs.length === 0 && <div className="small">Tidak ada dokumen</div>}
          {docs.map(d => (
            <div key={d.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{d.title}</div>
                <div className="small">Status: {d.status} | Pages: {d.pages ?? '-'}</div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>triggerProcess(d.id)}>Chunk & Embed</button>
                <a href="#" onClick={(e)=>{ e.preventDefault(); alert('View not implemented in FE yet'); }}>View</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
