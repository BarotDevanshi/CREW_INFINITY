`import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api';

const defaultPolicy = { renewalDays: 15, maxRenewals: 3, maxIssueQty: 5, notes: '' };

export default function Stock() {
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [policy, setPolicy] = useState(defaultPolicy);
  const [adjustment, setAdjustment] = useState({ itemId: '', type: 'new_stock', quantityChange: '1', reason: '', conditionFrom: 'good', conditionTo: 'damaged' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const [itemsResponse, logsResponse, policyResponse] = await Promise.all([
        api.get('/api/items'), api.get('/api/stock/log'), api.get('/api/stock/policy'),
      ]);
      setItems(itemsResponse.data?.data || []);
      setLogs(logsResponse.data?.data || []);
      setPolicy({ ...defaultPolicy, ...(policyResponse.data?.data || {}) });
      setError('');
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not load stock information.')); }
  };
  useEffect(() => { load(); }, []);
  const adjust = async (event) => {
    event.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.post('/api/stock/adjust', {
        ...adjustment,
        quantityChange: Number(adjustment.quantityChange),
        ...(adjustment.type === 'condition_change' ? {} : { conditionFrom: undefined, conditionTo: undefined }),
      });
      setSuccess('Stock adjustment recorded.');
      setAdjustment((current) => ({ ...current, quantityChange: '1', reason: '' }));
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not adjust stock.')); }
  };
  const savePolicy = async (event) => {
    event.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.put('/api/stock/policy', { ...policy, renewalDays: Number(policy.renewalDays), maxRenewals: Number(policy.maxRenewals), maxIssueQty: Number(policy.maxIssueQty) });
      setSuccess('Issue policy updated.');
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not update policy.')); }
  };

  return <>
    <div className="page-heading"><div><h1>Stock & policy</h1><p>Adjust available quantities, review stock movements and set issue rules.</p></div></div>
    {error && <div className="notice error">{error}</div>}{success && <div className="notice success">{success}</div>}
    <div className="stat-grid">
      <div className="stat-card"><div className="stat-top">Item types<span className="stat-icon">▦</span></div><div className="stat-value">{items.length}</div><div className="stat-foot">Active inventory records</div></div>
      <div className="stat-card"><div className="stat-top">Stock movements<span className="stat-icon">↕</span></div><div className="stat-value">{logs.length}</div><div className="stat-foot">Recorded stock changes</div></div>
    </div>
    <div className="panel"><h2 className="panel-heading">Record stock adjustment</h2><form onSubmit={adjust}>
      <div className="field-grid">
        <label className="field">Item<select value={adjustment.itemId} onChange={(e) => setAdjustment({ ...adjustment, itemId: e.target.value })} required><option value="">Select item</option>{items.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.code})</option>)}</select></label>
        <label className="field">Adjustment type<select value={adjustment.type} onChange={(e) => setAdjustment({ ...adjustment, type: e.target.value })}><option value="new_stock">New stock</option><option value="correction">Stock correction</option><option value="retirement">Retirement</option><option value="condition_change">Condition change</option></select></label>
        <label className="field">{adjustment.type === 'retirement' ? 'Units retired' : 'Quantity change'}<input type="number" min={adjustment.type === 'retirement' ? '1' : undefined} value={adjustment.quantityChange} onChange={(e) => setAdjustment({ ...adjustment, quantityChange: e.target.value })} required /></label>
        {adjustment.type === 'condition_change' && <>
          <label className="field">From condition<select value={adjustment.conditionFrom} onChange={(e) => setAdjustment({ ...adjustment, conditionFrom: e.target.value })}><option value="good">Good</option><option value="damaged">Damaged</option><option value="lost">Lost</option><option value="maintenance">Maintenance</option></select></label>
          <label className="field">To condition<select value={adjustment.conditionTo} onChange={(e) => setAdjustment({ ...adjustment, conditionTo: e.target.value })}><option value="good">Good</option><option value="damaged">Damaged</option><option value="lost">Lost</option><option value="maintenance">Maintenance</option></select></label>
        </>}
        <label className="field full">Reason<textarea value={adjustment.reason} onChange={(e) => setAdjustment({ ...adjustment, reason: e.target.value })} required /></label>
      </div><div className="form-actions"><button className="btn">Record adjustment</button></div>
    </form></div>
    <div className="panel"><h2 className="panel-heading">Issue policy</h2><form onSubmit={savePolicy}>
      <div className="field-grid">
        <label className="field">Issue duration (days)<input type="number" value="15" readOnly /><small className="muted">Fixed: all issued items are due 15 days after issue.</small></label>
        <label className="field">Renewal duration (days)<input type="number" min="1" value={policy.renewalDays} onChange={(e) => setPolicy({ ...policy, renewalDays: e.target.value })} /></label>
        <label className="field">Maximum renewals<input type="number" min="0" value={policy.maxRenewals} onChange={(e) => setPolicy({ ...policy, maxRenewals: e.target.value })} /></label>
        <label className="field">Maximum quantity per issue<input type="number" min="1" value={policy.maxIssueQty} onChange={(e) => setPolicy({ ...policy, maxIssueQty: e.target.value })} /></label>
        <label className="field full">Policy notes<textarea value={policy.notes || ''} onChange={(e) => setPolicy({ ...policy, notes: e.target.value })} /></label>
      </div><div className="form-actions"><button className="btn">Save policy</button></div>
    </form></div>
    <section className="panel"><h2 className="panel-heading">Recent stock movements</h2>{!logs.length ? <div className="empty-state">No stock adjustments recorded.</div> : <div className="table-wrap"><table>
      <thead><tr><th>Date</th><th>Item</th><th>Type</th><th>Change</th><th>Reason</th><th>Recorded by</th></tr></thead>
      <tbody>{logs.slice(0, 50).map((log) => <tr key={log._id}><td>{new Date(log.date).toLocaleString()}</td><td>{log.itemId?.name || '—'}</td><td><span className="badge">{log.type?.replace('_', ' ')}</span></td><td>{log.quantityChange}</td><td>{log.reason || '—'}</td><td>{log.performedBy?.name || '—'}</td></tr>)}</tbody>
    </table></div>}</section>
  </>;
}
