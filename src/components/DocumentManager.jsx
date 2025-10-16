// DocumentManager.jsx (improved)
import React, { useEffect, useState, useCallback } from 'react';

export default function DocumentManager({ session }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [itemLoading, setItemLoading] = useState({}); // { [id]: { deleting:bool, processing:bool, chunksLoading:bool } }
  const [errorMessage, setErrorMessage] = useState(null);
  const [chunksModal, setChunksModal] = useState({ open: false, doc: null, chunks: [], loading: false });
  const [processingId, setProcessingId] = useState(null);

  // backend base: explicit override or default to localhost:8787 in dev
  const backendEnv = import.meta.env.VITE_BACKEND_URL ?? '';
  const DEFAULT_DEV_BACKEND = 'http://localhost:8787';
  const backendBase = backendEnv || (import.meta.env.DEV ? DEFAULT_DEV_BACKEND : '');

  const buildAdminUrl = useCallback((p = '/api/admin/documents') => {
    // ensure leading slash
    const path = p.startsWith('/') ? p : `/${p}`;
    if (backendBase) return `${backendBase}${path}`;
    return path; // fallback (if using proxy)
  }, [backendBase]);

  useEffect(() => {
    if (session) loadDocs();
    else { setDocs([]); setErrorMessage(null); }
  }, [session]);

  // safe JSON text -> object
  async function parseJsonSafe(res) {
    const text = await res.text().catch(()=>null);
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  async function loadDocs() {
    // if no session, still allow load if backend allows anonymous
    setErrorMessage(null);
    setLoadingDocs(true);
    const url = buildAdminUrl('/api/admin/documents');
    try {
      const headers = {};
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(url, {
        headers,
        cache: 'no-store'
      });
      if (!res.ok) {
        const parsed = await parseJsonSafe(res);
        throw new Error(parsed?.message || parsed?.error || `HTTP ${res.status}`);
      }
      const j = await res.json().catch(()=>null);
      let items = [];
      if (Array.isArray(j)) items = j;
      else if (j?.data && Array.isArray(j.data)) items = j.data;
      else if (j?.items && Array.isArray(j.items)) items = j.items;
      setDocs(items);
    } catch (e) {
      console.error('[DocumentManager] loadDocs error', e);
      setErrorMessage(e.message || String(e));
    } finally {
      setLoadingDocs(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    setErrorMessage(null);
    if (!session?.access_token) return alert('Login sebagai admin dulu.');
    if (!file) return alert('Pilih file terlebih dahulu');
    if (file.type !== 'application/pdf') return alert('Hanya PDF');
    if (file.size > 50 * 1024 * 1024) return alert('Maks 50MB');

    const url = buildAdminUrl('/api/admin/documents');
    const form = new FormData();
    form.append('file', file);
    form.append('title', title || file.name);

    setUploading(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
        body: form
      });

      if (!res.ok) {
        const parsed = await parseJsonSafe(res);
        throw new Error(parsed?.message || parsed?.error || `HTTP ${res.status}`);
      }

      const body = await res.json().catch(()=>null);
      alert('Upload berhasil');
      setFile(null); setTitle('');
      await loadDocs();
    } catch (err) {
      console.error('[DocumentManager] upload error', err);
      alert('Upload gagal: ' + (err.message || err));
    } finally {
      setUploading(false);
    }
  }

  function getDocViewUrl(d) {
    // prefer absolute public path
    if (d?.path && typeof d.path === 'string' && d.path.startsWith('http')) return d.path;
    // else use backend redirect endpoint
    return buildAdminUrl(`/api/admin/documents/${d.id}/view`);
  }

  async function viewDocument(d) {
    const url = getDocViewUrl(d);
    window.open(url, '_blank', 'noopener');
  }

  function setItemBusy(id, changes) {
    setItemLoading(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...changes } }));
  }

  async function deleteDocument(d) {
    if (!confirm('Hapus dokumen ini?')) return;
    setItemBusy(d.id, { deleting: true });
    const url = buildAdminUrl(`/api/admin/documents/${d.id}`);
    try {
      const res = await fetch(url, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` } });
      if (!res.ok) {
        const parsed = await parseJsonSafe(res);
        throw new Error(parsed?.message || parsed?.error || `HTTP ${res.status}`);
      }
      alert('Dokumen dihapus');
      await loadDocs();
    } catch (e) {
      console.error('[DocumentManager] delete error', e);
      alert('Gagal hapus: ' + (e.message || e));
    } finally {
      setItemBusy(d.id, { deleting: false });
    }
  }

    async function triggerProcess(d) {
    if (!confirm('Proses chunking & embedding dokumen ini?')) return;
    setProcessingId(d.id);
    const url = buildAdminUrl(`/api/admin/documents/${d.id}/process`);
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${session?.access_token}` } });
      const j = await res.json().catch(()=>null);
      if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`);

      // trigger succeeded — poll doc status a few times (so UI will stop showing Processing when done)
      const maxAttempts = 10;
      const intervalMs = 2000;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, intervalMs));
        try {
          // fetch single doc to check status (resolve by id)
          const docRes = await fetch(buildAdminUrl(`/api/admin/documents/${d.id}`), { headers: { 'Authorization': `Bearer ${session?.access_token}` } });
          if (!docRes.ok) {
            // if not found or other, continue polling (or break if 404)
            if (docRes.status === 404) break;
            continue;
          }
          const docJson = await docRes.json().catch(()=>null);
          const latest = docJson?.data ?? docJson;
          if (latest && (latest.status === 'embedded' || latest.status === 'error' || latest.status === 'processing' === false)) {
            // refresh full doc list and break if finished or error
            await loadDocs();
            if (latest.status === 'embedded' || latest.status === 'error') break;
          } else {
            // refresh list to update chunk_count maybe
            await loadDocs();
          }
        } catch (e) {
          console.warn('polling status error', e);
        }
      }

      alert('Proses dimulai. Jika belum selesai, cek kembali halaman Admin beberapa saat lagi.');
      await loadDocs();
    } catch (e) {
      console.error('triggerProcess error', e);
      alert('Gagal trigger proses: ' + (e.message || e));
    } finally {
      setProcessingId(null);
    }
  }


  async function openChunks(d) {
    setChunksModal({ open: true, doc: d, chunks: [], loading: true });
    setItemBusy(d.id, { chunksLoading: true });
    const url = buildAdminUrl(`/api/admin/documents/${d.id}/chunks`);
    try {
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${session?.access_token}` } });
      if (!res.ok) {
        const parsed = await parseJsonSafe(res);
        throw new Error(parsed?.message || parsed?.error || `HTTP ${res.status}`);
      }
      const j = await res.json();
      const items = j?.data || [];
      setChunksModal({ open: true, doc: d, chunks: items, loading: false });
    } catch (e) {
      console.error('[DocumentManager] openChunks error', e);
      alert('Gagal memuat chunks: ' + (e.message || e));
      setChunksModal({ open: true, doc: d, chunks: [], loading: false });
    } finally {
      setItemBusy(d.id, { chunksLoading: false });
    }
  }

  return (
    <div className="col" style={{ padding: 12 }}>
      <form onSubmit={handleUpload} className="card" style={{ marginBottom: 12, padding: 12 }}>
        <h3>Upload PDF (Admin)</h3>
        <label style={{ display: 'block', marginTop: 8 }}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Judul (opsional)" />
        <label style={{ display: 'block', marginTop: 8 }}>File (PDF)</label>
        <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        {file && <div className="small">{file.name} — {(file.size/1024/1024).toFixed(2)} MB</div>}
        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
          <button type="button" onClick={() => { setFile(null); setTitle(''); }} disabled={uploading}>Reset</button>
        </div>
      </form>

      <div className="card" style={{ padding: 12 }}>
        <h3>Daftar Dokumen</h3>
        {loadingDocs && <div className="small">Memuat dokumen…</div>}
        {!loadingDocs && errorMessage && <div style={{ color:'crimson' }}>{errorMessage}</div>}
        {!loadingDocs && docs.length === 0 && <div className="small">Tidak ada dokumen</div>}
        <div>
          {docs.map(d => {
            const busy = itemLoading[d.id] || {};
            return (
              <div key={d.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid #eee' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{d.title}</div>
                    {/* status badge */}
                    <div style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      background: d.status === 'embedded' ? '#d1fae5' : d.status === 'processing' ? '#fef3c7' : d.status === 'error' ? '#fecaca' : '#e5e7eb',
                      color: '#111'
                    }}>
                      {d.status || 'uploaded'}
                    </div>
                    {/* chunk count clickable */}
                    <div style={{ marginLeft: 'auto', fontSize: 12 }}>
                      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#2563eb' }} onClick={() => openChunks(d)}>
                        {typeof d.chunk_count === 'number' ? `${d.chunk_count} chunk${d.chunk_count !== 1 ? 's' : ''}` : '— chunks'}
                      </button>
                    </div>
                  </div>

                  <div className="small">Uploaded: {d.uploadedBy || '—'} — {d.created_at ? new Date(d.created_at).toLocaleString() : '-'}</div>
                  {d.supabase_error && <div className="small" style={{ color:'crimson' }}>Supabase: {String(d.supabase_error)}</div>}
                  {/* hide long path; View button opens the file */}
                </div>


                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <button onClick={() => viewDocument(d)}>View</button>

                  <button onClick={() => openChunks(d)} disabled={busy.chunksLoading}>
                    {busy.chunksLoading ? 'Loading chunks…' : 'View Chunks'}
                  </button>

                  <button disabled={busy.processing} onClick={() => triggerProcess(d)}>
                    {busy.processing ? 'Processing…' : 'Chunk & Embed'}
                  </button>

                  <button disabled={busy.deleting} onClick={() => deleteDocument(d)}>
                    {busy.deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chunks modal */}
      {chunksModal.open && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999
        }}>
          <div style={{ width:'90%', maxWidth:900, background:'#fff', padding:16, borderRadius:8, maxHeight:'90%', overflow:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <h4>Chunks — {chunksModal.doc?.title}</h4>
              <div>
                <button onClick={() => { setChunksModal({ open: false, doc: null, chunks: [], loading: false }); }}>Close</button>
              </div>
            </div>

            {chunksModal.loading && <div>Loading chunks…</div>}
            {!chunksModal.loading && chunksModal.chunks.length === 0 && <div>No chunks found</div>}
            {!chunksModal.loading && chunksModal.chunks.map((c, i) => (
              <div key={c.id ?? i} style={{ padding:8, borderBottom:'1px solid #eee' }}>
                <div style={{ fontWeight:600 }}>#{c.chunk_index ?? i} — tokens: {c.tokens ?? '-'}</div>
                <div style={{ whiteSpace:'pre-wrap' }}>{c.content || c.text || c.text_preview || '-'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
