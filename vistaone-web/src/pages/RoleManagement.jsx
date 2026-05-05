import { useState, useEffect } from 'react';
import { PlusCircle, Trash2, Edit2, Save, X, ChevronDown, ChevronRight, ShieldCheck } from 'lucide-react';
import { authService } from '../services/authServices';
import AppShell from '../components/AppShell';

const BUILT_IN_ROLES = new Set(['MASTER', 'ADMIN', 'USER']);

const RESOURCES = [
    { key: 'dashboard',          label: 'Dashboard' },
    { key: 'wells',              label: 'Oil Wells' },
    { key: 'workorders',         label: 'Work Orders' },
    { key: 'vendors',            label: 'Vendors' },
    { key: 'vendor_marketplace', label: 'Vendor Marketplace' },
    { key: 'contracts',          label: 'Contracts / MSA' },
    { key: 'invoices',           label: 'Invoices' },
    { key: 'users',              label: 'User Management' },
    { key: 'promote_admin',      label: 'Can Assign Admin Role', action: true },
];

function buildPermMap(permissions) {
    const map = {};
    RESOURCES.forEach(({ key }) => {
        const p = permissions.find((x) => x.resource === key);
        map[key] = {
            can_read:   p?.can_read   ?? false,
            can_write:  p?.can_write  ?? false,
            can_delete: p?.can_delete ?? false,
        };
    });
    return map;
}

function PermissionMatrix({ roleId, roleName, initialPermissions, onSaved }) {
    const [map, setMap] = useState(() => buildPermMap(initialPermissions));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const toggle = (resource, field) => {
        setMap((prev) => ({
            ...prev,
            [resource]: { ...prev[resource], [field]: !prev[resource][field] },
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const permissions = RESOURCES.map(({ key }) => ({
                resource: key,
                ...map[key],
            }));
            const updated = await authService.setRolePermissions(roleId, permissions);
            if (onSaved) onSaved(updated);
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const isMasterRole = roleName === 'MASTER';

    return (
        <div className="mt-3">
            {error && <div className="alert alert-danger py-2 mb-2">{error}</div>}
            <div className="table-responsive">
                <table className="table table-sm table-bordered mb-2">
                    <thead className="table-light">
                        <tr>
                            <th style={{ minWidth: 180 }}>Resource</th>
                            <th className="text-center" style={{ width: 80 }}>Read</th>
                            <th className="text-center" style={{ width: 80 }}>Write</th>
                            <th className="text-center" style={{ width: 80 }}>Delete</th>
                        </tr>
                    </thead>
                    <tbody>
                        {RESOURCES.map(({ key, label, action }) => (
                            <tr key={key}>
                                <td className="align-middle small">{label}</td>
                                {action ? (
                                    <td colSpan={3} className="text-center align-middle">
                                        <div className="d-flex align-items-center justify-content-center gap-2">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={isMasterRole ? true : map[key]['can_write']}
                                                disabled={isMasterRole || saving}
                                                onChange={() => toggle(key, 'can_write')}
                                            />
                                            <span className="small text-muted">Allow</span>
                                        </div>
                                    </td>
                                ) : (
                                    ['can_read', 'can_write', 'can_delete'].map((field) => (
                                        <td key={field} className="text-center align-middle">
                                            <input
                                                type="checkbox"
                                                className="form-check-input"
                                                checked={isMasterRole ? true : map[key][field]}
                                                disabled={isMasterRole || saving}
                                                onChange={() => toggle(key, field)}
                                            />
                                        </td>
                                    ))
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {!isMasterRole && (
                <button
                    className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1"
                    onClick={handleSave}
                    disabled={saving}
                >
                    <Save size={13} />
                    {saving ? 'Saving…' : 'Save Permissions'}
                </button>
            )}
            {isMasterRole && (
                <p className="text-muted small mb-0">MASTER role permissions cannot be changed.</p>
            )}
        </div>
    );
}

export default function RoleManagement() {
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expanded, setExpanded] = useState({});

    // New role form
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [creating, setCreating] = useState(false);

    // Edit role inline
    const [editId, setEditId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [editSaving, setEditSaving] = useState(false);

    // Delete with migration
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [migrateToRoleId, setMigrateToRoleId] = useState('');
    const [deleting, setDeleting] = useState(false);

    const reload = () => {
        setLoading(true);
        authService.getRoles()
            .then(setRoles)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };

    useEffect(reload, []);

    const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        setError('');
        try {
            const role = await authService.createRole({ name: newName.trim(), description: newDesc.trim() });
            setRoles((prev) => [...prev, role]);
            setNewName('');
            setNewDesc('');
            setShowCreate(false);
        } catch (e) {
            setError(e.message);
        } finally {
            setCreating(false);
        }
    };

    const openDeletePanel = (role) => {
        setDeleteTarget(role);
        setMigrateToRoleId('');
        setEditId(null);
    };

    const cancelDelete = () => {
        setDeleteTarget(null);
        setMigrateToRoleId('');
    };

    const confirmDelete = async (roleId) => {
        setDeleting(true);
        setError('');
        try {
            await authService.deleteRole(roleId, migrateToRoleId || null);
            setRoles((prev) => prev.filter((r) => r.id !== roleId));
            setDeleteTarget(null);
            setMigrateToRoleId('');
        } catch (e) {
            setError(e.message);
        } finally {
            setDeleting(false);
        }
    };

    const startEdit = (role) => {
        setEditId(role.id);
        setEditName(role.name);
        setEditDesc(role.description || '');
    };

    const handleEditSave = async (roleId) => {
        setEditSaving(true);
        setError('');
        try {
            const updated = await authService.updateRole(roleId, { name: editName.trim(), description: editDesc.trim() });
            setRoles((prev) => prev.map((r) => r.id === roleId ? { ...r, ...updated } : r));
            setEditId(null);
        } catch (e) {
            setError(e.message);
        } finally {
            setEditSaving(false);
        }
    };

    return (
        <AppShell title="Role Management" subtitle="Create and configure roles and their permissions." loading={loading}>
            {error && <div className="alert alert-danger mb-3">{error}</div>}

            <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="text-muted small">{roles.length} role{roles.length !== 1 ? 's' : ''} total</span>
                <button
                    className="btn btn-primary d-inline-flex align-items-center gap-1"
                    onClick={() => { setShowCreate(!showCreate); setError(''); }}
                >
                    <PlusCircle size={16} />
                    New Role
                </button>
            </div>

            {showCreate && (
                <div className="card shadow-sm mb-4">
                    <div className="card-body">
                        <h6 className="card-title mb-3">Create Custom Role</h6>
                        <form onSubmit={handleCreate} className="row g-2">
                            <div className="col-12 col-md-4">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Role name *"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    disabled={creating}
                                    required
                                />
                            </div>
                            <div className="col-12 col-md-5">
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Description (optional)"
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                    disabled={creating}
                                />
                            </div>
                            <div className="col-12 col-md-3 d-flex gap-2">
                                <button type="submit" className="btn btn-primary flex-grow-1" disabled={creating || !newName.trim()}>
                                    {creating ? 'Creating…' : 'Create'}
                                </button>
                                <button type="button" className="btn btn-outline-secondary" onClick={() => setShowCreate(false)}>
                                    <X size={16} />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="d-flex flex-column gap-3">
                {roles.map((role) => (
                    <div key={role.id} className="card shadow-sm">
                        <div className="card-body pb-2">
                            <div className="d-flex align-items-start justify-content-between flex-wrap gap-2">
                                <div className="d-flex align-items-center gap-2 flex-wrap">
                                    <ShieldCheck size={18} className={role.is_default ? 'text-primary' : 'text-secondary'} />
                                    {editId === role.id ? (
                                        <div className="d-flex gap-2 flex-wrap">
                                            <input
                                                className="form-control form-control-sm"
                                                style={{ width: 160 }}
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                            />
                                            <input
                                                className="form-control form-control-sm"
                                                style={{ width: 240 }}
                                                placeholder="Description"
                                                value={editDesc}
                                                onChange={(e) => setEditDesc(e.target.value)}
                                            />
                                            <button className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" onClick={() => handleEditSave(role.id)} disabled={editSaving}>
                                                <Save size={13} />{editSaving ? 'Saving…' : 'Save'}
                                            </button>
                                            <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditId(null)}>
                                                <X size={13} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="fw-semibold">{role.name}</span>
                                            {role.is_default && (
                                                <span className="badge bg-primary-subtle text-primary px-2">default</span>
                                            )}
                                            {role.description && (
                                                <span className="text-muted small">{role.description}</span>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="d-flex gap-1">
                                    {!BUILT_IN_ROLES.has(role.name) && editId !== role.id && deleteTarget?.id !== role.id && (
                                        <>
                                            <button className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={() => startEdit(role)}>
                                                <Edit2 size={13} /> Edit
                                            </button>
                                            <button className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" onClick={() => openDeletePanel(role)}>
                                                <Trash2 size={13} />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                                        onClick={() => toggleExpand(role.id)}
                                    >
                                        {expanded[role.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        Permissions
                                    </button>
                                </div>
                            </div>

                            {deleteTarget?.id === role.id && (
                                <div className="mt-3 p-3 rounded border border-danger-subtle bg-danger-subtle">
                                    <p className="small fw-semibold text-danger mb-2">
                                        Where should users assigned to "{role.name}" be moved?
                                    </p>
                                    <div className="d-flex gap-2 flex-wrap align-items-center">
                                        <select
                                            className="form-select form-select-sm"
                                            style={{ maxWidth: 240 }}
                                            value={migrateToRoleId}
                                            onChange={(e) => setMigrateToRoleId(e.target.value)}
                                            disabled={deleting}
                                        >
                                            <option value="">— Remove role only (no migration) —</option>
                                            {roles.filter((r) => r.id !== role.id && r.name !== 'MASTER').map((r) => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                        <button
                                            className="btn btn-sm btn-danger d-inline-flex align-items-center gap-1"
                                            onClick={() => confirmDelete(role.id)}
                                            disabled={deleting}
                                        >
                                            <Trash2 size={13} />
                                            {deleting ? 'Deleting…' : 'Confirm Delete'}
                                        </button>
                                        <button className="btn btn-sm btn-outline-secondary" onClick={cancelDelete} disabled={deleting}>
                                            <X size={13} />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {expanded[role.id] && (
                                <PermissionMatrix
                                    roleId={role.id}
                                    roleName={role.name}
                                    initialPermissions={role.permissions || []}
                                    onSaved={(updated) =>
                                        setRoles((prev) =>
                                            prev.map((r) => r.id === role.id ? { ...r, permissions: updated } : r)
                                        )
                                    }
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </AppShell>
    );
}
