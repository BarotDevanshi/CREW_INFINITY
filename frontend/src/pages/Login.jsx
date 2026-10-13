import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api';

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (localStorage.getItem('token')) return <Navigate to="/" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/api/auth/login', { username, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not sign in.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-screen">
      <section className="login-aside">
        <div className="brand"><span className="brand-mark">DI</span><span>Dept. Inventory<small>Management system</small></span></div>
        <div>
          <h1>Everything in its right place.</h1>
          <p>Manage department inventory, student issues, returns and stock from one clear workspace.</p>
        </div>
        <small className="muted">Department Inventory Management</small>
      </section>
      <main className="login-main">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Welcome back</h2>
          <p>Sign in with your department or student account.</p>
          {error && <div className="notice error" role="alert">{error}</div>}
          <label className="field">Username
            <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
          </label>
          <label className="field">Password
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className="btn" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </main>
    </div>
  );
};

export default Login;
