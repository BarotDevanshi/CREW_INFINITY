import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api';

const StatCard = ({ label, value, symbol, foot }) => (
  <div className="stat-card">
    <div className="stat-top"><span>{label}</span><span className="stat-icon">{symbol}</span></div>
    <div className="stat-value">{value}</div>
    <div className="stat-foot">{foot}</div>
  </div>
);

const Dashboard = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [report, setReport] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        if (user?.role === 'student') {
          const response = await api.get('/api/transactions/my');
          if (active) setTransactions(response.data?.data || []);
        } else {
          const response = await api.get('/api/reports/summary');
          if (active) setReport(response.data?.data || {});
        }
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError, 'Unable to load dashboard data.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [user?.role]);

  if (loading) return <div className="loading">Loading your dashboard…</div>;

  const activeTransactions = transactions.filter((transaction) => ['active', 'partially_returned', 'overdue'].includes(transaction.status));

  return (
    <>
      <div className="page-heading">
        <div><h1>{user?.role === 'student' ? 'My dashboard' : 'Dashboard'}</h1><p>{user?.role === 'student' ? 'Your issued items and due dates.' : 'An overview of department inventory and activity.'}</p></div>
        {user?.role === 'coordinator' && <Link className="btn" to="/issue">＋ Issue an item</Link>}
      </div>
      {error && <div className="notice error">{error}</div>}
      {user?.role === 'student' ? (
        <>
          <div className="stat-grid">
            <StatCard label="Items currently with you" value={activeTransactions.length} symbol="↗" foot="Active issues" />
            <StatCard label="Total transactions" value={transactions.length} symbol="▤" foot="All issue records" />
          </div>
          <section className="panel">
            <h2 className="panel-heading">My issued items</h2>
            <TransactionTable transactions={transactions} />
          </section>
        </>
      ) : (
        <>
          <div className="stat-grid">
            <StatCard label="Inventory item types" value={report?.totalItems ?? '—'} symbol="▦" foot={`${report?.totalQty ?? 0} units total`} />
            <StatCard label="Students" value={report?.totalStudents ?? '—'} symbol="♙" foot="Active student accounts" />
            <StatCard label="Active issues" value={report?.activeTransactions ?? '—'} symbol="↗" foot="Items currently issued" />
            <StatCard label="Overdue items" value={report?.overdueTransactions ?? '—'} symbol="!" foot="Requires follow-up" />
          </div>
          <div className="stat-grid">
            <StatCard label="Renewal requests" value={report?.pendingRenewals ?? '—'} symbol="⟳" foot="Awaiting decision" />
            <StatCard label="Damaged stock" value={report?.totalDamaged ?? '—'} symbol="◇" foot="Units marked damaged" />
            <StatCard label="Lost stock" value={report?.totalLost ?? '—'} symbol="⌕" foot="Units marked lost" />
            <StatCard label="Maintenance" value={report?.totalMaintenance ?? '—'} symbol="⚙" foot="Units under maintenance" />
          </div>
          <div className="panel">
            <h2 className="panel-heading">Quick actions</h2>
            <div className="toolbar">
              <Link className="btn" to="/issue">Issue items</Link>
              <Link className="btn secondary" to="/students">Manage students</Link>
              <Link className="btn secondary" to="/inventory">View inventory</Link>
              <Link className="btn secondary" to="/reports">Open reports</Link>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export function TransactionTable({ transactions }) {
  if (!transactions.length) return <div className="empty-state">No transactions to show.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Item</th><th>Issued</th><th>Due date</th><th>Qty left</th><th>Status</th></tr></thead>
        <tbody>{transactions.map((transaction) => (
          <tr key={transaction._id}>
            <td><strong>{transaction.itemId?.name || 'Item'}</strong>{transaction.assetId?.assetTag && <div className="muted">{transaction.assetId.assetTag}</div>}</td>
            <td>{transaction.issueDate ? new Date(transaction.issueDate).toLocaleDateString() : '—'}</td>
            <td>{transaction.dueDate ? new Date(transaction.dueDate).toLocaleDateString() : '—'}</td>
            <td>{transaction.outstandingQty ?? 0}</td>
            <td><span className={`badge ${transaction.computedStatus === 'overdue' ? 'red' : transaction.status === 'returned' ? 'green' : ''}`}>{transaction.computedStatus || transaction.status}</span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export default Dashboard;
