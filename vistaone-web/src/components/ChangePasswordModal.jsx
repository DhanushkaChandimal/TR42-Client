import React, { useState } from "react";
import { authService } from "../services/authServices";

function ChangePasswordModal() {
    const [form, setForm] = useState({
        old_password: "",
        new_password: "",
        confirm_password: "",
    });

    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const handleSubmit = async () => {
        setError(null);
        setSuccess(null);

        if (
            !form.old_password ||
            !form.new_password ||
            !form.confirm_password
        ) {
            setError("All fields are required");
            return;
        }

        if (form.new_password !== form.confirm_password) {
            setError("New password and confirm password must match");
            return;
        }

        try {
            await authService.changePassword(form);

            setSuccess("Password updated successfully!");

            // reset form
            setForm({
                old_password: "",
                new_password: "",
                confirm_password: "",
            });

            // auto close modal after 1.5s
            setTimeout(() => {
                const modal = document.getElementById("changePasswordModal");
                if (modal) {
                    const bsModal = window.bootstrap.Modal.getInstance(modal);
                    bsModal?.hide();
                }
            }, 1500);
        } catch (err) {
            setError(err.message || "Password update failed");
        }
    };

    return (
        <div className="modal fade" id="changePasswordModal" tabIndex="-1">
            <div className="modal-dialog">
                <div className="modal-content p-3">
                    <h5 className="mb-3">Change Password</h5>

                    {/* ERROR MESSAGE INSIDE MODAL */}
                    {error && <div className="alert alert-danger">{error}</div>}

                    {/* SUCCESS MESSAGE */}
                    {success && (
                        <div className="alert alert-success">{success}</div>
                    )}

                    <input
                        type="password"
                        placeholder="Old Password"
                        value={form.old_password}
                        onChange={(e) =>
                            setForm({ ...form, old_password: e.target.value })
                        }
                        className="form-control mb-2"
                    />

                    <input
                        type="password"
                        placeholder="New Password"
                        value={form.new_password}
                        onChange={(e) =>
                            setForm({ ...form, new_password: e.target.value })
                        }
                        className="form-control mb-2"
                    />

                    <input
                        type="password"
                        placeholder="Confirm Password"
                        value={form.confirm_password}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                confirm_password: e.target.value,
                            })
                        }
                        className="form-control mb-3"
                    />

                    <button
                        className="btn btn-primary w-100"
                        onClick={handleSubmit}
                    >
                        Update Password
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ChangePasswordModal;
