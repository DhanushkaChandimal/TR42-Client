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
    const [successMessage, setSuccessMessage] = useState("");
    const [addressError, setAddressError] = useState("");

    useEffect(() => {
        // Sync the controlled form with newly-fetched profile data. This is the
        // canonical "respond to async data" effect and the controlled inputs
        // require local state, so the setState call here is intentional.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormData(data || {});
    }, [data]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Clear feedback as soon as the user keeps typing
        setSuccessMessage("");
        setAddressError("");
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
        setSuccessMessage("");
        setAddressError("");

        const addr = formData.address || {};
        const addrFilled = ADDRESS_FIELDS.filter(
            (f) => addr[f] && String(addr[f]).trim() !== "",
        );
        const addrTouched = addrFilled.length > 0;
        const addrComplete = addrFilled.length === ADDRESS_FIELDS.length;

        // If the user filled some address fields but not all, warn them.
        // Otherwise the backend would silently reject the address.
        if (addrTouched && !addrComplete) {
            setAddressError(
                "Address requires all 5 fields (street, city, state, ZIP, country). Fill them all or clear them.",
            );
            return;
        }

        const payload = {};
        const editableFields = [
            "first_name",
            "middle_name",
            "last_name",
            "contact_number",
            "alternate_number",
            "date_of_birth",
        ];
        editableFields.forEach((f) => {
            const v = formData[f];
            if (v !== undefined && v !== null && v !== "") payload[f] = v;
        });

        if (addrComplete) {
            payload.address = {
                street: addr.street,
                city: addr.city,
                state: addr.state,
                zip: addr.zip,
                country: addr.country,
            };
        }

        try {
            await updateProfile(payload);
            setSuccessMessage("Profile updated successfully.");
            setEditMode(false);
        } catch {
            // Error already surfaced via the hook's `error` state
        }
    };

    const handleCancel = () => {
        setFormData(data || {});
        setSuccessMessage("");
        setAddressError("");
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
            {successMessage && (
                <div className="profile-success">{successMessage}</div>
            )}
            {addressError && (
                <div className="profile-error">{addressError}</div>
            )}

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
                    <label>
                        Company
                        <input
                            name="client_name"
                            value={formData.client_name || ""}
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
