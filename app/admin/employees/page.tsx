// app/admin/employees/page.tsx
'use client';

import { useState, useEffect, CSSProperties } from 'react';
import Image from 'next/image';
import { createPagesBrowserClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

type Employee = {
  employee_id: number;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone?: string | null;
  designation?: string | null;
  department_id?: number | null;
  reporting_manager_id?: number | null;
  profile_photo?: string | null;
  hire_date?: string | null;
  status?: string;
  departments?: { name: string };
  reporting_manager?: { first_name: string; last_name: string };
};

export default function AdminEmployeesPage() {
  const supabase = createPagesBrowserClient();
  const router = useRouter();

  // -----------------------------------------------------------------
  // 1. SESSION CHECK
  // -----------------------------------------------------------------
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/auth/login');
        return;
      }

      const email = data.session.user.email || '';
      setUserEmail(email);

      // Fetch role from profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single();

      const role = profileData?.role || 'employee';
      setUserRole(role);

      // Only admin can access this page
      if (role !== 'admin') {
        alert('Access denied. Admin only.');
        router.push('/');
        return;
      }

      setIsAuthLoading(false);
    };

    checkSession();
  }, [router, supabase]);

  // -----------------------------------------------------------------
  // 2. EMPLOYEE MANAGEMENT
  // -----------------------------------------------------------------
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Employee>>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    designation: '',
    department_id: undefined,
    reporting_manager_id: undefined,
    profile_photo: '',
    status: 'active',
    hire_date: new Date().toISOString().split('T')[0],
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && userRole === 'admin') {
      fetchEmployees();
      fetchDepartments();
    }
  }, [isAuthLoading, userRole]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/employees');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setEmployees(data || []);
      setManagers(data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setDepartments(data || []);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // -----------------------------------------------------------------
  // FILE HANDLING
  // -----------------------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleEdit = (emp: Employee) => {
    setEditingId(emp.employee_id);
    setForm({
      first_name: emp.first_name,
      last_name: emp.last_name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      designation: emp.designation || '',
      department_id: emp.department_id || undefined,
      reporting_manager_id: emp.reporting_manager_id || undefined,
      profile_photo: emp.profile_photo || '',
      status: emp.status || 'active',
      hire_date: emp.hire_date || new Date().toISOString().split('T')[0],
    });
    setFile(null);
    setPreview(null);
  };

  const handleCancel = () => {
    setEditingId(null);
    setForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      designation: '',
      department_id: undefined,
      reporting_manager_id: undefined,
      profile_photo: '',
      status: 'active',
      hire_date: new Date().toISOString().split('T')[0],
    });
    setFile(null);
    setPreview(null);
    setSubmitError(null);
  };

  // Cleanup preview URL
  useEffect(() => {
    if (preview) {
      return () => URL.revokeObjectURL(preview);
    }
  }, [preview]);

  // -----------------------------------------------------------------
  // SUBMIT
  // -----------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!form.first_name || !form.email) {
      setSubmitError('First name and email are required.');
      return;
    }

    let photoUrl = form.profile_photo || null;
    if (file) {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${ext}`;
      const filePath = `employees/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) {
        setSubmitError(`Upload failed: ${uploadErr.message}`);
        return;
      }

      const { data } = supabase.storage.from('profile-photos').getPublicUrl(filePath);
      photoUrl = data.publicUrl;
    }

    const payload: any = { ...form, profile_photo: photoUrl };
    if (editingId) payload.employee_id = editingId;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch('/api/employees', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save employee');
      }

      handleCancel();
      fetchEmployees();
      alert(editingId ? 'Employee updated successfully!' : 'Employee added successfully!');
    } catch (err: any) {
      setSubmitError(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this employee? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/employees?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      fetchEmployees();
      alert('Employee deleted successfully!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const filtered = employees.filter(
    (emp) =>
      `${emp.first_name} ${emp.last_name || ''} ${emp.email || ''}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!filterDept || emp.department_id === Number(filterDept))
  );

  // --------------------------------------------------------------
  // STYLES
  // --------------------------------------------------------------
  const containerStyle: CSSProperties = { 
    maxWidth: '1400px', 
    margin: '2rem auto', 
    padding: '2rem', 
    fontFamily: 'system-ui, -apple-system, sans-serif',
    backgroundColor: '#f8fafc',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
    position: 'relative' as const,
  };
  
  const headerStyle: CSSProperties = { 
    fontSize: '2.5rem', 
    fontWeight: '700', 
    color: '#1e293b', 
    margin: 0,
  };
  
  const cardStyle: CSSProperties = { 
    backgroundColor: 'white', 
    padding: '2rem', 
    borderRadius: '16px', 
    boxShadow: '0 8px 25px rgba(0,0,0,0.08)', 
    marginBottom: '2rem' 
  };
  
  const tableStyle: CSSProperties = { 
    width: '100%', 
    borderCollapse: 'collapse', 
    fontSize: '0.95rem', 
    backgroundColor: 'white' 
  };
  
  const thStyle: CSSProperties = { 
    padding: '1rem', 
    textAlign: 'left' as const, 
    fontWeight: '600', 
    color: '#475569', 
    backgroundColor: '#f8fafc', 
    borderBottom: '2px solid #e2e8f0',
  };
  
  const tdStyle: CSSProperties = { 
    padding: '1rem', 
    borderBottom: '1px solid #e2e8f0', 
    color: '#334155', 
    verticalAlign: 'middle' 
  };
  
  const buttonStyle: CSSProperties = { 
    padding: '0.5rem 1rem', 
    border: 'none', 
    borderRadius: '6px', 
    color: 'white', 
    fontWeight: '600', 
    cursor: 'pointer', 
    transition: 'background-color 0.2s',
    marginRight: '0.5rem',
  };

  const inputStyle: CSSProperties = {
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '1rem',
    width: '100%',
  };

  const selectStyle: CSSProperties = {
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    fontSize: '1rem',
    backgroundColor: 'white',
    width: '100%',
  };

  // -----------------------------------------------------------------
  // RENDER
  // -----------------------------------------------------------------
  if (isAuthLoading || loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <div style={{ 
          width: '50px', 
          height: '50px', 
          border: '5px solid #e2e8f0', 
          borderTop: '5px solid #1e3a8a', 
          borderRadius: '50%', 
          margin: '0 auto 1rem',
          animation: 'spin 1s linear infinite' 
        }} />
        <p style={{ color: '#64748b' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={headerStyle}>Employee Management</h1>
        <button
          onClick={() => router.push('/admin')}
          style={{
            padding: '0.6rem 1.2rem',
            backgroundColor: '#64748b',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.95rem',
            fontWeight: '500',
          }}
        >
          ← Back to Admin
        </button>
      </div>

      {/* ADD / EDIT FORM */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#334155', margin: '0 0 1.5rem' }}>
          {editingId ? 'Edit Employee' : 'Add New Employee'}
        </h2>
        {submitError && (
          <div style={{ 
            backgroundColor: '#fee2e2', 
            border: '1px solid #fecaca', 
            color: '#dc2626', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem' 
          }}>
            {submitError}
          </div>
        )}
        
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <input
            required
            placeholder="First Name *"
            value={form.first_name || ''}
            onChange={e => setForm({ ...form, first_name: e.target.value })}
            style={inputStyle}
          />
          
          <input
            placeholder="Last Name"
            value={form.last_name || ''}
            onChange={e => setForm({ ...form, last_name: e.target.value })}
            style={inputStyle}
          />
          
          <input
            required
            type="email"
            placeholder="Email *"
            value={form.email || ''}
            onChange={e => setForm({ ...form, email: e.target.value })}
            style={inputStyle}
          />
          
          <input
            placeholder="Phone"
            value={form.phone || ''}
            onChange={e => setForm({ ...form, phone: e.target.value })}
            style={inputStyle}
          />
          
          <input
            placeholder="Designation"
            value={form.designation || ''}
            onChange={e => setForm({ ...form, designation: e.target.value })}
            style={inputStyle}
          />

          <select
            value={form.department_id || ''}
            onChange={e => setForm({ ...form, department_id: e.target.value ? Number(e.target.value) : undefined })}
            style={selectStyle}
          >
            <option value="">Select Department</option>
            {departments.map(d => (
              <option key={d.department_id} value={d.department_id}>{d.name}</option>
            ))}
          </select>

          <select
            value={form.reporting_manager_id || ''}
            onChange={e => setForm({ ...form, reporting_manager_id: e.target.value ? Number(e.target.value) : undefined })}
            style={selectStyle}
          >
            <option value="">No Manager</option>
            {managers
              .filter(m => m.employee_id !== editingId) // Can't be their own manager
              .map(m => (
                <option key={m.employee_id} value={m.employee_id}>
                  {m.first_name} {m.last_name || ''} ({m.email})
                </option>
            ))}
          </select>

          <input
            type="date"
            placeholder="Hire Date"
            value={form.hire_date || ''}
            onChange={e => setForm({ ...form, hire_date: e.target.value })}
            style={inputStyle}
          />

          <select
            value={form.status || 'active'}
            onChange={e => setForm({ ...form, status: e.target.value })}
            style={selectStyle}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="on_leave">On Leave</option>
          </select>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569' }}>
              Profile Photo
            </label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange} 
              style={{ 
                padding: '0.5rem',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                width: '100%',
              }} 
            />
            {preview && (
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '0.5rem' }}>Preview:</p>
                <Image 
                  src={preview} 
                  alt="preview" 
                  width={100} 
                  height={100} 
                  style={{ 
                    borderRadius: '50%', 
                    objectFit: 'cover',
                    border: '3px solid #1e3a8a' 
                  }} 
                />
              </div>
            )}
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  ...buttonStyle,
                  backgroundColor: '#64748b',
                  padding: '0.75rem 2rem',
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              style={{
                ...buttonStyle,
                backgroundColor: '#1e3a8a',
                padding: '0.75rem 2rem',
              }}
            >
              {editingId ? 'Update Employee' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>

      {/* EMPLOYEES LIST */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: '#334155', margin: 0 }}>
            All Employees ({filtered.length})
          </h2>
          <button
            onClick={() => {
              handleCancel();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{
              ...buttonStyle,
              backgroundColor: '#10b981',
              padding: '0.75rem 1.5rem',
            }}
          >
            + Add New
          </button>
        </div>
        
        {error ? (
          <div style={{ 
            backgroundColor: '#fee2e2', 
            border: '1px solid #fecaca', 
            color: '#dc2626', 
            padding: '1rem', 
            borderRadius: '8px', 
            textAlign: 'center' 
          }}>
            {error}
          </div>
        ) : (
          <>
            {/* Search and Filter */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <input
                placeholder="Search by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, maxWidth: '300px' }}
              />
              <select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                style={{ ...selectStyle, maxWidth: '200px' }}
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.department_id} value={d.department_id}>{d.name}</option>
                ))}
              </select>
              {filterDept && (
                <button
                  onClick={() => setFilterDept('')}
                  style={{
                    ...buttonStyle,
                    backgroundColor: '#94a3b8',
                    padding: '0.75rem 1rem',
                  }}
                >
                  Clear Filter
                </button>
              )}
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Photo</th>
                    <th style={thStyle}>ID</th>
                    <th style={thStyle}>Name</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Phone</th>
                    <th style={thStyle}>Designation</th>
                    <th style={thStyle}>Department</th>
                    <th style={thStyle}>Manager</th>
                    <th style={thStyle}>Status</th>
                    <th style={thStyle}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ ...tdStyle, textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                        No employees found
                      </td>
                    </tr>
                  ) : (
                    filtered.map(emp => (
                      <tr key={emp.employee_id} style={{ 
                        backgroundColor: editingId === emp.employee_id ? '#f0f9ff' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}>
                        <td style={tdStyle}>
                          {emp.profile_photo ? (
                            <Image
                              src={emp.profile_photo}
                              alt={emp.first_name}
                              width={40}
                              height={40}
                              style={{ borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{
                              width: 40,
                              height: 40,
                              backgroundColor: '#e2e8f0',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1rem',
                              color: '#64748b',
                              fontWeight: '600'
                            }}>
                              {emp.first_name?.[0]}{emp.last_name?.[0]}
                            </div>
                          )}
                        </td>
                        <td style={tdStyle}>{emp.employee_id}</td>
                        <td style={tdStyle}>
                          <strong>{emp.first_name} {emp.last_name || ''}</strong>
                        </td>
                        <td style={tdStyle}>{emp.email || '—'}</td>
                        <td style={tdStyle}>{emp.phone || '—'}</td>
                        <td style={tdStyle}>{emp.designation || '—'}</td>
                        <td style={tdStyle}>
                          <span style={{
                            backgroundColor: '#f1f5f9',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.85rem'
                          }}>
                            {emp.departments?.name || '—'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {emp.reporting_manager
                            ? `${emp.reporting_manager.first_name} ${emp.reporting_manager.last_name || ''}`
                            : '—'}
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '9999px',
                            backgroundColor: emp.status === 'active' ? '#10b981' : 
                                           emp.status === 'on_leave' ? '#f59e0b' : '#ef4444',
                            color: 'white',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            display: 'inline-block'
                          }}>
                            {emp.status?.toUpperCase() || 'ACTIVE'}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleEdit(emp)}
                              style={{
                                ...buttonStyle,
                                backgroundColor: '#f59e0b',
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.85rem',
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(emp.employee_id)}
                              style={{
                                ...buttonStyle,
                                backgroundColor: '#ef4444',
                                padding: '0.4rem 0.8rem',
                                fontSize: '0.85rem',
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Summary */}
            <div style={{ 
              marginTop: '1.5rem', 
              padding: '1rem', 
              backgroundColor: '#f8fafc', 
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <p style={{ margin: 0, color: '#475569' }}>
                <strong>Total:</strong> {employees.length} employees
              </p>
              <p style={{ margin: 0, color: '#475569' }}>
                <strong>Active:</strong> {employees.filter(e => e.status === 'active').length} |
                <strong> On Leave:</strong> {employees.filter(e => e.status === 'on_leave').length} |
                <strong> Inactive:</strong> {employees.filter(e => e.status === 'inactive').length}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Add animation style */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}