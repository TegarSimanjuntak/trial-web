import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const nav = useNavigate();

  async function handleRegister(e) {
    e.preventDefault();
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { full_name: name } }
    });
    if (error) return alert(error.message);
    alert('Check your email for confirmation (if enabled).');
    nav('/login');
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
        <h2>Register</h2>
        <form onSubmit={handleRegister} className="col">
          <label>Full name</label>
          <input value={name} onChange={e=>setName(e.target.value)} />
          <label>Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} />
          <label>Password</label>
          <input type="password" value={pass} onChange={e=>setPass(e.target.value)} />
          <div style={{ display:'flex', gap:8 }}>
            <button type="submit">Register</button>
            <button type="button" onClick={()=>nav('/login')}>Back</button>
          </div>
        </form>
      </div>
    </div>
  )
}
