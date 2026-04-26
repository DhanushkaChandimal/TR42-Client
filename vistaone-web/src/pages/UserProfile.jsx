import { useEffect, useState } from "react";
import AppShell from "../components/AppShell";
import ChangePasswordModal from "../components/ChangePasswordModal";
import { useUserProfile } from "../hooks/useUserProfile";
import "../styles/userProfile.css";

const ADDRESS_FIELDS = ["street", "city", "state", "zip", "country"];

export default function UserProfile() {
    const { data, updateProfile, error, loading } = useUserProfile();
    const [formData, setFormData] = useState({});
    const [editMode, setEditMode] = useState(false);
    const [showPwModal, setShowPwModal] = useState(false);

    useEffect(() => {
        setFormData(data || {});
    }, [data]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (ADDRESS_FIELDS.includes(name)) {
            setFormData((prev) => ({
                ...prev,
                address: { ...(prev.address || {}), [name]: value },
            }));
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleSave = async () => {
        await updateProfile(formData);
        if (!error) setEditMode(false);
    };

    const handleCancel = () => {
        setFormData(data || {});
        setEditMode(false);
    };

    return (
        <AppShell
            title="My Profile"
            subtitle="View and update your account information"
            loading={loading}
            loadingText="Loading profile..."
        >
            {error && <div className="profile-error">{error}</div>}

            <div className="profile-grid">
                <section className="profile-card">
                    <h3>Personal Information</h3>
                    <div className="profile-form-row">
                        <label>
                            First name
                            <input
                                name="first_name"
                                value={formData.first_name || ""}
                                onChange={handleChange}
                                disabled={!editMode}
                            />
                        </label>
                        <label>
                            Last name
                            <input
                                name="last_name"
                                value={formData.last_name || ""}
                                onChange={handleChange}
                                disabled={!editMode}
                            />
                        </label>
                    </div>
                    <label>
                        Middle name
                        <input
                            name="middle_name"
                            value={formData.middle_name || ""}
                            onChange={handleChange}
                            disabled={!editMode}
                        />
                    </label>
                    <label>
                        Date of birth
                        <input
                            type="date"
                            name="date_of_birth"
                            value={formData.date_of_birth || ""}
                            onChange={handleChange}
                            disabled={!editMode}
                        />
                    </label>
                </section>

                <section className="profile-card">
                    <h3>Contact</h3>
                    <label>
                        Email
                        <input
                            name="email"
                            value={formData.email || ""}
                            disabled
                        />
                    </label>
                    <label>
                        Username
                        <input
                            name="username"
                            value={formData.username || ""}
                            disabled
                        />
                    </label>
                    <div className="profile-form-row">
                        <label>
                            Primary phone
                            <input
                                name="contact_number"
                                value={formData.contact_number || ""}
                                onChange={handleChange}
                                disabled={!editMode}
                            />
                        </label>
                        <label>
                            Alternate phone
                            <input
                                name="alternate_number"
                                value={formData.alternate_number || ""}
                                onChange={handleChange}
                                disabled={!editMode}
                            />
                        </label>
                    </div>
                </section>

                <section className="profile-card profile-card-full">
                    <h3>Address</h3>
                    <label>
                        Street
                        <input
                            name="street"
                            value={formData.address?.street || ""}
                            onChange={handleChange}
                            disabled={!editMode}
                        />
                    </label>
                    <div className="profile-form-row">
                        <label>
                            City
                            <input
                                name="city"
                                value={formData.address?.city || ""}
                                onChange={handleChange}
                                disabled={!editMode}
                            />
                        </label>
                        <label>
                            State
                            <input
                                name="state"
                                value={formData.address?.state || ""}
                                onChange={handleChange}
                                disabled={!editMode}
                            />
                        </label>
                        <label>
                            ZIP
                            <input
                                name="zip"
                                value={formData.address?.zip || ""}
                                onChange={handleChange}
                                disabled={!editMode}
                            />
                        </label>
                        <label>
                            Country
                            <input
                                name="country"
                                value={formData.address?.country || ""}
                                onChange={handleChange}
                                disabled={!editMode}
                            />
                        </label>
                    </div>
                </section>
            </div>

            <div className="profile-actions">
                {!editMode ? (
                    <>
                        <button
                            className="profile-btn-primary"
                            onClick={() => setEditMode(true)}
                        >
                            Edit
                        </button>
                        <button
                            className="profile-btn-secondary"
                            onClick={() => setShowPwModal(true)}
                        >
                            Change Password
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            className="profile-btn-primary"
                            onClick={handleSave}
                        >
                            Save
                        </button>
                        <button
                            className="profile-btn-cancel"
                            onClick={handleCancel}
                        >
                            Cancel
                        </button>
                    </>
                )}
            </div>

            {showPwModal && (
                <ChangePasswordModal
                    isOpen={showPwModal}
                    onClose={() => setShowPwModal(false)}
                />
            )}
        </AppShell>
    );
}
