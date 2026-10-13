import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api';
import { TransactionTable } from './Dashboard';

export default function IssueItems() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [students, setStudents] = useState([]);
  const [items, setItems] = useState([]);
  const [assets, setAssets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState({ studentId: '', itemId: '', assetId: '', quantity: '1', purpose: '', issueDate: new Date().toISOString().slice(0, 10) });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const selectedItem = items.find((item) => item._id === form.itemId);

  const load = async () => {
    setLoading(true);
    try {
      if (user?.role === 'student') {
        const response = await api.get('/api/transactions/my');
        setTransactions(response.data?.data || []);
      } else {
        const [studentResponse, itemResponse, transactionResponse] = await Promise.all([
          api.get('/api/students'), api.get('/api/items'), api.get('/api/transactions'),
        ]);
        setStudents(studentResponse.data?.data || []);
        setItems(itemResponse.data?.data || []);
        setTransactions(transactionResponse.data?.data || []);
      }
      setError('');
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not load issue data.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!selectedItem || selectedItem.trackingType !== 'asset') { setAssets([]); setForm((current) => ({ ...current, assetId: '' })); return; }
    api.get('/api/assets', { params: { itemId: selectedItem._id, status: 'available', condition: 'good' } })
      .then((response) => setAssets(response.data?.data || []))
      .catch((requestError) => setError(getErrorMessage(requestError, 'Could not load available assets.')));
  }, [selectedItem?._id, selectedItem?.trackingType]);

  const issue = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      const result = await api.post('/api/transactions/issue', {
        ...form,
        quantity: Number(form.quantity),
        assetId: form.assetId || undefined,
      });
      setSuccess(result.data?.message || 'Item issued successfully.');
      setForm((current) => ({ ...current, itemId: '', assetId: '', purpose: '', quantity: '1' }));
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not issue item.')); }
  };
  const requestRenewal = async (transaction) => {
    setError('');
    setSuccess('');
    try {
      const response = await api.post(`/api/transactions/${transaction._id}/renewal-request`);
      setSuccess(response.data?.message || 'Renewal request submitted.');
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not request renewal.')); }
  };

  if (user?.role === 'student') {
    return <>
      <div className="page-heading"><div><h1>My issued items</h1><p>Check due dates or request a renewal from the coordinator.</p></div></div>
      {error && <div className="notice error">{error}</div>}{success && <div className="notice success">{success}</div>}
      <section className="panel"><h2 className="panel-heading">Issue history</h2>
        {loading ? <div className="loading">Loading your issues…</div> : !transactions.length ? <div className="empty-state">You do not have any issued items.</div> : <>
          <TransactionTable transactions={transactions} />
          <div className="table-wrap"><table><thead><tr><th>Item</th><th>Due date</th><th>Renewal</th><th>Action</th></tr></thead>
            <tbody>{transactions.filter((transaction) => transaction.status !== 'returned').map((transaction) => {
              const pending = transaction.renewalRequests?.some((request) => request.approvalStatus === 'pending');
              return <tr key={transaction._id}><td>{transaction.itemId?.name || 'Item'}</td><td>{new Date(transaction.dueDate).toLocaleDateString()}</td><td>{pending ? <span className="badge amber">Pending</span> : '—'}</td><td><button className="btn secondary small" disabled={pending} onClick={() => requestRenewal(transaction)}>{pending ? 'Pending' : 'Request renewal'}</button></td></tr>;
            })}</tbody>
          </table></div>
        </>}
      </section>
    </>;
  }

  return <>
    <div className="page-heading"><div><h1>Issue items</h1><p>Register an item issue to a student and calculate its due date automatically.</p></div></div>
    {error && <div className="notice error">{error}</div>}{success && <div className="notice success">{success}</div>}
    <section className="panel"><h2 className="panel-heading">New issue</h2>
      <form onSubmit={issue}><div className="field-grid">
        <label className="field">Student<select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} required><option value="">Select student</option>{students.map((student) => <option key={student._id} value={student._id}>{student.name} · {student.enrollmentNo}</option>)}</select></label>
        <label className="field">Inventory item<select value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value, assetId: '' })} required><option value="">Select item</option>{items.map((item) => <option key={item._id} value={item._id}>{item.name} · {item.availableQty ?? 0} available</option>)}</select></label>
        {selectedItem?.trackingType === 'asset' ? <label className="field">Available asset<select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} required><option value="">Select asset tag</option>{assets.map((asset) => <option key={asset._id} value={asset._id}>{asset.assetTag}{asset.serialNumber ? ` · ${asset.serialNumber}` : ''}</option>)}</select></label> : selectedItem && <label className="field">Quantity<input type="number" min="1" max={selectedItem.availableQty} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required /></label>}
        <label className="field">Issue date<input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required /></label>
        <label className="field full">Purpose<textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} required /></label>
      </div><div className="form-actions"><button className="btn" disabled={!students.length || !items.length}>Confirm issue</button></div></form>
    </section>
    <section className="panel"><h2 className="panel-heading">Recent transactions</h2>{loading ? <div className="loading">Loading transactions…</div> : <TransactionTable transactions={transactions.slice(0, 10)} />}</section>
  </>;
}
