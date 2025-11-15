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
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();

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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });

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
        const { data: p, error: pErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
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
    <>
      {/* Spinner animation (keyframes) */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
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
        `}
      </style>

      <div
        className="auth-page"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'linear-gradient(135deg, #f9fafb, #eef2ff)',
        }}
      >
        {/* Overlay loading */}
        {loading && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15,23,42,0.08)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 40,
            }}
          >
            <div
              style={{
                background: '#ffffff',
                padding: '16px 20px',
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow: '0 18px 45px rgba(15,23,42,0.15)',
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  border: '3px solid #e5e7eb',
                  borderTop: '3px solid #4f46e5',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#111827',
                }}
              >
                Sedang memproses, mohon tunggu...
              </span>
            </div>
          </div>
        )}

        <div
          className="auth-card fade-in-up"
          style={{
            width: '100%',
            maxWidth: 460,
            background: '#ffffff',
            borderRadius: 24,
            boxShadow: '0 18px 45px rgba(15,23,42,0.08)',
            padding: '28px 26px 26px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Accent strip */}
          <div
            style={{
              position: 'absolute',
              insetInline: 0,
              top: 0,
              height: 4,
              background:
                'linear-gradient(90deg, #4f46e5, #6366f1, #22c55e)',
            }}
          />

          {/* Header */}
          <div style={{ marginBottom: 18 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: '#6b7280',
                marginBottom: 4,
              }}
            >
              Tutor Cerdas
            </div>
            <h2
              style={{
                fontSize: 24,
                margin: 0,
                color: '#111827',
                fontWeight: 700,
              }}
            >
              Selamat Datang Kembali 👋
            </h2>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 13,
                color: '#6b7280',
              }}
            >
              Masuk untuk mengakses tutor cerdas dan materi pembelajaranmu.
            </p>
          </div>

          {info && (
            <div
              style={{
                marginBottom: 10,
                color: '#166534',
                background: '#dcfce7',
                padding: '8px 10px',
                borderRadius: 999,
                fontSize: 13,
              }}
            >
              {info}
            </div>
          )}

          <form
            onSubmit={handleLogin}
            className="col"
            autoComplete="on"
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#374151',
                }}
              >
                Email
              </label>
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                placeholder="nama@email.com"
                required
                style={{
                  height: 42,
                  borderRadius: 12,
                  border: '1px solid #e5e7eb',
                  padding: '0 12px',
                  fontSize: 14,
                  outline: 'none',
                  width: '100%',
                  transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                }}
                onFocus={e => {
                  e.target.style.boxShadow =
                    '0 0 0 1px #4f46e5, 0 0 0 4px rgba(79,70,229,0.08)';
                  e.target.style.borderColor = '#4f46e5';
                }}
                onBlur={e => {
                  e.target.style.boxShadow = 'none';
                  e.target.style.borderColor = '#e5e7eb';
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: '#374151',
                }}
              >
                Password
              </label>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <input
                  type={showPass ? 'text' : 'password'}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    flex: 1,
                    height: 42,
                    borderRadius: 12,
                    border: '1px solid #e5e7eb',
                    padding: '0 12px',
                    fontSize: 14,
                    outline: 'none',
                    transition:
                      'box-shadow 0.15s ease, border-color 0.15s ease',
                  }}
                  onFocus={e => {
                    e.target.style.boxShadow =
                      '0 0 0 1px #4f46e5, 0 0 0 4px rgba(79,70,229,0.08)';
                    e.target.style.borderColor = '#4f46e5';
                  }}
                  onBlur={e => {
                    e.target.style.boxShadow = 'none';
                    e.target.style.borderColor = '#e5e7eb';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  style={{
                    height: 42,
                    borderRadius: 999,
                    border: '1px solid #e5e7eb',
                    padding: '0 14px',
                    fontSize: 12,
                    fontWeight: 500,
                    background: '#f9fafb',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  aria-label={
                    showPass ? 'Sembunyikan password' : 'Tampilkan password'
                  }
                >
                  {showPass ? 'Sembunyi' : 'Tampil'}
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                marginTop: 12,
              }}
            >
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  minWidth: 96,
                  height: 44,
                  borderRadius: 999,
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: loading ? 'default' : 'pointer',
                  background: loading
                    ? 'linear-gradient(90deg,#4f46e5,#9333ea)'
                    : 'linear-gradient(90deg,#4f46e5,#22c55e)',
                  color: '#ffffff',
                  boxShadow:
                    '0 12px 30px rgba(79,70,229,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                }}
                onMouseDown={e => {
                  e.currentTarget.style.transform = 'scale(0.98)';
                  e.currentTarget.style.boxShadow =
                    '0 8px 18px rgba(79,70,229,0.3)';
                }}
                onMouseUp={e => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow =
                    '0 12px 30px rgba(79,70,229,0.4)';
                }}
              >
                {loading ? (
                  <>
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.5)',
                        borderTop: '2px solid #ffffff',
                        animation: 'spin 0.9s linear infinite',
                      }}
                    />
                    <span>Memproses...</span>
                  </>
                ) : (
                  'Login'
                )}
              </button>

              <button
                type="button"
                onClick={() => nav('/register')}
                disabled={loading}
                style={{
                  minWidth: 96,
                  height: 44,
                  borderRadius: 999,
                  border: '1px solid #e5e7eb',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: loading ? 'default' : 'pointer',
                  background: '#ffffff',
                  color: '#374151',
                }}
              >
                Register
              </button>
            </div>

            <div
              style={{
                marginTop: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
                color: '#6b7280',
              }}
            >
              <span>Belum pernah daftar? klik Register.</span>
              <a
                href="/forgot"
                style={{
                  fontWeight: 500,
                  color: '#4f46e5',
                  textDecoration: 'none',
                }}
              >
                Lupa password?
              </a>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
