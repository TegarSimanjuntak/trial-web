// src/pages/Login.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [info, setInfo] = useState(null);

  const nav = useNavigate();

  // jika sudah signed in, langsung ke halaman sesuai role
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session) {
        try {
          const userId = data.session.user.id;
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).single();
          if (profile?.role === 'admin') nav('/admin', { replace: true });
          else nav('/user', { replace: true });
        } catch (e) {
          nav('/user', { replace: true });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setInfo(null);

    if (!email || !pass) {
      return alert('Isi email dan password terlebih dahulu.');
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) {
        alert(error.message || 'Gagal login.');
        return;
      }

      // dapatkan session & user id
      const sessionResp = await supabase.auth.getSession();
      const session = sessionResp?.data?.session;
      const userId = session?.user?.id;

      // ambil profile (role)
      let profile = null;
      if (userId) {
        const { data: p, error: pErr } = await supabase.from('profiles').select('role').eq('id', userId).single();
        if (!pErr) profile = p;
      }

      // redirect berdasarkan role (tanpa mempertimbangkan halaman sebelumnya)
      if (profile?.role === 'admin') {
        nav('/admin', { replace: true });
      } else {
        nav('/user', { replace: true });
      }

    } catch (err) {
      console.error('login error', err);
      alert('Terjadi kesalahan saat login. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h2>Login</h2>

        {info && <div style={{ marginBottom: 10, color: '#155724', background: '#d4edda', padding: 8, borderRadius: 6 }}>{info}</div>}

        <form onSubmit={handleLogin} className="col" autoComplete="on">
          <label>Email</label>
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            type="email"
            placeholder="email@example.com"
            required
          />

          <label>Password</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="Password"
              required
              style={{ flex: 1 }}
            />
            <button
              type="button"
              onClick={() => setShowPass(s => !s)}
              style={{ padding: '6px 8px' }}
              aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
            >
              {showPass ? 'Hide' : 'Show'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="submit" disabled={loading} style={{ minWidth: 96 }}>
              {loading ? 'Memproses...' : 'Login'}
            </button>

            <button
              type="button"
              onClick={() => nav('/register')}
              disabled={loading}
              style={{ minWidth: 96 }}
            >
              Register
            </button>
          </div>

          <div style={{ marginTop: 10 }} className="small">
            <a href="/forgot">Lupa password?</a>
          </div>
        </form>
      </div>
    </div>
  );
}
