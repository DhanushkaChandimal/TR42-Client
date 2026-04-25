import { useEffect, useState } from "react";
import { authService } from "../services/authServices";

export function useUserProfile() {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchProfile = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await authService.getProfile();
            setData(res);
        } catch (err) {
            setError(err.message || "Failed to load profile");
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async (formData) => {
        setLoading(true);
        setError(null);
        try {
            const res = await authService.updateProfile(formData);
            setData(res.data); // backend returns { message, data }
        } catch (err) {
            setError(err.message || "Update failed");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    return {
        data,
        loading,
        error,
        updateProfile,
    };
}
