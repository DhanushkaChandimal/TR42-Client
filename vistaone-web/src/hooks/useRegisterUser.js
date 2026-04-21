import { useState } from "react";
import { authService } from "../services/authServices";

export function useRegisterUser() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const submitRegistration = async (formData) => {
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      await authService.register(formData);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return { submitRegistration, loading, error, success };
}
