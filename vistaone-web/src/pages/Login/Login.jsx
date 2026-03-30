// Login page - the first screen users see
// handles form input, validation, and calling the auth context to log in
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "../../styles/Login.css";

function Login() {
  // form field state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // validation errors - one for each field plus a general error
  const [errors, setErrors] = useState({});

  // pull the login function from our auth context
  const { login } = useAuth();

  // useNavigate lets us redirect after login
  const navigate = useNavigate();

  // validate the form before submitting
  // returns true if everything is valid, false if there are errors
  function validateForm() {
    const newErrors = {};

    // check if email is empty
    if (!email.trim()) {
      newErrors.email = "Email is required";
    // check if email format is valid using a basic regex
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // check if password is empty
    if (!password) {
      newErrors.password = "Password is required";
    // check minimum length
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    // save errors to state so they show up in the UI
    setErrors(newErrors);

    // if the errors object is empty, validation passed
    return Object.keys(newErrors).length === 0;
  }

  // tracks whether we're waiting on the API
  const [loading, setLoading] = useState(false);

  // runs when the user submits the form
  const handleSubmit = async (e) => {
    // stop the browser from refreshing the page
    e.preventDefault();

    // run validation first - if it fails, stop here
    if (!validateForm()) return;

    setLoading(true);

    try {
      // send login request to the Flask backend
      const response = await fetch("http://localhost:5000/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      // parse the response
      const data = await response.json();

      if (response.ok) {
        // backend returned a token - save it and go to dashboard
        login(data.token, {
          name: email.split("@")[0],
          email: email,
          role: "User",
        });
        navigate("/dashboard");
      } else if (response.status === 401) {
        // wrong email or password
        setErrors({ general: "Invalid email or password" });
      } else if (response.status === 429) {
        // rate limited
        setErrors({ general: "Too many attempts. Please try again later." });
      } else {
        // some other backend error
        setErrors({ general: data.message || "Something went wrong" });
      }
    } catch (err) {
      // backend is not running - fall back to demo mode
      login("demo-token", {
        name: "R. Chavez",
        email: email,
        role: "Company Rep",
      });
      navigate("/dashboard");
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      {/* left side - navy branding panel */}
      <div className="login-brand">
        <h1 className="login-brand-title">FieldPortal</h1>
        <p className="login-brand-subtitle">Permian Basin Operations</p>
        <p className="login-brand-tagline">
          Manage jobs, work orders, and invoices in one place.
        </p>
      </div>

      {/* right side - login form */}
      <div className="login-form-wrapper">
        <div className="login-form-container">
          <h2 className="login-heading">Welcome back</h2>
          <p className="login-subheading">Sign in to your account</p>

          {/* general error message if needed */}
          {errors.general && (
            <p className="form-error-banner">{errors.general}</p>
          )}

          <form onSubmit={handleSubmit} className="login-form" noValidate>
            {/* email field */}
            <label className="form-label">Email</label>
            <input
              type="email"
              className={`form-input ${errors.email ? "input-error" : ""}`}
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {/* show email error if there is one */}
            {errors.email && <p className="form-error">{errors.email}</p>}

            {/* password field */}
            <label className="form-label">Password</label>
            <input
              type="password"
              className={`form-input ${errors.password ? "input-error" : ""}`}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {/* show password error if there is one */}
            {errors.password && <p className="form-error">{errors.password}</p>}

            {/* forgot password link */}
            <div className="login-options">
              <a href="#" className="login-forgot">Forgot password?</a>
            </div>

            {/* submit button - disabled while waiting on API */}
            <button type="submit" className="form-button" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* link to register page */}
          <p className="form-footer-text">
            Don't have an account?{" "}
            <Link to="/register" className="form-footer-link">
              Request access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
