import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api';

export default function ReturnItems() {
  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ returnedQty: '1', conditionOnReturn: 'good', actualReturnDate: new Date().toISOString().slice(0, 10), notes: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/transactions');
      setTransactions((response.data?.data || []).filter((transaction) => transaction.outstandingQty > 0 && transaction.status !== 'returned'));
      setError('');
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not load outstanding issues.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!selected) return;
    setError('');
    setSuccess('');
    try {
      const response = await api.post(`/api/transactions/${selected._id}/return`, { ...form, returnedQty: Number(form.returnedQty) });
      setSuccess(response.data?.message || 'Return processed.');
      setSelected(null);
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not process return.')); }
  };

  return <>
    <div className="page-heading"><div><h1>Returns</h1><p>Process full or partial returns and record the returned condition.</p></div></div>
    {error && <div className="notice error">{error}</div>}{success && <div className="notice success">{success}</div>}
    {selected && <section className="panel"><h2 className="panel-heading">Record return · {selected.itemId?.name || 'Item'} for {selected.studentId?.name || 'Student'}</h2>
      <form onSubmit={submit}><div className="field-grid">
        <label className="field">Quantity returned<input type="number" min="1" max={selected.outstandingQty} value={form.returnedQty} onChange={(e) => setForm({ ...form, returnedQty: e.target.value })} required /></label>
        <label className="field">Condition on return<select value={form.conditionOnReturn} onChange={(e) => setForm({ ...form, conditionOnReturn: e.target.value })}><option value="good">Good</option><option value="damaged">Damaged</option><option value="lost">Lost</option></select></label>
        <label className="field">Return date<input type="date" value={form.actualReturnDate} onChange={(e) => setForm({ ...form, actualReturnDate: e.target.value })} required /></label>
        <label className="field">Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div><div className="form-actions"><button className="btn">Save return</button><button className="btn secondary" type="button" onClick={() => setSelected(null)}>Cancel</button></div></form>
    </section>}
    <section className="panel"><h2 className="panel-heading">Items currently issued</h2>
      {loading ? <div className="loading">Loading outstanding issues…</div> : !transactions.length ? <div className="empty-state">There are no outstanding items to return.</div> : <div className="table-wrap"><table>
        <thead><tr><th>Student</th><th>Item</th><th>Issued</th><th>Due date</th><th>Outstanding</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{transactions.map((transaction) => <tr key={transaction._id}>
          <td><strong>{transaction.studentId?.name || '—'}</strong><div className="muted">{transaction.studentId?.enrollmentNo}</div></td><td>{transaction.itemId?.name || '—'}{transaction.assetId?.assetTag && <div className="muted">{transaction.assetId.assetTag}</div>}</td><td>{new Date(transaction.issueDate).toLocaleDateString()}</td><td>{new Date(transaction.dueDate).toLocaleDateString()}</td><td>{transaction.outstandingQty}</td><td><span className={`badge ${transaction.computedStatus === 'overdue' ? 'red' : ''}`}>{transaction.computedStatus || transaction.status}</span></td><td><button className="btn small" onClick={() => { setSelected(transaction); setForm({ returnedQty: String(transaction.outstandingQty), conditionOnReturn: 'good', actualReturnDate: new Date().toISOString().slice(0, 10), notes: '' }); }}>Process return</button></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
