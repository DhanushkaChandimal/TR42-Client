import { useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function LocationPicker({ setCoordinates }) {
    useMapEvents({
        click(e) {
            setCoordinates(`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
        }
    });
    return null;
}
import { useWorkOrder } from "../hooks/useWorkOrder";

const recurringOptions = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Bi-Weekly' },
    { value: 'monthly', label: 'Monthly' },
];

const vendorOptions = [
    'ABC Trucking Co.',
    'Midland Field Services',
    'Texas Sand & Gravel',
    'Odessa Water Transport',
    'Permian Basin Logistics',
];

const jobTypeOptions = [
    'Water Hauling',
    'Roustabout Crew',
    'Sand Delivery',
    'Equipment Repair',
    'Site Inspection',
];

const emptyForm = {
    jobType: jobTypeOptions[0],
    volume: '',
    description: '',
    vendor: vendorOptions[0],
    locationMethod: 'api',
    apiNumber: '',
    gpsCoordinates: '',
    physicalAddress: '',
    date: '',
    endDate: '',
    priority: 'medium',
    recurring: false,
    recurringInterval: '',
};

function CreateWorkOrderModal({ setShowModal }) {
    
    const [formData, setFormData] = useState(emptyForm);
        // For map marker
        const [markerPos, setMarkerPos] = useState(null);
    const {
            workOrders,
            // loading,
            // fetchWorkOrders,
            createWorkOrder,
            // updateWorkOrder,
            // removeWorkOrder
        } = useWorkOrder();

    const handleFormChange = e => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
        // If user edits gpsCoordinates manually, update marker
        if (name === 'gpsCoordinates') {
            const [lat, lng] = value.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) setMarkerPos([lat, lng]);
        }
    };

    // When user clicks map, update gpsCoordinates and marker
    const handleMapClick = coords => {
        setFormData(prev => ({ ...prev, gpsCoordinates: coords }));
        const [lat, lng] = coords.split(',').map(Number);
        setMarkerPos([lat, lng]);
    };

    const handleCreateWorkOrder = e => {
        e.preventDefault();
        const nextOrderNumber = 450 + workOrders.length;
        let locationDisplay = '';
        if (formData.locationMethod === 'api') locationDisplay = formData.apiNumber.trim();
        else if (formData.locationMethod === 'gps') locationDisplay = formData.gpsCoordinates.trim();
        else locationDisplay = formData.physicalAddress.trim();

        const newWorkOrder = {
            id: Date().now(),
            orderId: `SO-${nextOrderNumber}`,
            jobType: formData.jobType,
            title: `${formData.jobType}${formData.volume ? ' - ' + formData.volume : ''}`,
            description: formData.description.trim(),
            vendor: formData.vendor,
            location: locationDisplay,
            priority: formData.priority,
            status: 'pending',
            createdDate: new Date().toISOString().split('T')[0],
        };

        if (!locationDisplay || !formData.jobType) return;
         createWorkOrder(newWorkOrder);
        handleCloseModal();
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setFormData(emptyForm);
    };

    return (
        <div className="workorders-modal-overlay" onClick={handleCloseModal}>
            <div className="workorders-modal" onClick={e => e.stopPropagation()}>
                <div className="workorders-modal-header">
                    <h2>Create Work Order</h2>
                    <button className="workorders-close-btn" onClick={handleCloseModal}>
                        ×
                    </button>
                </div>
                <form className="workorders-form" onSubmit={handleCreateWorkOrder}>
                    <div className="workorders-form-row">
                        <label>
                            Job Type
                            <select name="jobType" value={formData.jobType} onChange={handleFormChange}>
                                {jobTypeOptions.map(type => (
                                    <option key={type} value={type}>
                                        {type}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Volume / Units
                            <input
                                type="text"
                                name="volume"
                                placeholder="e.g., 120 BBL"
                                value={formData.volume}
                                onChange={handleFormChange}
                            />
                        </label>
                    </div>
                    <label>
                        Description
                        <textarea name="description" rows="3" value={formData.description} onChange={handleFormChange} />
                    </label>
                    <label>
                        Vendor
                        <select name="vendor" value={formData.vendor} onChange={handleFormChange}>
                            {vendorOptions.map(v => (
                                <option key={v} value={v}>
                                    {v}
                                </option>
                            ))}
                        </select>
                    </label>
                    {/* Location method */}
                    <fieldset className="workorders-form-fieldset">
                        <legend>Location Method</legend>
                        <div className="workorders-radio-group">
                            <label>
                                <input
                                    type="radio"
                                    name="locationMethod"
                                    value="api"
                                    checked={formData.locationMethod === 'api'}
                                    onChange={handleFormChange}
                                />
                                API Well Number
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="locationMethod"
                                    value="gps"
                                    checked={formData.locationMethod === 'gps'}
                                    onChange={handleFormChange}
                                />
                                GPS Coordinates
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="locationMethod"
                                    value="address"
                                    checked={formData.locationMethod === 'address'}
                                    onChange={handleFormChange}
                                />
                                Physical Address
                            </label>
                        </div>
                    </fieldset>
                    {/* Conditional location inputs */}
                    {formData.locationMethod === 'api' && (
                        <input
                            type="text"
                            name="apiNumber"
                            placeholder="API-42-002-03456"
                            value={formData.apiNumber}
                            onChange={handleFormChange}
                            required
                        />
                    )}
                    {formData.locationMethod === 'gps' && (
                        <div style={{ marginBottom: 16 }}>
                            <input
                                type="text"
                                name="gpsCoordinates"
                                placeholder="31.7451, -102.5028"
                                value={formData.gpsCoordinates}
                                onChange={handleFormChange}
                                required
                                style={{ marginBottom: 8 }}
                            />
                            <div style={{ height: 220, width: '100%', borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                                <MapContainer
                                    center={markerPos || [31.7451, -102.5028]}
                                    zoom={10}
                                    style={{ height: '100%', width: '100%' }}
                                    whenCreated={map => {
                                        if (markerPos) map.setView(markerPos, 13);
                                    }}
                                >
                                    <TileLayer
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                        attribution="&copy; OpenStreetMap contributors"
                                    />
                                    <LocationPicker setCoordinates={handleMapClick} />
                                    {markerPos && <Marker position={markerPos} />}
                                </MapContainer>
                            </div>
                            <small>Click on the map to set coordinates.</small>
                        </div>
                    )}
                    {formData.locationMethod === 'address' && (
                        <input
                            type="text"
                            name="physicalAddress"
                            placeholder="Tank Battery A, South Lease"
                            value={formData.physicalAddress}
                            onChange={handleFormChange}
                            required
                        />
                    )}
                    {/* Date, priority, recurring */}
                    <div className="workorders-form-row">
                        <label>
                            Start Date
                            <input type="date" name="date" value={formData.date} onChange={handleFormChange} required />
                        </label>
                        <label>
                            Priority
                            <select name="priority" value={formData.priority} onChange={handleFormChange}>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                            </select>
                        </label>
                    </div>
                    <label>
                        <input
                            type="checkbox"
                            name="recurring"
                            checked={formData.recurring}
                            onChange={handleFormChange}
                        />
                        Recurring Work Order
                    </label>
                    {formData.recurring && (
                        <div className="workorders-form-row">
                            <label>
                                End Date
                                <input type="date" name="endDate" value={formData.endDate} onChange={handleFormChange} required />
                            </label>
                            <label>
                                Recurring Interval
                                <select
                                    name="recurringInterval"
                                    value={formData.recurringInterval}
                                    onChange={handleFormChange}
                                    required
                                >
                                    <option value="">Select interval</option>
                                    {recurringOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    )}
                    <button type="submit" className="workorders-submit-btn">
                        Create Work Order
                    </button>
                </form>
            </div>
        </div>
    );
}

export default CreateWorkOrderModal;