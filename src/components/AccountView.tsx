import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export function AccountView() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [name, setName] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setName(data.session?.user.user_metadata.display_name ?? ''); });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next); setName(next?.user.user_metadata.display_name ?? '');
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const action = async (kind: 'login' | 'signup' | 'save' | 'logout' | 'reset' | 'password') => {
    setBusy(true); setNotice('');
    try {
      if (!supabase) throw new Error('Supabase is not configured.');
      if (kind === 'save' && session) {
        if (!name.trim() || name.length > 80) throw new Error('Enter a display name of 1–80 characters.');
        const { error } = await supabase.auth.updateUser({ data: { display_name: name.trim() } }); if (error) throw error;
        const result = await supabase.from('profiles').upsert({ id: session.user.id, display_name: name.trim() }); if (result.error) throw result.error;
        setNotice('Profile saved.');
      } else if (kind === 'logout') {
        const { error } = await supabase.auth.signOut(); if (error) throw error;
      } else if (kind === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/profile' }); if (error) throw error;
        setNotice('If an account exists, a reset email has been sent.');
      } else if (kind === 'password') {
        if (password.length < 8) throw new Error('Use at least eight characters.');
        const { error } = await supabase.auth.updateUser({ password }); if (error) throw error;
        setPassword(''); setRecovery(false); setNotice('Password updated.');
      } else {
        if (password.length < 8) throw new Error('Use at least eight characters.');
        const result = kind === 'signup' ? await supabase.auth.signUp({ email, password }) : await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        setPassword(''); if (!result.data.session) setNotice('Check your email to confirm your account.');
      }
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Request failed.'); } finally { setBusy(false); }
  };
  const input = 'w-full p-4 rounded-2xl bg-white/5 border border-white/10';
  const button = 'w-full p-4 rounded-2xl bg-brand font-bold disabled:opacity-40';
  return <div className="max-w-lg mx-auto px-6 pt-12 pb-32 space-y-6"><h1 className="text-3xl font-black italic">Your Profile</h1>
    {notice && <p role="status">{notice}</p>}
    {recovery ? <><input aria-label="New password" className={input} type="password" autoComplete="new-password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)} /><button className={button} disabled={busy} onClick={() => void action('password')}>Update password</button></> : session ? <>
      <p className="text-white/60">{session.user.email}</p><input aria-label="Display name" className={input} value={name} maxLength={80} onChange={e => setName(e.target.value)} />
      <button className={button} disabled={busy} onClick={() => void action('save')}>Save profile</button>
      {session.user.app_metadata.role === 'admin' && <Link to="/admin" className="block p-4 rounded-2xl glass">Manage movie catalog</Link>}
      <button className={button} disabled={busy} onClick={() => void action('logout')}>Sign out</button>
    </> : <>
      <input aria-label="Email address" className={input} type="email" autoComplete="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input aria-label="Password" className={input} type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
      <button className={button} disabled={busy} onClick={() => void action('login')}>Sign in</button><button className={button} disabled={busy} onClick={() => void action('signup')}>Create account</button><button className={button} disabled={busy} onClick={() => void action('reset')}>Reset password</button>
    </>}
  </div>;
}
