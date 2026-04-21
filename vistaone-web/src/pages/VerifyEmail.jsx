import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useVerifyEmail from "../hooks/useVerifyEmail";

const VerifyEmail = () => {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const token = params.get("token");
    const [message, setMessage] = useState(
        token ? "Verifying..." : "Invalid verification link.",
    );
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const { verifyEmail } = useVerifyEmail();
    useEffect(() => {
        if (!token) return;

        verifyEmail(token).then(({ success, message }) => {
            setMessage(message);
            setSuccess(success);

            if (success) {
                setTimeout(() => navigate("/login"), 3000);
            }
        });
    }, [token, navigate, verifyEmail]);

    return (
        <div className="container mt-5">
            <div
                className={`alert ${success ? "alert-success" : "alert-danger"}`}
                role="alert"
            >
                {message}
            </div>
            {success && <div>Redirecting to login...</div>}
        </div>
    );
};

export default VerifyEmail;
