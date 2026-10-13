import React, { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../api';

const blankStudent = { name: '', enrollmentNo: '', programme: '', semester: '1', contact: '', email: '', address: '', username: '', password: '' };

export default function Students() {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(blankStudent);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStudents = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/students', { params: search ? { search } : {} });
      setStudents(response.data?.data || []);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not load students.'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadStudents(); }, [search]);

  const openCreate = () => {
    setEditing(null);
    setForm(blankStudent);
    setShowForm(true);
    setError('');
  };
  const openEdit = (student) => {
    setEditing(student);
    setForm({ ...blankStudent, ...student, semester: String(student.semester), username: '', password: '' });
    setShowForm(true);
    setError('');
  };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editing) {
        const { name, programme, semester, contact, email, address } = form;
        await api.put(`/api/students/${editing._id}`, { name, programme, semester: Number(semester), contact, email, address });
        setSuccess('Student details updated.');
      } else {
        await api.post('/api/students', { ...form, semester: Number(form.semester) });
        setSuccess('Student account created.');
      }
      setShowForm(false);
      await loadStudents();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not save student.'));
    } finally {
      setSaving(false);
    }
  };
  const deactivate = async (student) => {
    if (!window.confirm(`Deactivate ${student.name}?`)) return;
    setError('');
    setSuccess('');
    try {
      await api.delete(`/api/students/${student._id}`);
      setSuccess('Student deactivated.');
      await loadStudents();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Could not deactivate student.'));
    }
  };

  return (
    <>
      <div className="page-heading"><div><h1>Students</h1><p>Student directory and their account details.</p></div><button className="btn" onClick={openCreate}>＋ Add student</button></div>
      {error && <div className="notice error">{error}</div>}
      {success && <div className="notice success">{success}</div>}
      {showForm && <section className="panel">
        <h2 className="panel-heading">{editing ? 'Edit student' : 'Register student'}</h2>
        <form onSubmit={submit}>
          <div className="field-grid">
            <label className="field">Full name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label className="field">Enrollment number<input value={form.enrollmentNo} disabled={!!editing} onChange={(e) => setForm({ ...form, enrollmentNo: e.target.value })} required={!editing} /></label>
            <label className="field">Programme<input value={form.programme} onChange={(e) => setForm({ ...form, programme: e.target.value })} required /></label>
            <label className="field">Semester<input type="number" min="1" max="10" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} required /></label>
            <label className="field">Contact number<input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} required /></label>
            <label className="field">Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            {!editing && <label className="field">Login username<input autoComplete="off" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /></label>}
            {!editing && <label className="field">Temporary password<input type="password" minLength="6" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>}
            <label className="field full">Address<textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
          </div>
          <div className="form-actions"><button className="btn" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create student'}</button><button className="btn secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button></div>
        </form>
      </section>}
      <section className="panel">
        <div className="toolbar"><input aria-label="Search students" placeholder="Search name, enrollment or email" value={search} onChange={(e) => setSearch(e.target.value)} /><span className="muted">{students.length} students</span></div>
        {loading ? <div className="loading">Loading students…</div> : students.length === 0 ? <div className="empty-state">No students found.</div> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Student</th><th>Enrollment</th><th>Programme</th><th>Semester</th><th>Contact</th><th>Email</th><th>Actions</th></tr></thead>
            <tbody>{students.map((student) => <tr key={student._id}>
              <td><strong>{student.name}</strong></td><td>{student.enrollmentNo}</td><td>{student.programme}</td><td>{student.semester}</td><td>{student.contact}</td><td>{student.email}</td>
              <td><div className="row-actions"><button className="btn secondary small" onClick={() => openEdit(student)}>Edit</button><button className="btn danger small" onClick={() => deactivate(student)}>Deactivate</button></div></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
