// src/App.jsx
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Register from './pages/Register';
import UserPage from './pages/UserPage';
import AdminPage from './pages/AdminPage';
import SpeechPage from './pages/SpeechPage';

function LoadingScreen({ title = 'Memuat…', subtitle }) {
  return (
    <div className="app-loading-root">
      <div className="app-loading-card">
        <div className="app-spinner" />
        <div>
          <div className="app-loading-title">{title}</div>
          {subtitle && <div className="app-loading-sub">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
}

function AppBaseStyles() {
  return (
    <style>
      {`
        :root {
          color-scheme: light;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            sans-serif;
        }

        .app-root {
          min-height: 100vh;
          background: #f3f4f6;
          display: flex;
          flex-direction: column;
        }

        .app-header {
          position: sticky;
          top: 0;
          z-index: 20;
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          box-shadow: 0 4px 18px rgba(15,23,42,0.08);
        }
        .app-header-inner {
          max-width: 1180px;
          margin: 0 auto;
          padding: 10px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .app-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .app-logo-circle {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          background: radial-gradient(circle at 30% 30%, #a5b4fc, #4f46e5);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-size: 14px;
          font-weight: 700;
        }
        .app-brand-text-main {
          font-weight: 700;
          font-size: 17px;
          color: #111827;
        }
        .app-brand-text-sub {
          font-size: 11px;
          color: #6b7280;
        }

        .app-nav {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .app-user-label {
          font-size: 12px;
          color: #6b7280;
          max-width: 220px;
          text-align: right;
        }
        .app-user-label strong {
          color: #111827;
        }

        .app-nav-link,
        .app-nav-btn {
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          padding: 6px 12px;
          font-size: 12px;
          text-decoration: none;
          color: #374151;
          background: #ffffff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: background 0.12s ease, border-color 0.12s ease,
            transform 0.1s ease, box-shadow 0.1s ease;
        }
        .app-nav-link:hover,
        .app-nav-btn:hover {
          background: #f9fafb;
          border-color: #d1d5db;
        }
        .app-nav-link:active,
        .app-nav-btn:active {
          transform: scale(0.97);
          box-shadow: 0 4px 12px rgba(15,23,42,0.18);
        }

        .app-nav-link--primary {
          border: none;
          background: linear-gradient(90deg, #4f46e5, #22c55e);
          color: #ffffff;
          box-shadow: 0 10px 24px rgba(79,70,229,0.35);
        }
        .app-nav-link--primary:hover {
          filter: brightness(1.03);
        }
        .app-nav-link--primary:active {
          box-shadow: 0 6px 16px rgba(79,70,229,0.3);
        }

        .app-main {
          flex: 1;
          padding: 20px 16px 24px;
        }
        .app-main-inner {
          max-width: 1180px;
          margin: 0 auto;
        }

        .app-loading-root {
          min-height: 100vh;
          background: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .app-loading-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 14px 18px;
          display: inline-flex;
          gap: 10px;
          align-items: center;
          box-shadow: 0 18px 45px rgba(15,23,42,0.18);
          border: 1px solid #e5e7eb;
        }
        .app-spinner {
          width: 22px;
          height: 22px;
          border-radius: 999px;
          border: 3px solid #e5e7eb;
          border-top-color: #4f46e5;
          animation: app-spin 0.8s linear infinite;
        }
        .app-loading-title {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
        }
        .app-loading-sub {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
        }

        .app-404 {
          min-height: calc(100vh - 80px);
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #6b7280;
          font-size: 14px;
        }

        @keyframes app-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .app-header-inner {
            flex-direction: column;
            align-items: flex-start;
          }
          .app-user-label {
            text-align: left;
            max-width: 100%;
          }
          .app-nav {
            justify-content: flex-start;
          }
        }
      `}
    </style>
  );
}

function ProtectedRoute({
  children,
  session,
  authInitialized,
  loadingProfile,
  profile,
  requireRole = null
}) {
  // jika auth belum di-init, tunggu (jangan redirect)
  if (!authInitialized) {
    return (
      <LoadingScreen
        title="Memeriksa otentikasi…"
        subtitle="Menyambungkan ke sesi pengguna."
      />
    );
  }

  // jika belum login, redirect ke login
  if (!session) return <Navigate to="/login" replace />;

  // jika profile masih dimuat, tunjukkan loading placeholder (tunggu)
  if (loadingProfile) {
    return (
      <LoadingScreen
        title="Memuat profil…"
        subtitle="Mengambil data role dan informasi akun."
      />
    );
  }

  // jika route butuh role spesifik, periksa role
  if (requireRole && profile?.role !== requireRole) {
    return (
      <div style={{ padding: 20 }}>
        <strong>Unauthorized</strong> — Anda tidak memiliki akses ke halaman ini.
      </div>
    );
  }

  // semua oke -> render children
  return children;
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [authInitialized, setAuthInitialized] = useState(false);
  const navigate = useNavigate();

  // inisialisasi session & listener
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data?.session ?? null);
      setAuthInitialized(true);
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // load profile tiap kali session berubah
  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      if (!session) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }
      setLoadingProfile(true);
      try {
        const { data, error, status } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error && status !== 406) {
          console.error('supabase profiles error', { error, status });
          setProfile(null);
        } else {
          if (mounted) setProfile(data);
        }
      } catch (err) {
        console.error('unexpected error fetching profile', err);
        setProfile(null);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    };
    loadProfile();
    return () => {
      mounted = false;
    };
  }, [session]);

  function Logout() {
    supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    navigate('/login', { replace: true });
  }

  // if auth not initialized yet, small loading UI (prevents blinking)
  if (!authInitialized) {
    return (
      <>
        <AppBaseStyles />
        <LoadingScreen
          title="Memeriksa otentikasi…"
          subtitle="Menyambungkan ke server Supabase."
        />
      </>
    );
  }

  const displayName =
    profile?.full_name ?? profile?.name ?? session?.user?.email ?? '';

  return (
    <div className="app-root">
      <AppBaseStyles />

      {/* HEADER */}
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <div className="app-logo-circle">T</div>
            <div>
              <div className="app-brand-text-main">Tutor Cerdas</div>
              <div className="app-brand-text-sub">
                Personalized AI tutor untuk mata kuliah teknik
              </div>
            </div>
          </div>

          <nav className="app-nav">
            {session ? (
              <>
                <div className="app-user-label">
                  <div>
                    <strong>{displayName}</strong>
                  </div>
                  <div>Role: {profile?.role ?? 'user'}</div>
                </div>

                <Link to="/speech" className="app-nav-link">
                  Speech
                </Link>
                {profile?.role === 'admin' && (
                  <Link to="/admin" className="app-nav-link">
                    Admin
                  </Link>
                )}
                <Link to="/user" className="app-nav-link">
                  User
                </Link>
                <button onClick={Logout} className="app-nav-btn">
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="app-nav-link">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="app-nav-link app-nav-link--primary"
                >
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* MAIN */}
      <main className="app-main">
        <div className="app-main-inner">
          <Routes>
            <Route
              path="/"
              element={
                // root -> route by role if logged in, else to login
                session ? (
                  profile?.role === 'admin' ? (
                    <Navigate to="/admin" replace />
                  ) : (
                    <Navigate to="/user" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route
              path="/user"
              element={
                <ProtectedRoute
                  session={session}
                  authInitialized={authInitialized}
                  loadingProfile={loadingProfile}
                  profile={profile}
                >
                  <UserPage session={session} profile={profile} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <ProtectedRoute
                  session={session}
                  authInitialized={authInitialized}
                  loadingProfile={loadingProfile}
                  profile={profile}
                  requireRole="admin"
                >
                  <AdminPage session={session} profile={profile} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/speech"
              element={
                // speech requires only session, not profile role
                <ProtectedRoute
                  session={session}
                  authInitialized={authInitialized}
                  loadingProfile={loadingProfile}
                  profile={profile}
                >
                  <SpeechPage session={session} profile={profile} />
                </ProtectedRoute>
              }
            />

            <Route
              path="*"
              element={
                <div className="app-404">
                  <div>
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: '#111827',
                        marginBottom: 4
                      }}
                    >
                      404 — Halaman tidak ditemukan
                    </div>
                    <div>
                      Gunakan menu di atas untuk kembali ke halaman utama.
                    </div>
                  </div>
                </div>
              }
            />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
