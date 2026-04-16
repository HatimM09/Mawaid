import React, { useState } from 'react';

const AdminLogin = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  return (
    <div style={{ padding: 20, maxWidth: 400, margin: '0 auto', textAlign: 'center' }}>
      <h2>Admin Login</h2>
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Enter Secret Key"
        style={{ 
          width: '100%', padding: '14px 16px', marginBottom: 16, 
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(196,156,90,0.3)',
          borderRadius: 12, color: '#f0ead8', outline: 'none', textAlign: 'center',
          fontSize: 16
        }}
      />
      {error && <div style={{ color: '#e05555', marginBottom: 16, fontSize: 14 }}>{error}</div>}
      <button onClick={() => {
        if (password === 'almawaid') {
          setError('');
          onLogin();
        } else setError('🚫 Invalid Key');
      }} style={{ 
        width: '100%', padding: '14px', borderRadius: 12, border: 'none',
        background: 'linear-gradient(135deg,#d4aa6a,#a87c40)', color: '#fff',
        fontSize: 16, fontWeight: 700, cursor: 'pointer',
        boxShadow: '0 8px 16px rgba(196,156,90,0.2)'
      }}>Access Dashboard</button>
    </div>
  );
};
export default AdminLogin;
