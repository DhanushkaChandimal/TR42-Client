import React, { useState, useEffect } from "react";
import { useUserProfile } from "../hooks/useUserProfile";
import "bootstrap/dist/css/bootstrap.min.css";

function Profile() {
    const { data, updateProfile, error, loading } = useUserProfile();
    const [formData, setFormData] = useState({});
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        setFormData(data);
    }, [data]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        // handle nested address
        if (["street", "city", "state", "zip", "country"].includes(name)) {
            setFormData({
                ...formData,
                address: {
                    ...formData.address,
                    [name]: value,
                },
            });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSave = async () => {
        await updateProfile(formData);
        if (!error) setEditMode(false);
    };

    return (
        <div className="login-page">
            <div className="login-panel p-4">
                <h3>My Profile</h3>

                {error && <div className="alert alert-danger">{error}</div>}

                {loading && <div className="text-center mb-2">Loading...</div>}

                <input
                    name="first_name"
                    value={formData.first_name || ""}
                    onChange={handleChange}
                    disabled={!editMode}
                    className="form-control mb-2"
                />

                <input
                    name="last_name"
                    value={formData.last_name || ""}
                    onChange={handleChange}
                    disabled={!editMode}
                    className="form-control mb-2"
                />

                {/* Contact */}
                <input
                    name="contact_number"
                    value={formData.contact_number || ""}
                    onChange={handleChange}
                    disabled={!editMode}
                    className="form-control mb-2"
                />

                {/* Address */}
                <input
                    name="street"
                    value={formData.address?.street || ""}
                    onChange={handleChange}
                    disabled={!editMode}
                    className="form-control mb-2"
                />

                <input
                    name="city"
                    value={formData.address?.city || ""}
                    onChange={handleChange}
                    disabled={!editMode}
                    className="form-control mb-2"
                />

                {/* BUTTONS */}
                {!editMode ? (
                    <button
                        className="btn btn-primary"
                        onClick={() => setEditMode(true)}
                    >
                        Edit
                    </button>
                ) : (
                    <button className="btn btn-success" onClick={handleSave}>
                        Save
                    </button>
                )}

                <button
                    className="btn btn-warning ms-2"
                    data-bs-toggle="modal"
                    data-bs-target="#changePasswordModal"
                >
                    Change Password
                </button>
            </div>

            {/* MODAL */}
            <ChangePasswordModal />
        </div>
    );
}

export default Profile;
