import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (error) return alert(error.message);
    nav('/');
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h2>Login</h2>
        <form onSubmit={handleLogin} className="col">
          <label>Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} />
          <div style={{ display:'flex', gap:8 }}>
            <button type="submit" disabled={loading}>{loading ? 'Loading...' : 'Login'}</button>
            <button type="button" onClick={()=>nav('/register')}>Register</button>
          </div>
        </form>
      </div>
    </div>
  )
}
