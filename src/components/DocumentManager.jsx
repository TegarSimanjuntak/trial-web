// DocumentManager.jsx (UI polished, LOGIKA TETAP)
import React, { useEffect, useState, useCallback } from 'react';

export default function DocumentManager({ session }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [docs, setDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [itemLoading, setItemLoading] = useState({}); // { [id]: { deleting:bool, processing:bool, chunksLoading:bool } }
  const [errorMessage, setErrorMessage] = useState(null);
  const [chunksModal, setChunksModal] = useState({
    open: false,
    doc: null,
    chunks: [],
    loading: false
  });
  const [processingId, setProcessingId] = useState(null);

  // backend base: explicit override or default to localhost:8787 in dev
  const backendEnv = import.meta.env.VITE_BACKEND_URL ?? '';
  const DEFAULT_DEV_BACKEND = 'http://localhost:8787';
  const backendBase = backendEnv || (import.meta.env.DEV ? DEFAULT_DEV_BACKEND : '');

  const buildAdminUrl = useCallback(
    (p = '/api/admin/documents') => {
      // ensure leading slash on path
      const path = p.startsWith('/') ? p : `/${p}`;

      if (!backendBase) {
        // fallback relative path (proxy / same origin)
        return path;
      }

      // remove trailing slash from backendBase, if any
      const base = backendBase.endsWith('/')
        ? backendBase.slice(0, -1)
        : backendBase;

      return `${base}${path}`; // now safe: base has no trailing slash, path has leading slash
    },
    [backendBase]
  );

  useEffect(() => {
    if (session) loadDocs();
    else {
      setDocs([]);
      setErrorMessage(null);
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // safe JSON text -> object
  async function parseJsonSafe(res) {
    const text = await res.text().catch(() => null);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function loadDocs() {
    // if no session, still allow load if backend allows anonymous
    setErrorMessage(null);
    setLoadingDocs(true);
    const url = buildAdminUrl('/api/admin/documents');
    try {
      const headers = {};
      if (session?.access_token)
        headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(url, {
        headers,
        cache: 'no-store'
      });
      if (!res.ok) {
        const parsed = await parseJsonSafe(res);
        throw new Error(parsed?.message || parsed?.error || `HTTP ${res.status}`);
      }
      const j = await res.json().catch(() => null);
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
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form
      });

      if (!res.ok) {
        const parsed = await parseJsonSafe(res);
        throw new Error(parsed?.message || parsed?.error || `HTTP ${res.status}`);
      }

      await res.json().catch(() => null);
      alert('Upload berhasil');
      setFile(null);
      setTitle('');
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
    if (d?.path && typeof d.path === 'string' && d.path.startsWith('http'))
      return d.path;
    // else use backend redirect endpoint
    return buildAdminUrl(`/api/admin/documents/${d.id}/view`);
  }

  async function viewDocument(d) {
    const url = getDocViewUrl(d);
    window.open(url, '_blank', 'noopener');
  }

  function setItemBusy(id, changes) {
    setItemLoading(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...changes }
    }));
  }

  async function deleteDocument(d) {
    if (!confirm('Hapus dokumen ini?')) return;
    setItemBusy(d.id, { deleting: true });
    const url = buildAdminUrl(`/api/admin/documents/${d.id}`);
    try {
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
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
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.message || `HTTP ${res.status}`);

      // trigger succeeded — poll doc status a few times (so UI will stop showing Processing when done)
      const maxAttempts = 10;
      const intervalMs = 2000;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(r => setTimeout(r, intervalMs));
        try {
          // fetch single doc to check status (resolve by id)
          const docRes = await fetch(
            buildAdminUrl(`/api/admin/documents/${d.id}`),
            { headers: { Authorization: `Bearer ${session?.access_token}` } }
          );
          if (!docRes.ok) {
            // if not found or other, continue polling (or break if 404)
            if (docRes.status === 404) break;
            continue;
          }
          const docJson = await docRes.json().catch(() => null);
          const latest = docJson?.data ?? docJson;
          if (
            latest &&
            (latest.status === 'embedded' ||
              latest.status === 'error' ||
              latest.status === 'processing' === false)
          ) {
            // refresh full doc list and break if finished or error
            await loadDocs();
            if (latest.status === 'embedded' || latest.status === 'error')
              break;
          } else {
            // refresh list to update chunk_count maybe
            await loadDocs();
          }
        } catch (e) {
          console.warn('polling status error', e);
        }
      }

      alert(
        'Proses dimulai. Jika belum selesai, cek kembali halaman Admin beberapa saat lagi.'
      );
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
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
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

  function closeChunksModal() {
    setChunksModal({ open: false, doc: null, chunks: [], loading: false });
  }

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .dm-root {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .dm-card {
            background: #ffffff;
            border-radius: 16px;
            padding: 14px 14px 16px;
            border: 1px solid #e5e7eb;
            box-shadow: 0 10px 26px rgba(15,23,42,0.06);
          }

          .dm-title {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #111827;
          }
          .dm-sub {
            margin: 4px 0 0;
            font-size: 12px;
            color: #6b7280;
          }

          .dm-label {
            display: block;
            margin-top: 8px;
            font-size: 13px;
            font-weight: 500;
            color: #374151;
          }
          .dm-input {
            width: 100%;
            margin-top: 4px;
            padding: 8px 10px;
            border-radius: 10px;
            border: 1px solid #e5e7eb;
            font-size: 13px;
            outline: none;
          }
          .dm-input:focus {
            border-color: #4f46e5;
            box-shadow: 0 0 0 1px #4f46e5, 0 0 0 4px rgba(79,70,229,0.08);
          }

          .dm-file-info {
            margin-top: 6px;
            font-size: 12px;
            color: #6b7280;
          }

          .dm-btn-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-top: 10px;
          }

          .dm-btn-primary {
            border-radius: 999px;
            border: none;
            padding: 8px 14px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            background: linear-gradient(90deg,#4f46e5,#22c55e);
            color: #ffffff;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 10px 24px rgba(79,70,229,0.35);
          }
          .dm-btn-primary:disabled {
            opacity: 0.7;
            cursor: default;
            box-shadow: none;
          }

          .dm-btn-soft {
            border-radius: 999px;
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            background: #ffffff;
            color: #374151;
          }
          .dm-btn-soft:disabled {
            opacity: 0.6;
            cursor: default;
          }

          .dm-status-badge {
            padding: 2px 8px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 600;
          }

          .dm-status-embedded {
            background: #dcfce7;
            color: #166534;
          }
          .dm-status-processing {
            background: #fef3c7;
            color: #92400e;
          }
          .dm-status-error {
            background: #fee2e2;
            color: #b91c1c;
          }
          .dm-status-other {
            background: #e5e7eb;
            color: #374151;
          }

          .dm-doc-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }

          .dm-doc-meta {
            font-size: 12px;
            color: #6b7280;
            margin-top: 2px;
          }

          .dm-small-error {
            margin-top: 6px;
            font-size: 12px;
            color: #b91c1c;
          }

          .dm-chunk-link-btn {
            font-size: 12px;
            border: none;
            background: transparent;
            cursor: pointer;
            color: #2563eb;
            padding: 0;
          }

          .dm-spinner {
            width: 16px;
            height: 16px;
            border-radius: 999px;
            border: 2px solid #e5e7eb;
            border-top: 2px solid #4f46e5;
            animation: spin 0.8s linear infinite;
          }

          .dm-modal-backdrop {
            position: fixed;
            inset: 0;
            background: rgba(15,23,42,0.42);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            padding: 12px;
          }
          .dm-modal-body {
            width: 100%;
            max-width: 900px;
            max-height: 90vh;
            background: #ffffff;
            border-radius: 16px;
            padding: 14px 16px 16px;
            overflow: auto;
            box-shadow: 0 18px 45px rgba(15,23,42,0.45);
          }
        `}
      </style>

      <div className="dm-root">
        {/* Card Upload */}
        <form onSubmit={handleUpload} className="dm-card">
          <div>
            <h3 className="dm-title">Upload PDF (Admin)</h3>
            <p className="dm-sub">
              Tambahkan dokumen materi (PDF) yang akan dijadikan basis pengetahuan
              Tutor Cerdas.
            </p>
          </div>

          <label className="dm-label">Judul dokumen</label>
          <input
            className="dm-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Judul (opsional, default: nama file)"
          />

          <label className="dm-label">File PDF</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            style={{ marginTop: 4, fontSize: 13 }}
          />
          {file && (
            <div className="dm-file-info">
              {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
            </div>
          )}

          <div className="dm-btn-row">
            <button
              type="submit"
              className="dm-btn-primary"
              disabled={uploading}
            >
              {uploading && <span className="dm-spinner" />}
              <span>{uploading ? 'Uploading...' : 'Upload'}</span>
            </button>
            <button
              type="button"
              className="dm-btn-soft"
              onClick={() => {
                setFile(null);
                setTitle('');
              }}
              disabled={uploading}
            >
              Reset
            </button>
          </div>
        </form>

        {/* Card Daftar Dokumen */}
        <div className="dm-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8
            }}
          >
            <div>
              <h3 className="dm-title">Daftar Dokumen</h3>
              <p className="dm-sub">
                Kelola dokumen yang sudah diupload: lihat, proses chunk &
                embedding, cek chunks, dan hapus.
              </p>
            </div>
            {loadingDocs && <div className="dm-spinner" />}
          </div>

          {errorMessage && (
            <div className="dm-small-error">{errorMessage}</div>
          )}

          {!loadingDocs && docs.length === 0 && !errorMessage && (
            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                color: 'grey',
                padding: 10,
                borderRadius: 10,
                background: '#f9fafb',
                border: '1px dashed #d1d5db'
              }}
            >
              Tidak ada dokumen. Upload PDF terlebih dahulu.
            </div>
          )}

          <div style={{ marginTop: 4 }}>
            {docs.map(d => {
              const busy = itemLoading[d.id] || {};
              const status = d.status || 'uploaded';
              let statusClass = 'dm-status-other';
              if (status === 'embedded') statusClass = 'dm-status-embedded';
              else if (status === 'processing')
                statusClass = 'dm-status-processing';
              else if (status === 'error') statusClass = 'dm-status-error';

              const isProcessing = processingId === d.id || busy.processing;

              return (
                <div key={d.id} className="dm-doc-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap'
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: '#111827'
                        }}
                      >
                        {d.title}
                      </div>
                      <span
                        className={
                          'dm-status-badge ' + statusClass
                        }
                      >
                        {status}
                      </span>

                      <div
                        style={{
                          marginLeft: 'auto',
                          fontSize: 12,
                          color: '#6b7280'
                        }}
                      >
                        <button
                          type="button"
                          className="dm-chunk-link-btn"
                          onClick={() => openChunks(d)}
                          disabled={busy.chunksLoading}
                        >
                          {busy.chunksLoading
                            ? 'Loading chunks…'
                            : typeof d.chunk_count === 'number'
                            ? `${d.chunk_count} chunk${
                                d.chunk_count !== 1 ? 's' : ''
                              }`
                            : '— chunks'}
                        </button>
                      </div>
                    </div>

                    <div className="dm-doc-meta">
                      Uploaded: {d.uploadedBy || '—'} —{' '}
                      {d.created_at
                        ? new Date(d.created_at).toLocaleString()
                        : '-'}
                    </div>
                    {d.supabase_error && (
                      <div
                        className="dm-doc-meta"
                        style={{ color: '#b91c1c' }}
                      >
                        Supabase: {String(d.supabase_error)}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      flexWrap: 'wrap'
                    }}
                  >
                    <button
                      type="button"
                      className="dm-btn-soft"
                      onClick={() => viewDocument(d)}
                    >
                      View
                    </button>

                    <button
                      type="button"
                      className="dm-btn-soft"
                      onClick={() => openChunks(d)}
                      disabled={busy.chunksLoading}
                    >
                      {busy.chunksLoading ? 'Chunks…' : 'View Chunks'}
                    </button>

                    <button
                      type="button"
                      className="dm-btn-soft"
                      onClick={() => triggerProcess(d)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Processing…' : 'Chunk & Embed'}
                    </button>

                    <button
                      type="button"
                      className="dm-btn-soft"
                      onClick={() => deleteDocument(d)}
                      disabled={busy.deleting}
                    >
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
          <div className="dm-modal-backdrop">
            <div className="dm-modal-body">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8
                }}
              >
                <div>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 600,
                      color: '#111827'
                    }}
                  >
                    Chunks — {chunksModal.doc?.title}
                  </h4>
                  {chunksModal.doc?.id && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#6b7280',
                        marginTop: 2
                      }}
                    >
                      ID: {chunksModal.doc.id}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="dm-btn-soft"
                  onClick={closeChunksModal}
                >
                  Close
                </button>
              </div>

              {chunksModal.loading && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    color: '#6b7280'
                  }}
                >
                  <span className="dm-spinner" />
                  <span>Loading chunks…</span>
                </div>
              )}

              {!chunksModal.loading &&
                chunksModal.chunks.length === 0 && (
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: 'grey',
                      padding: 8,
                      borderRadius: 10,
                      background: '#f9fafb',
                      border: '1px dashed #d1d5db'
                    }}
                  >
                    No chunks found
                  </div>
                )}

              {!chunksModal.loading &&
                chunksModal.chunks.map((c, i) => (
                  <div
                    key={c.id ?? i}
                    style={{
                      padding: 8,
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13,
                        marginBottom: 4
                      }}
                    >
                      #{c.chunk_index ?? i} — tokens:{' '}
                      {c.tokens ?? '-'}
                    </div>
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        fontSize: 13,
                        color: '#111827'
                      }}
                    >
                      {c.content || c.text || c.text_preview || '-'}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
