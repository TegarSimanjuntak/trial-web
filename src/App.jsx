import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Register from './pages/Register';
import UserPage from './pages/UserPage';
import AdminPage from './pages/AdminPage';
import SpeechPage from './pages/SpeechPage';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session ?? null);
    };
    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    (async () => {
      try {
        // selalu ambil session agar supabase-js bisa gunakan token yang valid
        const { data: s } = await supabase.auth.getSession();
        const userId = s?.session?.user?.id || session.user.id;
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (error) {
          console.error('supabase profiles error', error);
          return;
        }
        setProfile(data);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [session]);

  function Logout() {
    supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    navigate('/login');
  }

  return (
    <div>
      <header style={{ padding: 12, borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>Tutor Cerdas</div>
        <nav>
          {session ? (
            <>
              <span style={{ marginRight: 12 }}>{profile?.full_name ?? session.user.email} ({profile?.role ?? 'user'})</span>
              <button onClick={Logout}>Logout</button>
            </>
          ) : (
            <>
              <a href="/login" style={{ marginRight: 8 }}>Login</a>
              <a href="/register">Register</a>
            </>
          )}
        </nav>
      </header>

      <main style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={session ? (
            profile?.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/user" />
          ) : <Navigate to="/login" />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/user" element={
            session ? (
              profile?.role === 'user' || profile?.role === 'admin' ? <UserPage session={session} profile={profile} /> : <div>Unauthorized</div>
            ) : <Navigate to="/login" />
          } />

          <Route path="/admin" element={
            session ? (
              profile?.role === 'admin' ? <AdminPage session={session} profile={profile} /> : <div>Unauthorized</div>
            ) : <Navigate to="/login" />
          } />

          <Route path="/speech" element={
            session ? <SpeechPage session={session} profile={profile} /> : <Navigate to="/login" />
          } />

          <Route path="*" element={<div>404</div>} />
        </Routes>
      </main>
    </div>
  )
}

export default App;
