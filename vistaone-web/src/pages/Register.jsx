// Register page - new users request access here
// includes full form validation for all fields
import React, { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/register.css";

function Register() {
  // one state object holds all the form fields
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    role: "",
    password: "",
    confirmPassword: "",
  });

  // tracks validation errors for each field
  const [errors, setErrors] = useState({});

  // tracks whether the form was successfully submitted
  const [submitted, setSubmitted] = useState(false);

  // updates the correct field in state when the user types
  // e.target.name matches the name attribute on each input
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

    // clear the error for this field as soon as they start typing
    if (errors[e.target.name]) {
      setErrors({
        ...errors,
        [e.target.name]: "",
      });
    }
  };

  // validates every field and returns true if the form is clean
  function validateForm() {
    const newErrors = {};

    // first name check
    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    // last name check
    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required";
    }

    // email checks
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // company check
    if (!formData.company.trim()) {
      newErrors.company = "Company is required";
    }

    // role check
    if (!formData.role.trim()) {
      newErrors.role = "Role is required";
    }

    // password checks
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    // confirm password must match
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // runs when the user clicks submit
  const handleSubmit = (e) => {
    e.preventDefault();

    // validate first - if errors exist, stop here
    if (!validateForm()) return;

    // later this will call the backend API to create the user
    // for now just show the success message
    setSubmitted(true);
  };

  return (
    <div className="register-page">
      {/* left side navy branding - matches the login page */}
      <div className="register-brand">
        <h1 className="register-brand-title">FieldPortal</h1>
        <p className="register-brand-subtitle">Permian Basin Operations</p>
        <p className="register-brand-tagline">
          Request access to manage jobs, track work orders, and handle invoicing.
        </p>
      </div>

      {/* right side - the form or success message */}
      <div className="register-form-wrapper">
        <div className="register-form-container">
          {/* after submitting, swap the form for a confirmation */}
          {submitted ? (
            <div className="register-success">
              <h2 className="login-heading">Request submitted</h2>
              <p className="register-success-text">
                Your registration is pending approval. An administrator will
                review your request and you'll receive an email once approved.
              </p>
              <Link to="/" className="register-back-link">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <h2 className="login-heading">Request access</h2>
              <p className="login-subheading">
                Fill out the form below and an admin will review your request
              </p>

              <form onSubmit={handleSubmit} className="register-form" noValidate>
                {/* first and last name side by side */}
                <div className="form-row">
                  <div className="form-field">
                    <label className="form-label">First name</label>
                    <input
                      type="text"
                      name="firstName"
                      className={`form-input ${errors.firstName ? "input-error" : ""}`}
                      placeholder="John"
                      value={formData.firstName}
                      onChange={handleChange}
                    />
                    {errors.firstName && <p className="form-error">{errors.firstName}</p>}
                  </div>
                  <div className="form-field">
                    <label className="form-label">Last name</label>
                    <input
                      type="text"
                      name="lastName"
                      className={`form-input ${errors.lastName ? "input-error" : ""}`}
                      placeholder="Doe"
                      value={formData.lastName}
                      onChange={handleChange}
                    />
                    {errors.lastName && <p className="form-error">{errors.lastName}</p>}
                  </div>
                </div>

                {/* email - full width */}
                <label className="form-label">Email</label>
                <input
                  type="email"
                  name="email"
                  className={`form-input ${errors.email ? "input-error" : ""}`}
                  placeholder="you@company.com"
                  value={formData.email}
                  onChange={handleChange}
                />
                {errors.email && <p className="form-error">{errors.email}</p>}

                {/* company and role side by side */}
                <div className="form-row">
                  <div className="form-field">
                    <label className="form-label">Company</label>
                    <input
                      type="text"
                      name="company"
                      className={`form-input ${errors.company ? "input-error" : ""}`}
                      placeholder="Company name"
                      value={formData.company}
                      onChange={handleChange}
                    />
                    {errors.company && <p className="form-error">{errors.company}</p>}
                  </div>
                  <div className="form-field">
                    <label className="form-label">Role</label>
                    <input
                      type="text"
                      name="role"
                      className={`form-input ${errors.role ? "input-error" : ""}`}
                      placeholder="e.g. Field Engineer"
                      value={formData.role}
                      onChange={handleChange}
                    />
                    {errors.role && <p className="form-error">{errors.role}</p>}
                  </div>
                </div>

                {/* password */}
                <label className="form-label">Password</label>
                <input
                  type="password"
                  name="password"
                  className={`form-input ${errors.password ? "input-error" : ""}`}
                  placeholder="Create a password (min 8 characters)"
                  value={formData.password}
                  onChange={handleChange}
                />
                {errors.password && <p className="form-error">{errors.password}</p>}

                {/* confirm password */}
                <label className="form-label">Confirm password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  className={`form-input ${errors.confirmPassword ? "input-error" : ""}`}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
                {errors.confirmPassword && <p className="form-error">{errors.confirmPassword}</p>}

                {/* submit */}
                <button type="submit" className="form-button">
                  Submit request
                </button>
              </form>

              {/* link back to login */}
              <p className="form-footer-text">
                Already have an account?{" "}
                <Link to="/" className="form-footer-link">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Register;
