// src/App.jsx
import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Register from './pages/Register';
import UserPage from './pages/UserPage';
import AdminPage from './pages/AdminPage';
import SpeechPage from './pages/SpeechPage';

function ProtectedRoute({ children, session, authInitialized, loadingProfile, profile, requireRole = null }) {
  // jika auth belum di-init, tunggu (jangan redirect)
  if (!authInitialized) return <div style={{ padding: 20 }}>Memeriksa otentikasi…</div>;

  // jika belum login, redirect ke login
  if (!session) return <Navigate to="/login" replace />;

  // jika profile masih dimuat, tunjukkan loading placeholder (tunggu)
  if (loadingProfile) return <div style={{ padding: 20 }}>Memuat profil…</div>;

  // jika route butuh role spesifik, periksa role
  if (requireRole && profile?.role !== requireRole) {
    return <div style={{ padding: 20 }}>Unauthorized</div>;
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      // supabase may emit events; update session reliably
      setSession(session);
    });

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
    return () => { mounted = false; };
  }, [session]);

  function Logout() {
    supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    navigate('/login', { replace: true });
  }

  // if auth not initialized yet, small loading UI (prevents blinking)
  if (!authInitialized) {
    return <div style={{ padding: 20 }}>Memeriksa otentikasi…</div>;
  }

  return (
    <div>
      <header style={{ padding: 12, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>Tutor Cerdas</div>
        <nav>
          {session ? (
            <>
              <span style={{ marginRight: 12 }}>{profile?.full_name ?? session.user.email} ({profile?.role ?? 'user'})</span>
              <Link to="/speech" style={{ marginRight: 10 }}>Speech</Link>
              {profile?.role === 'admin' && <Link to="/admin" style={{ marginRight: 10 }}>Admin</Link>}
              <Link to="/user" style={{ marginRight: 10 }}>User</Link>
              <button onClick={Logout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ marginRight: 8 }}>Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </header>

      <main style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={
            // root -> route by role if logged in, else to login
            session ? (
              profile?.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/user" replace />
            ) : <Navigate to="/login" replace />
          } />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/user" element={
            <ProtectedRoute
              session={session}
              authInitialized={authInitialized}
              loadingProfile={loadingProfile}
              profile={profile}
            >
              <UserPage session={session} profile={profile} />
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute
              session={session}
              authInitialized={authInitialized}
              loadingProfile={loadingProfile}
              profile={profile}
              requireRole="admin"
            >
              <AdminPage session={session} profile={profile} />
            </ProtectedRoute>
          } />

          <Route path="/speech" element={
            // speech requires only session, not profile role
            <ProtectedRoute
              session={session}
              authInitialized={authInitialized}
              loadingProfile={loadingProfile}
              profile={profile}
            >
              <SpeechPage session={session} profile={profile} />
            </ProtectedRoute>
          } />

          <Route path="*" element={<div>404</div>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
