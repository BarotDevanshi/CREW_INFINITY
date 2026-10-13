import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api';

const empty = { department: '', type: 'laboratory', name: '', building: '', floor: '', notes: '' };

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    try {
      const response = await api.get('/api/locations');
      setLocations(response.data?.data || []);
      setError('');
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not load locations.')); }
  };
  useEffect(() => { load(); }, []);
  const save = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const payload = {
        department: form.department,
        type: form.type,
        name: form.name,
        building: form.building,
        floor: form.floor,
        notes: form.notes,
      };
      if (editing) await api.put(`/api/locations/${editing._id}`, payload);
      else await api.post('/api/locations', payload);
      setSuccess(editing ? 'Location updated.' : 'Location created.');
      setOpen(false);
      setForm(empty);
      setEditing(null);
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not save location.')); }
  };
  const deactivate = async (location) => {
    if (!window.confirm(`Deactivate ${location.name}?`)) return;
    try {
      await api.delete(`/api/locations/${location._id}`);
      setSuccess('Location deactivated.');
      await load();
    } catch (requestError) { setError(getErrorMessage(requestError, 'Could not deactivate location.')); }
  };

  return <>
    <div className="page-heading"><div><h1>Locations</h1><p>Manage department storage locations and labs.</p></div><button className="btn" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}>＋ Add location</button></div>
    {error && <div className="notice error">{error}</div>}{success && <div className="notice success">{success}</div>}
    {open && <section className="panel"><h2 className="panel-heading">{editing ? 'Edit location' : 'New location'}</h2><form onSubmit={save}>
      <div className="field-grid">
        <label className="field">Department<input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required /></label>
        <label className="field">Location type<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="laboratory">Laboratory</option><option value="room">Room</option><option value="cupboard">Cupboard</option><option value="other">Other</option></select></label>
        <label className="field">Location name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label className="field">Building<input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} /></label>
        <label className="field">Floor<input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></label>
        <label className="field">Notes<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
      </div><div className="form-actions"><button className="btn">{editing ? 'Save location' : 'Create location'}</button><button type="button" className="btn secondary" onClick={() => setOpen(false)}>Cancel</button></div>
    </form></section>}
    <section className="panel"><div className="panel-heading">Active storage locations</div>{!locations.length ? <div className="empty-state">No active locations are configured.</div> : <div className="table-wrap"><table>
      <thead><tr><th>Location</th><th>Department</th><th>Type</th><th>Building / floor</th><th>Actions</th></tr></thead>
      <tbody>{locations.map((location) => <tr key={location._id}><td><strong>{location.name}</strong></td><td>{location.department}</td><td><span className="badge">{location.type}</span></td><td>{[location.building, location.floor].filter(Boolean).join(' · ') || '—'}</td><td><div className="row-actions"><button className="btn secondary small" onClick={() => { setEditing(location); setForm({ ...empty, ...location }); setOpen(true); }}>Edit</button><button className="btn danger small" onClick={() => deactivate(location)}>Deactivate</button></div></td></tr>)}</tbody>
    </table></div>}</section>
  </>;
}
