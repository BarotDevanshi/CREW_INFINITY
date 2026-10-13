import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api';

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [stock, setStock] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [renewals, setRenewals] = useState([]);
  const [remarks, setRemarks] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const responses = await Promise.all([
        api.get('/api/reports/summary'),
        api.get('/api/reports/stock'),
        api.get('/api/transactions/overdue'),
        api.get('/api/transactions/upcoming-due'),
        api.get('/api/transactions/pending-renewals'),
      ]);
      setSummary(responses[0].data?.data || {});
      setStock(responses[1].data?.data || []);
      setOverdue(responses[2].data?.data || []);
      setUpcoming(responses[3].data?.data || []);
      setRenewals(responses[4].data?.data || []);
      setError('');
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not load reports.')); }
  };
  useEffect(() => { load(); }, []);

  const resolveRenewal = async (transaction, request, action) => {
    setError(''); setSuccess('');
    try {
      await api.put(`/api/transactions/${transaction._id}/renewal-${action}`, {
        renewalRequestId: request._id,
        remarks: remarks[request._id] || '',
      });
      setSuccess(action === 'approve' ? 'Renewal approved and due date extended.' : 'Renewal request rejected.');
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not update renewal request.')); }
  };

  return <>
    <div className="page-heading"><div><h1>Reports</h1><p>Operational overview, due dates and renewal decisions.</p></div><button className="btn secondary" onClick={load}>Refresh data</button></div>
    {error && <div className="notice error">{error}</div>}{success && <div className="notice success">{success}</div>}
    <div className="stat-grid">
      <div className="stat-card"><div className="stat-top">Items / units<span className="stat-icon">▦</span></div><div className="stat-value">{summary?.totalItems ?? '—'} / {summary?.totalQty ?? '—'}</div><div className="stat-foot">Inventory types and total count</div></div>
      <div className="stat-card"><div className="stat-top">Active issues<span className="stat-icon">↗</span></div><div className="stat-value">{summary?.activeTransactions ?? '—'}</div><div className="stat-foot">Outstanding transactions</div></div>
      <div className="stat-card"><div className="stat-top">Overdue<span className="stat-icon">!</span></div><div className="stat-value">{summary?.overdueTransactions ?? '—'}</div><div className="stat-foot">Past due date</div></div>
      <div className="stat-card"><div className="stat-top">Renewals pending<span className="stat-icon">⟳</span></div><div className="stat-value">{summary?.pendingRenewals ?? '—'}</div><div className="stat-foot">Waiting coordinator review</div></div>
    </div>
    <section className="panel"><h2 className="panel-heading">Stock overview</h2>{!stock.length ? <div className="empty-state">No stock data available.</div> : <div className="table-wrap"><table>
      <thead><tr><th>Item</th><th>Category</th><th>Total</th><th>Available</th><th>Issued</th><th>Overdue</th><th>Location</th></tr></thead>
      <tbody>{stock.map((item) => <tr key={item._id}><td><strong>{item.name}</strong><div className="muted">{item.code}</div></td><td>{item.category}</td><td>{item.totalQty}</td><td>{item.availableQty ?? '—'}</td><td>{item.issuedQty ?? 0}</td><td>{item.overdueQty ?? 0}</td><td>{item.locationId?.name || '—'}</td></tr>)}</tbody>
    </table></div>}</section>
    <div className="panel"><h2 className="panel-heading">Overdue issues</h2>{!overdue.length ? <div className="empty-state">No overdue issues. Great work.</div> : <div className="table-wrap"><table>
      <thead><tr><th>Student</th><th>Item</th><th>Due date</th><th>Days overdue</th></tr></thead>
      <tbody>{overdue.map((transaction) => <tr key={transaction._id}><td>{transaction.studentId?.name}<div className="muted">{transaction.studentId?.enrollmentNo}</div></td><td>{transaction.itemId?.name}{transaction.assetId?.assetTag ? ` · ${transaction.assetId.assetTag}` : ''}</td><td>{new Date(transaction.dueDate).toLocaleDateString()}</td><td><span className="badge red">{transaction.overdueDays} days</span></td></tr>)}</tbody>
    </table></div>}</div>
    <div className="panel"><h2 className="panel-heading">Due in the next 3 days</h2>{!upcoming.length ? <div className="empty-state">No items are due soon.</div> : <div className="table-wrap"><table>
      <thead><tr><th>Student</th><th>Item</th><th>Due date</th><th>Days left</th></tr></thead>
      <tbody>{upcoming.map((transaction) => <tr key={transaction._id}><td>{transaction.studentId?.name}<div className="muted">{transaction.studentId?.enrollmentNo}</div></td><td>{transaction.itemId?.name}</td><td>{new Date(transaction.dueDate).toLocaleDateString()}</td><td>{transaction.daysLeft}</td></tr>)}</tbody>
    </table></div>}</div>
    <section className="panel"><h2 className="panel-heading">Pending renewal requests</h2>{!renewals.length ? <div className="empty-state">No pending renewal requests.</div> : <div className="table-wrap"><table>
      <thead><tr><th>Student</th><th>Item</th><th>Due date</th><th>Remarks</th><th>Decision</th></tr></thead>
      <tbody>{renewals.flatMap((transaction) => (transaction.renewalRequests || []).filter((request) => request.approvalStatus === 'pending').map((request) => <tr key={request._id}>
        <td>{transaction.studentId?.name}<div className="muted">{transaction.studentId?.enrollmentNo}</div></td><td>{transaction.itemId?.name}</td><td>{new Date(transaction.dueDate).toLocaleDateString()}</td>
        <td><input aria-label="Renewal remarks" placeholder="Optional remarks" value={remarks[request._id] || ''} onChange={(e) => setRemarks({ ...remarks, [request._id]: e.target.value })} /></td>
        <td><div className="row-actions"><button className="btn small" onClick={() => resolveRenewal(transaction, request, 'approve')}>Approve</button><button className="btn danger small" onClick={() => resolveRenewal(transaction, request, 'reject')}>Reject</button></div></td>
      </tr>))}</tbody>
    </table></div>}</section>
  </>;
}
