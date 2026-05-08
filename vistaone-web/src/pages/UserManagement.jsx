import { useState, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Edit2, Save, X, ArrowRightLeft, Globe } from 'lucide-react';
import { authService } from '../services/authServices';
import AppShell from '../components/AppShell';
import { useAuthContext } from '../context/AuthContext';

function MultiRoleSelect({ roles, selected, onChange }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const toggle = (name) => {
        onChange(selected.includes(name) ? selected.filter((r) => r !== name) : [...selected, name]);
    };

    const label = selected.length === 0 ? 'No roles selected' : selected.join(', ');

    return (
        <div ref={ref} style={{ position: 'relative', minWidth: 200 }}>
            <button
                type="button"
                className="form-select form-select-sm text-start text-truncate"
                onClick={() => setOpen((o) => !o)}
                title={label}
            >
                {label}
            </button>
            {open && (
                <div
                    className="border rounded bg-white shadow-sm py-1"
                    style={{ position: 'absolute', zIndex: 1050, minWidth: '100%', maxHeight: 260, overflowY: 'auto' }}
                >
                    {roles.length === 0 && (
                        <span className="px-3 py-2 text-muted small d-block">No roles available</span>
                    )}
                    {roles.map((r) => (
                        <label
                            key={r.id}
                            className="d-flex align-items-center gap-2 px-3 py-1 small mb-0 w-100"
                            style={{ cursor: 'pointer', userSelect: 'none' }}
                        >
                            <input
                                type="checkbox"
                                className="form-check-input mt-0 flex-shrink-0"
                                checked={selected.includes(r.name)}
                                onChange={() => toggle(r.name)}
                            />
                            {r.name}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}

const STATUS_BADGE = {
    active: 'bg-success-subtle text-success',
    pending_approval: 'bg-warning-subtle text-warning',
    pending_email_verification: 'bg-info-subtle text-info',
    rejected: 'bg-danger-subtle text-danger',
    inactive: 'bg-secondary-subtle text-secondary',
};

export default function UserManagement() {
    const { isMaster, hasPermission } = useAuthContext();
    const canWrite = hasPermission("users", "write");
    const [users, setUsers] = useState([]);
    const [availableRoles, setAvailableRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({});

    const [roleEditId, setRoleEditId] = useState(null);
    const [selectedRoles, setSelectedRoles] = useState([]);

    const [transferTarget, setTransferTarget] = useState('');
    const [showTransfer, setShowTransfer] = useState(false);
    const [transferring, setTransferring] = useState(false);

    const [domain, setDomain] = useState('');
    const [inputDomain, setInputDomain] = useState('');
    const [domainEditing, setDomainEditing] = useState(false);
    const [domainSaving, setDomainSaving] = useState(false);
    const [domainError, setDomainError] = useState('');
    const [domainSuccess, setDomainSuccess] = useState('');

    const reload = () => {
        setLoading(true);
        Promise.all([authService.getUsers(), authService.getRoles()])
            .then(([userList, roleList]) => {
                setUsers(userList);
                setAvailableRoles(roleList);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    };

    useEffect(reload, []);

    useEffect(() => {
        if (!isMaster) return;
        authService.getClientSettings()
            .then((data) => {
                setDomain(data.approved_domain || '');
                setInputDomain(data.approved_domain || '');
            })
            .catch(() => {});
    }, [isMaster]);

    const handleDomainSave = async () => {
        setDomainSaving(true);
        setDomainError('');
        setDomainSuccess('');
        try {
            const data = await authService.updateClientSettings({
                approved_domain: inputDomain.trim().toLowerCase() || null,
            });
            setDomain(data.approved_domain || '');
            setInputDomain(data.approved_domain || '');
            setDomainEditing(false);
            setDomainSuccess('Domain saved.');
        } catch (e) {
            setDomainError(e.message);
        } finally {
            setDomainSaving(false);
        }
    };

    const handleDomainCancel = () => {
        setInputDomain(domain);
        setDomainEditing(false);
        setDomainError('');
    };

    const handleApprove = async (userId) => {
        setError('');
        try {
            await authService.approveUser(userId);
            setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: 'ACTIVE' } : u));
        } catch (e) {
            setError(e.message);
        }
    };

    const handleReject = async (userId) => {
        setError('');
        try {
            await authService.rejectUser(userId);
            setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: 'REJECTED' } : u));
        } catch (e) {
            setError(e.message);
        }
    };

    const startEdit = (user) => {
        setEditingId(user.id);
        setEditForm({ first_name: user.first_name, last_name: user.last_name, contact_number: user.contact_number });
    };

    const saveEdit = async (userId) => {
        setError('');
        try {
            const result = await authService.updateUser(userId, editForm);
            setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...result.user } : u));
            setEditingId(null);
        } catch (e) {
            setError(e.message);
        }
    };

    const startRoleEdit = (user) => {
        setRoleEditId(user.id);
        setSelectedRoles(user.roles.filter((r) => r.toUpperCase() !== 'MASTER'));
    };


    const saveRoles = async (userId) => {
        setError('');
        try {
            await authService.setUserRoles(userId, selectedRoles);
            setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, roles: [...selectedRoles] } : u));
            setRoleEditId(null);
        } catch (e) {
            setError(e.message);
        }
    };

    const handleTransfer = async () => {
        if (!transferTarget) return;
        setTransferring(true);
        setError('');
        try {
            await authService.transferMaster(transferTarget);
            setShowTransfer(false);
            reload();
        } catch (e) {
            setError(e.message);
        } finally {
            setTransferring(false);
        }
    };

    // Roles a given user is allowed to see/assign in the role picker
    const assignableRoles = () => {
        return availableRoles.filter((r) => {
            if (r.name.toUpperCase() === 'MASTER') return false; // never assignable via this UI
            return true;
        });
    };

    const nonMasterUsers = users.filter((u) => !u.roles.some((r) => r.toUpperCase() === 'MASTER'));

    return (
        <AppShell title="User Management" subtitle="Approve, reject, and manage company users." loading={loading}>
            {error && <div className="alert alert-danger mb-3">{error}</div>}

            {isMaster && (
                <div className="mb-3 d-flex justify-content-end">
                    <button
                        className="btn btn-sm btn-outline-warning d-inline-flex align-items-center gap-1"
                        onClick={() => { setShowTransfer(!showTransfer); setError(''); }}
                    >
                        <ArrowRightLeft size={14} />
                        Transfer MASTER Role
                    </button>
                </div>
            )}

            {showTransfer && isMaster && (
                <div className="card shadow-sm mb-3 border-warning">
                    <div className="card-body">
                        <h6 className="card-title">Transfer MASTER Role</h6>
                        <p className="small text-muted mb-2">
                            You will become an Admin after the transfer. This cannot be undone without the new Master's help.
                        </p>
                        <div className="d-flex gap-2 flex-wrap">
                            <select
                                className="form-select form-select-sm"
                                style={{ maxWidth: 280 }}
                                value={transferTarget}
                                onChange={(e) => setTransferTarget(e.target.value)}
                            >
                                <option value="">— Select user —</option>
                                {nonMasterUsers.filter((u) => u.status === 'ACTIVE').map((u) => (
                                    <option key={u.id} value={u.id}>
                                        {u.first_name} {u.last_name} ({u.email})
                                    </option>
                                ))}
                            </select>
                            <button
                                className="btn btn-sm btn-warning"
                                onClick={handleTransfer}
                                disabled={!transferTarget || transferring}
                            >
                                {transferring ? 'Transferring…' : 'Transfer'}
                            </button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => setShowTransfer(false)}>
                                <X size={13} />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isMaster && (
                <div className="row g-3 mb-3">
                    <div className="col-12 col-lg-6">
                        <div className="card shadow-sm h-100">
                            <div className="card-body">
                                <h5 className="card-title d-flex align-items-center gap-2 mb-3">
                                    <Globe size={18} />
                                    Approved Email Domain
                                </h5>
                                {domainSuccess && <div className="alert alert-success py-2 mb-3">{domainSuccess}</div>}
                                {domainError && <div className="alert alert-danger py-2 mb-3">{domainError}</div>}
                                {domainEditing ? (
                                    <div className="d-flex flex-column gap-2">
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="e.g. company.com  (leave empty to clear)"
                                            value={inputDomain}
                                            onChange={(e) => setInputDomain(e.target.value)}
                                            disabled={domainSaving}
                                        />
                                        <div className="d-flex gap-2">
                                            <button
                                                className="btn btn-primary d-inline-flex align-items-center gap-1"
                                                onClick={handleDomainSave}
                                                disabled={domainSaving}
                                            >
                                                <Save size={14} />
                                                {domainSaving ? 'Saving…' : 'Save'}
                                            </button>
                                            <button
                                                className="btn btn-outline-secondary d-inline-flex align-items-center gap-1"
                                                onClick={handleDomainCancel}
                                                disabled={domainSaving}
                                            >
                                                <X size={14} />
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="d-flex align-items-center justify-content-between">
                                        <div>
                                            {domain ? (
                                                <span className="badge bg-secondary-subtle text-secondary px-3 py-2 fs-6">
                                                    @{domain}
                                                </span>
                                            ) : (
                                                <span className="text-muted fst-italic">No approved domain set</span>
                                            )}
                                        </div>
                                        <button
                                            className="btn btn-sm btn-outline-secondary"
                                            onClick={() => { setDomainEditing(true); setDomainSuccess(''); }}
                                        >
                                            {domain ? 'Change' : 'Set domain'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-lg-6">
                        <div className="card shadow-sm border-info h-100">
                            <div className="card-body">
                                <h6 className="fw-semibold mb-2">How domain approval works</h6>
                                <ul className="small text-muted mb-0 ps-3">
                                    <li>When a user registers and verifies their email, their domain is checked.</li>
                                    <li>If it matches the approved domain, their account is <strong>automatically activated</strong>.</li>
                                    <li>If it doesn't match, or no domain is set, the account enters <em>Pending Approval</em> for manual review.</li>
                                    <li>Only one domain is supported per company. Leave empty to require all registrations to be manually approved.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="card shadow-sm">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0">
                            <thead>
                                <tr>
                                    <th className="px-3 py-3">Name</th>
                                    <th className="px-3 py-3">Email</th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3">Roles</th>
                                    <th className="px-3 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={5} className="text-center text-muted py-4">No users found.</td>
                                    </tr>
                                )}
                                {users.map((user) => (
                                    <tr key={user.id}>
                                        <td className="px-3 py-3 align-middle">
                                            {editingId === user.id ? (
                                                <div className="d-flex gap-1">
                                                    <input
                                                        className="form-control form-control-sm"
                                                        value={editForm.first_name}
                                                        onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                                                        placeholder="First"
                                                    />
                                                    <input
                                                        className="form-control form-control-sm"
                                                        value={editForm.last_name}
                                                        onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                                                        placeholder="Last"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="fw-medium">{user.first_name} {user.last_name}</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 align-middle text-muted small">{user.email}</td>
                                        <td className="px-3 py-3 align-middle">
                                            <span className={`badge px-2 py-1 ${STATUS_BADGE[user.status] || 'bg-secondary-subtle text-secondary'}`}>
                                                {user.status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 align-middle">
                                            {roleEditId === user.id ? (
                                                <MultiRoleSelect
                                                    roles={assignableRoles()}
                                                    selected={selectedRoles}
                                                    onChange={setSelectedRoles}
                                                />
                                            ) : (
                                                <div className="d-flex flex-wrap gap-1">
                                                    {user.roles.length === 0 && <span className="text-muted small">No roles</span>}
                                                    {user.roles.map((r) => (
                                                        <span key={r} className={`badge px-2 py-1 ${r.toUpperCase() === 'MASTER' ? 'bg-danger-subtle text-danger' : 'bg-primary-subtle text-primary'}`}>
                                                            {r}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-3 align-middle">
                                            <div className="d-flex gap-1 flex-wrap">
                                                {canWrite && user.status === 'PENDING_APPROVAL' && (
                                                    <>
                                                        <button className="btn btn-sm btn-success d-inline-flex align-items-center gap-1" onClick={() => handleApprove(user.id)}>
                                                            <CheckCircle size={13} /> Approve
                                                        </button>
                                                        <button className="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1" onClick={() => handleReject(user.id)}>
                                                            <XCircle size={13} /> Reject
                                                        </button>
                                                    </>
                                                )}
                                                {canWrite && !user.roles.some((r) => r.toUpperCase() === 'MASTER') && (
                                                    editingId === user.id ? (
                                                        <>
                                                            <button className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" onClick={() => saveEdit(user.id)}>
                                                                <Save size={13} /> Save
                                                            </button>
                                                            <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingId(null)}>
                                                                <X size={13} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={() => startEdit(user)}>
                                                            <Edit2 size={13} /> Edit
                                                        </button>
                                                    )
                                                )}
                                                {canWrite && !user.roles.some((r) => r.toUpperCase() === 'MASTER') && (
                                                    roleEditId === user.id ? (
                                                        <>
                                                            <button className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1" onClick={() => saveRoles(user.id)}>
                                                                <Save size={13} /> Roles
                                                            </button>
                                                            <button className="btn btn-sm btn-outline-secondary" onClick={() => setRoleEditId(null)}>
                                                                <X size={13} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" onClick={() => startRoleEdit(user)}>
                                                            Roles
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
