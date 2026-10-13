import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api';

const initial = { itemId: '', assetTag: '', serialNumber: '', locationId: '', condition: 'good', notes: '' };

export default function IndividualAssets() {
  const [assets, setAssets] = useState([]);
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/assets', { params: search ? { search } : {} });
      setAssets(response.data?.data || []);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not load assets.'));
    } finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    api.get('/api/items').then((res) => setItems((res.data?.data || []).filter((item) => item.trackingType === 'asset'))).catch(() => {});
    api.get('/api/locations').then((res) => setLocations(res.data?.data || [])).catch(() => {});
  }, [search]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    try {
      const payload = editing
        ? { serialNumber: form.serialNumber, locationId: form.locationId || null, condition: form.condition, notes: form.notes }
        : { ...form, locationId: form.locationId || undefined };
      if (editing) await api.put(`/api/assets/${editing._id}`, payload);
      else await api.post('/api/assets', payload);
      setSuccess(editing ? 'Asset updated.' : 'Asset registered.');
      setOpen(false);
      setEditing(null);
      setForm(initial);
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not save asset.')); }
  };
  const retire = async (asset) => {
    if (!window.confirm(`Retire asset ${asset.assetTag}?`)) return;
    try {
      await api.delete(`/api/assets/${asset._id}`, { data: { reason: 'Retired from asset management page' } });
      setSuccess('Asset retired.');
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not retire asset.')); }
  };
  const edit = (asset) => {
    setEditing(asset);
    setForm({ ...initial, ...asset, itemId: asset.itemId?._id || asset.itemId || '', locationId: asset.locationId?._id || asset.locationId || '' });
    setOpen(true);
  };

  return <>
    <div className="page-heading"><div><h1>Individual assets</h1><p>Manage tagged equipment, condition and storage locations.</p></div><button className="btn" onClick={() => { setEditing(null); setForm(initial); setOpen(true); }}>＋ Add asset</button></div>
    {error && <div className="notice error">{error}</div>}{success && <div className="notice success">{success}</div>}
    {open && <section className="panel"><h2 className="panel-heading">{editing ? `Edit ${editing.assetTag}` : 'Register asset'}</h2>
      <form onSubmit={submit}><div className="field-grid">
        <label className="field">Parent item<select disabled={!!editing} value={form.itemId} onChange={(e) => setForm({ ...form, itemId: e.target.value })} required><option value="">Select asset-tracked item</option>{items.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.code})</option>)}</select></label>
        <label className="field">Asset tag<input disabled={!!editing} value={form.assetTag} onChange={(e) => setForm({ ...form, assetTag: e.target.value })} required /></label>
        <label className="field">Serial number<input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} /></label>
        <label className="field">Condition<select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}><option value="good">Good</option><option value="damaged">Damaged</option><option value="lost">Lost</option><option value="maintenance">Maintenance</option></select></label>
        <label className="field">Location<select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}><option value="">No location</option>{locations.map((location) => <option key={location._id} value={location._id}>{location.name}</option>)}</select></label>
        <label className="field">Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div><div className="form-actions"><button className="btn">{editing ? 'Save asset' : 'Add asset'}</button><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button></div></form>
    </section>}
    <section className="panel"><div className="toolbar"><input placeholder="Search asset tag or serial number" value={search} onChange={(e) => setSearch(e.target.value)} /><span className="muted">{assets.length} assets</span></div>
      {loading ? <div className="loading">Loading assets…</div> : !assets.length ? <div className="empty-state">No assets found.</div> : <div className="table-wrap"><table>
        <thead><tr><th>Asset tag</th><th>Inventory item</th><th>Serial number</th><th>Condition</th><th>Status</th><th>Location</th><th>Actions</th></tr></thead>
        <tbody>{assets.map((asset) => <tr key={asset._id}><td><strong>{asset.assetTag}</strong></td><td>{asset.itemId?.name || '—'}</td><td>{asset.serialNumber || '—'}</td><td><span className={`badge ${asset.condition === 'good' ? 'green' : 'amber'}`}>{asset.condition}</span></td><td><span className={`badge ${asset.status === 'available' ? 'green' : ''}`}>{asset.status}</span></td><td>{asset.locationId?.name || '—'}</td><td><div className="row-actions"><button className="btn secondary small" onClick={() => edit(asset)}>Edit</button><button className="btn danger small" disabled={asset.status === 'issued'} onClick={() => retire(asset)}>Retire</button></div></td></tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}
