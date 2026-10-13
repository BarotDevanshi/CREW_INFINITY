import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api';

const emptyItem = { code: '', name: '', category: '', description: '', makeModel: '', trackingType: 'quantity', totalQty: '0', locationId: '' };

export default function InventoryItems() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(emptyItem);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/items', { params: search ? { search } : {} });
      setItems(response.data?.data || []);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not load inventory.'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    api.get('/api/locations')
      .then((response) => setLocations(response.data?.data || []))
      .catch((requestError) => setError(getErrorMessage(requestError, 'Could not load storage locations.')));
  }, [search]);

  const startEdit = (item) => {
    setEditing(item);
    setForm({ ...emptyItem, ...item, totalQty: String(item.totalQty), locationId: item.locationId?._id || item.locationId || '' });
    setShowForm(true);
  };
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const payload = {
      code: form.code,
      name: form.name,
      category: form.category,
      description: form.description,
      makeModel: form.makeModel,
      trackingType: form.trackingType,
      totalQty: Number(form.totalQty),
      locationId: form.locationId || undefined,
    };
    try {
      if (editing) {
        await api.put(`/api/items/${editing._id}`, payload);
        setSuccess('Inventory item updated.');
      } else {
        await api.post('/api/items', payload);
        setSuccess('Inventory item added.');
      }
      setShowForm(false);
      setForm(emptyItem);
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not save inventory item.'));
    }
  };
  const deactivate = async (item) => {
    if (!window.confirm(`Deactivate ${item.name}?`)) return;
    try {
      await api.delete(`/api/items/${item._id}`);
      setSuccess('Item deactivated.');
      await load();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not deactivate item.'));
    }
  };

  return (
    <>
      <div className="page-heading"><div><h1>Inventory</h1><p>Track quantity-based stock and individually tracked equipment.</p></div>{user?.role === 'coordinator' && <button className="btn" onClick={() => { setEditing(null); setForm(emptyItem); setShowForm(true); }}>＋ Add item</button>}</div>
      {error && <div className="notice error">{error}</div>}{success && <div className="notice success">{success}</div>}
      {showForm && user?.role === 'coordinator' && <section className="panel">
        <h2 className="panel-heading">{editing ? 'Edit inventory item' : 'Add inventory item'}</h2>
        <form onSubmit={submit}><div className="field-grid">
          <label className="field">Item code<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required /></label>
          <label className="field">Item name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label className="field">Category<input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required /></label>
          <label className="field">Make / model<input value={form.makeModel} onChange={(e) => setForm({ ...form, makeModel: e.target.value })} /></label>
          <label className="field">Tracking type<select value={form.trackingType} onChange={(e) => setForm({ ...form, trackingType: e.target.value })}><option value="quantity">Quantity tracked</option><option value="asset">Individual asset tracked</option></select></label>
          <label className="field">Total quantity<input type="number" min="0" value={form.totalQty} onChange={(e) => setForm({ ...form, totalQty: e.target.value })} required /></label>
          <label className="field">Storage location<select value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}><option value="">No location</option>{locations.map((location) => <option key={location._id} value={location._id}>{location.name}</option>)}</select></label>
          <label className="field full">Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        </div><div className="form-actions"><button className="btn">{editing ? 'Save changes' : 'Add item'}</button><button type="button" className="btn secondary" onClick={() => setShowForm(false)}>Cancel</button></div></form>
      </section>}
      <section className="panel">
        <div className="toolbar"><input placeholder="Search items, code or category" value={search} onChange={(e) => setSearch(e.target.value)} /><span className="muted">{items.length} item types</span></div>
        {loading ? <div className="loading">Loading inventory…</div> : items.length === 0 ? <div className="empty-state">No inventory items found.</div> : <div className="table-wrap"><table>
          <thead><tr><th>Item</th><th>Category</th><th>Tracking</th><th>Total</th><th>Available</th><th>Issued</th><th>Location</th>{user?.role === 'coordinator' && <th>Actions</th>}</tr></thead>
          <tbody>{items.map((item) => <tr key={item._id}>
            <td><strong>{item.name}</strong><div className="muted">{item.code}</div></td><td>{item.category}</td><td><span className="badge">{item.trackingType}</span></td><td>{item.totalQty}</td><td><strong>{item.availableQty ?? '—'}</strong></td><td>{item.issuedQty ?? 0}</td><td>{item.locationId?.name || '—'}</td>
            {user?.role === 'coordinator' && <td><div className="row-actions"><button className="btn secondary small" onClick={() => startEdit(item)}>Edit</button><button className="btn danger small" onClick={() => deactivate(item)}>Archive</button></div></td>}
          </tr>)}</tbody>
        </table></div>}
      </section>
    </>
  );
}
