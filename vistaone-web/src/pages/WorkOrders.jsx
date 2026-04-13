import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import { useWorkOrder } from '../hooks/useWorkOrder';
import CreateWorkOrderModal from '../components/CreateWorkOrderModal';
import '../styles/workorder.css';

const statusOptions = ['all', 'pending', 'in_progress', 'completed', 'cancelled'];

export default function WorkOrders() {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showModal, setShowModal] = useState(false);
    const {
        workOrders,
        loading,
        fetchWorkOrders,
        // createWorkOrder,
        // updateWorkOrder,
        // removeWorkOrder
    } = useWorkOrder();

    useEffect(() => {
        fetchWorkOrders();
    }, []);

    const filteredOrders = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return workOrders.filter(order => {
            const matchesStatus = statusFilter === 'all' || (order.status && order.status.toLowerCase() === statusFilter);
            // Search by description, location, or work_order_id
            const matchesSearch =
                (order.description?.toLowerCase().includes(normalizedSearch) ||
                order.location_type?.toLowerCase().includes(normalizedSearch) ||
                order.work_order_id?.toLowerCase().includes(normalizedSearch));
            return matchesStatus && matchesSearch;
        });
    }, [workOrders, searchTerm, statusFilter]);

    const handleOpenModal = () => setShowModal(true);
    
    const formatDate = dateString =>
        new Date(dateString).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        });

    const formatStatusLabel = status => status.replace('_', ' ');

    return (
        <AppShell
            title="Work Orders"
            subtitle="Manage field work orders"
            loading={loading}
            loadingText="Loading work orders..."
        >
            <section className="workorders-controls">
                <input
                    type="search"
                    className="workorders-search"
                    placeholder="Search"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <select
                    className="workorders-filter"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    {statusOptions.map(status => (
                        <option key={status} value={status}>
                            {status}
                        </option>
                    ))}
                </select>
                <button className="workorders-create-btn" onClick={handleOpenModal}>
                    Create Work Order
                </button>
            </section>

            <section className="workorders-table-wrap">
                {loading ? (
                    <div className="workorders-state">Loading work orders...</div>
                ) : filteredOrders.length === 0 ? (
                    <div className="workorders-state">No work orders found</div>
                ) : (
                    <table className="workorders-table">
                        <thead>
                            <tr>
                                <th>Order ID</th>
                                <th>Vendor</th>
                                <th>Job Type</th>
                                <th>Location Type</th>
                                <th>Location</th>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredOrders.map(order => (
                                <tr key={order.work_order_id}>
                                    <td>{order.work_order_id}</td>
                                    <td>{order.vendor.name}</td>
                                    <td>{order.service_type.service}</td>
                                    <td>{order.location_type}</td>
                                    <td>{`${order.latitude}, ${order.longitude}`}</td>
                                    <td>{formatDate(order.created_date)}</td>
                                    <td>
                                        <span className={`status-badge status-${order.status?.toLowerCase()}`}>
                                            {formatStatusLabel(order.status || '')}
                                        </span>
                                    </td>
                                    <td className="workorders-actions-cell">
                                        <button className="workorders-action-btn">View</button>
                                        <button className="workorders-action-btn workorders-action-btn-secondary">Edit</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>

            {showModal && <CreateWorkOrderModal setShowModal={setShowModal}/>}
        </AppShell>
    );
}