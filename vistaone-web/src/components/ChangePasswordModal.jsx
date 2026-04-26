import { useState } from "react";
import { authService } from "../services/authServices";

export default function ChangePasswordModal({ isOpen, onClose }) {
    const [form, setForm] = useState({
        old_password: "",
        new_password: "",
        confirm_password: "",
    });
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e?.preventDefault();
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

        setSubmitting(true);
        try {
            await authService.changePassword(form);
            setSuccess("Password updated successfully!");
            setForm({
                old_password: "",
                new_password: "",
                confirm_password: "",
            });
            setTimeout(() => onClose?.(), 1500);
        } catch (err) {
            setError(err.message || "Password update failed");
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setForm({
            old_password: "",
            new_password: "",
            confirm_password: "",
        });
        setError(null);
        setSuccess(null);
        onClose?.();
    };

    return (
        <div className="profile-modal-overlay" onClick={handleClose}>
            <div
                className="profile-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="profile-modal-header">
                    <h3>Change Password</h3>
                    <button
                        type="button"
                        className="profile-modal-close"
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        ×
                    </button>
                </div>

                <form className="profile-modal-form" onSubmit={handleSubmit}>
                    {error && <div className="profile-error">{error}</div>}
                    {success && (
                        <div className="profile-success">{success}</div>
                    )}

                    <label>
                        Old Password
                        <input
                            type="password"
                            value={form.old_password}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    old_password: e.target.value,
                                })
                            }
                            autoComplete="current-password"
                        />
                    </label>

                    <label>
                        New Password
                        <input
                            type="password"
                            value={form.new_password}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    new_password: e.target.value,
                                })
                            }
                            autoComplete="new-password"
                        />
                    </label>

                    <label>
                        Confirm Password
                        <input
                            type="password"
                            value={form.confirm_password}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    confirm_password: e.target.value,
                                })
                            }
                            autoComplete="new-password"
                        />
                    </label>

                    <div className="profile-modal-actions">
                        <button
                            type="button"
                            className="profile-btn-cancel"
                            onClick={handleClose}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="profile-btn-primary"
                            disabled={submitting}
                        >
                            {submitting ? "Updating..." : "Update Password"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
