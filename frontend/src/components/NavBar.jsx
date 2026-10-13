import React from 'react';

export default function NavBar({ currentPage, setPage }) {
  const pages = ['Dashboard', 'Inventory', 'Students', 'IssueItem', 'ReturnItem'];
  return (
    <nav style={{ background: 'linear-gradient(90deg, #1e3c72, #2a5298)', padding: '1rem', color: '#fff', display: 'flex', gap: '1rem' }}>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => setPage(p)}
          style={{
            background: p === currentPage ? 'rgba(255,255,255,0.2)' : 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => {
          sessionStorage.removeItem('token');
          setPage('Login');
        }}
        style={{ marginLeft: 'auto', background: 'transparent', border: '1px solid #fff', color: '#fff', cursor: 'pointer' }}
      >
        Logout
      </button>
    </nav>
  );
}
