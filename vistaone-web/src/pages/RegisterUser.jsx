import React, { useState } from "react";
import { companies } from "../data/companies";
import { Link } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/register-user.css";
import "../styles/login.css";
import {
  Mail,
  LockKeyhole,
  Eye,
  EyeOff,
  User,
  Calendar,
  MapPin,
  Phone,
  Image as ImageIcon,
  IdCard,
} from "lucide-react";

const initialState = {
  username: "",
  password: "",
  confirmPassword: "",
  email: "",
  profilePhoto: null,
  firstName: "",
  lastName: "",
  middleName: "",
  contactNumber: "",
  alternateNumber: "",
  dob: "",
  ssnLastFour: "",
  addressLine1: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  companyId: "",
};

function RegisterUser() {
  const [formData, setFormData] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "profilePhoto") {
      setFormData({ ...formData, profilePhoto: files[0] });
      setPhotoPreview(files[0] ? URL.createObjectURL(files[0]) : null);
    } else {
      setFormData({ ...formData, [name]: value });
    }
    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
  };

  // Validate only step 1 fields
  function validateStep1() {
    const newErrors = {};

    const username = formData.username.trim();
    const email = formData.email.trim().toLowerCase();
    const password = formData.password;
    const confirmPassword = formData.confirmPassword;

    if (!formData.companyId) newErrors.companyId = "Company is required";

    if (!username) {
      newErrors.username = "Username is required";
    } else if (username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Invalid email";

    if (!password) {
      newErrors.password = "Password is required";
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)) {
      newErrors.password =
        "Password must be at least 8 characters and include uppercase, lowercase, and a number";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // Validate only step 2 fields
  function validateStep2() {
    const newErrors = {};

    const firstName = formData.firstName.trim();
    const middleName = formData.middleName.trim();
    const lastName = formData.lastName.trim();
    const contactNumber = formData.contactNumber.trim();
    const alternateNumber = formData.alternateNumber.trim();
    const dob = formData.dob;
    const ssnLastFour = formData.ssnLastFour.trim();
    const addressLine1 = formData.addressLine1.trim();
    const city = formData.city.trim();
    const state = formData.state.trim();
    const zip = formData.zip.trim();
    const country = formData.country.trim();

    if (!firstName) {
      newErrors.firstName = "First name is required";
    } else if (!/^[a-zA-Z\s'-]+$/.test(firstName)) {
      newErrors.firstName = "Only letters are allowed";
    }

    if (!lastName) {
      newErrors.lastName = "Last name is required";
    } else if (!/^[a-zA-Z\s'-]+$/.test(lastName)) {
      newErrors.lastName = "Only letters are allowed";
    }

    if (middleName && !/^[a-zA-Z\s'-]+$/.test(middleName)) {
      newErrors.middleName = "Only letters are allowed";
    }

    if (!contactNumber) {
      newErrors.contactNumber = "Contact number is required";
    } else if (!/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(contactNumber)) {
      newErrors.contactNumber = "Invalid phone number";
    }

    if (
      alternateNumber &&
      !/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(alternateNumber)
    ) {
      newErrors.alternateNumber = "Invalid alternate number";
    }

    if (!dob) {
      newErrors.dob = "Date of birth is required";
    } else {
      const today = new Date();
      const birthDate = new Date(dob);
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();

      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 18) {
        newErrors.dob = "You must be at least 18 years old";
      }
    }

    if (ssnLastFour && !/^\d{4}$/.test(ssnLastFour)) {
      newErrors.ssnLastFour = "Must be 4 digits";
    } else if (ssnLastFour && ssnLastFour === "0000") {
      newErrors.ssnLastFour = "Invalid SSN";
    }

    if (!addressLine1) {
      newErrors.addressLine1 = "Address line 1 is required";
    } else if (addressLine1.length < 5) {
      newErrors.addressLine1 = "Address is too short";
    }

    if (!city) {
      newErrors.city = "City is required";
    } else if (!/^[a-zA-Z\s'-]{2,}$/.test(city)) {
      newErrors.city = "Invalid city name";
    }

    if (!state) {
      newErrors.state = "State is required";
    } else if (!/^[a-zA-Z\s'-]{2,}$/.test(state)) {
      newErrors.state = "Invalid state name";
    }

    if (!zip) {
      newErrors.zip = "ZIP code is required";
    } else if (!/^\d{5}(-\d{4})?$/.test(zip)) {
      newErrors.zip = "Invalid ZIP code";
    }

    if (!country) {
      newErrors.country = "Country is required";
    } else if (country.length < 2) {
      newErrors.country = "Invalid country";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const handleNext = (e) => {
    e.preventDefault();
    if (validateStep1()) setStep(2);
  };

  const handleBack = (e) => {
    e.preventDefault();
    setStep(1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateStep2()) return;
    // TODO: Send formData to backend
    // On successful backend response:
    setRegistrationComplete(true);
  };

  const selectedCompany = companies.find((c) => c.id === formData.companyId);

  return (
    <div className="login-page position-relative overflow-hidden">
      <div className="container-fluid position-relative">
        <div className="row min-vh-100 g-0">
          {/* Left hero/preview section */}
          <section className="col-lg-7 order-2 order-md-1 d-flex flex-column justify-content-between px-4 px-lg-5 py-4 py-lg-5 login-hero">
            <div>
              <div className="login-badge d-inline-flex align-items-center gap-3 rounded-pill px-3 py-2">
                <div className="login-badge-icon d-inline-flex align-items-center justify-content-center rounded-3">
                  <User size={18} />
                </div>
                <div>
                  <p className="login-badge-overline mb-1 text-uppercase">
                    Client Platform
                  </p>
                  <p className="mb-0 fw-semibold">User Registration</p>
                </div>
              </div>
              <div className="mt-5 pt-lg-4">
                <p className="login-hero-overline mb-3 text-uppercase fw-semibold">
                  Create your account
                </p>
                <h1 className="login-hero-title fw-semibold mb-4">
                  Register to access the client command center.
                </h1>
                <p className="login-hero-text mb-4">
                  Fill out the form to request access for job management, work
                  orders, and more. Your registration will be reviewed by an
                  administrator.
                </p>
              </div>
            </div>
          </section>
          {/* Right registration panel */}
          <section className="col-lg-5 order-1 order-md-2 d-flex align-items-center justify-content-center px-4 px-lg-5 py-5">
            <div className="login-panel w-100 shadow-lg">
              {registrationComplete ? (
                <div className="text-center py-5">
                  <h2 className="mb-3">Registration Successful!</h2>
                  <p className="mb-4">
                    Thank you for registering. Please check your email and
                    follow the instructions to verify your account before
                    logging in.
                  </p>
                  <Link to="/login" className="btn btn-primary">
                    Go to Login
                  </Link>
                </div>
              ) : (
                <>
                  {step === 1 && (
                    <form onSubmit={handleNext} noValidate>
                      {/* Company Select */}
                      <div className="mb-3">
                        <label className="form-label login-label">
                          Company
                        </label>
                        <select
                          name="companyId"
                          value={formData.companyId}
                          onChange={handleChange}
                          className={`form-select${errors.companyId ? " is-invalid" : ""}`}
                        >
                          <option value="">Select your company</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                        {errors.companyId && (
                          <div className="invalid-feedback d-block">
                            {errors.companyId}
                          </div>
                        )}
                        {/* Show company web address if available */}
                        {selectedCompany?.web && (
                          <div className="mt-2 small text-primary">
                            Website:{" "}
                            <a
                              href={selectedCompany.web}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {selectedCompany.web}
                            </a>
                          </div>
                        )}
                      </div>
                      {/* Username */}
                      <div className="mb-3">
                        <label className="form-label login-label">
                          Username
                        </label>
                        <div className="input-group login-input-group">
                          <span className="input-group-text">
                            <User size={18} />
                          </span>
                          <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            className={`form-control${errors.username ? " is-invalid" : ""}`}
                            placeholder="Choose a username"
                          />
                        </div>
                        {errors.username && (
                          <div className="invalid-feedback d-block">
                            {errors.username}
                          </div>
                        )}
                      </div>
                      {/* Email */}
                      <div className="mb-3">
                        <label className="form-label login-label">Email</label>
                        <div className="input-group login-input-group">
                          <span className="input-group-text">
                            <Mail size={18} />
                          </span>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className={`form-control${errors.email ? " is-invalid" : ""}`}
                            placeholder="you@company.com"
                          />
                        </div>
                        {errors.email && (
                          <div className="invalid-feedback d-block">
                            {errors.email}
                          </div>
                        )}
                      </div>
                      {/* Password */}
                      <div className="mb-3">
                        <label className="form-label login-label">
                          Password
                        </label>
                        <div className="input-group login-input-group">
                          <span className="input-group-text">
                            <LockKeyhole size={18} />
                          </span>
                          <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            className={`form-control${errors.password ? " is-invalid" : ""}`}
                            placeholder="Create a password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="btn"
                            tabIndex={-1}
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                          >
                            {showPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                        </div>
                        {errors.password && (
                          <div className="invalid-feedback d-block">
                            {errors.password}
                          </div>
                        )}
                      </div>
                      {/* Confirm Password */}
                      <div className="mb-3">
                        <label className="form-label login-label">
                          Confirm Password
                        </label>
                        <div className="input-group login-input-group">
                          <span className="input-group-text">
                            <LockKeyhole size={18} />
                          </span>
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className={`form-control${errors.confirmPassword ? " is-invalid" : ""}`}
                            placeholder="Re-enter password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="btn"
                            tabIndex={-1}
                            aria-label={
                              showConfirmPassword
                                ? "Hide password"
                                : "Show password"
                            }
                          >
                            {showConfirmPassword ? (
                              <EyeOff size={18} />
                            ) : (
                              <Eye size={18} />
                            )}
                          </button>
                        </div>
                        {errors.confirmPassword && (
                          <div className="invalid-feedback d-block">
                            {errors.confirmPassword}
                          </div>
                        )}
                      </div>
                      <button
                        type="submit"
                        className="btn login-submit-btn w-100 d-inline-flex align-items-center justify-content-center gap-2 mt-3"
                      >
                        Next
                      </button>
                    </form>
                  )}
                  {step === 2 && (
                    <form onSubmit={handleSubmit} noValidate>
                      {/* Profile Photo */}
                      <div className="mb-3">
                        <label className="form-label login-label">
                          Profile Photo
                        </label>
                        <div className="input-group login-input-group">
                          <span className="input-group-text">
                            <ImageIcon size={18} />
                          </span>
                          <input
                            type="file"
                            name="profilePhoto"
                            accept="image/*"
                            className="form-control"
                            onChange={handleChange}
                          />
                        </div>
                        {photoPreview && (
                          <img
                            src={photoPreview}
                            alt="Preview"
                            className="profile-photo-preview mt-2"
                          />
                        )}
                      </div>
                      {/* First, Middle, Last Name */}
                      <div className="row g-2">
                        <div className="col-md-4 mb-3">
                          <label className="form-label login-label">
                            First Name
                          </label>
                          <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            className={`form-control${errors.firstName ? " is-invalid" : ""}`}
                            placeholder="First name"
                          />
                          {errors.firstName && (
                            <div className="invalid-feedback d-block">
                              {errors.firstName}
                            </div>
                          )}
                        </div>
                        <div className="col-md-4 mb-3">
                          <label className="form-label login-label">
                            Middle Name
                          </label>
                          <input
                            type="text"
                            name="middleName"
                            value={formData.middleName}
                            onChange={handleChange}
                            className="form-control"
                            placeholder="Middle name (optional)"
                          />
                          {errors.middleName && (
                            <div className="invalid-feedback d-block">
                              {errors.middleName}
                            </div>
                          )}
                        </div>
                        <div className="col-md-4 mb-3">
                          <label className="form-label login-label">
                            Last Name
                          </label>
                          <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            className={`form-control${errors.lastName ? " is-invalid" : ""}`}
                            placeholder="Last name"
                          />
                          {errors.lastName && (
                            <div className="invalid-feedback d-block">
                              {errors.lastName}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Contact Numbers */}
                      <div className="row g-2">
                        <div className="col-md-6 mb-3">
                          <label className="form-label login-label">
                            Contact Number
                          </label>
                          <div className="input-group login-input-group">
                            <span className="input-group-text">
                              <Phone size={18} />
                            </span>
                            <input
                              type="tel"
                              name="contactNumber"
                              value={formData.contactNumber}
                              onChange={handleChange}
                              className={`form-control${errors.contactNumber ? " is-invalid" : ""}`}
                              placeholder="(555) 123-4567"
                            />
                          </div>
                          {errors.contactNumber && (
                            <div className="invalid-feedback d-block">
                              {errors.contactNumber}
                            </div>
                          )}
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label login-label">
                            Alternate Number
                          </label>
                          <div className="input-group login-input-group">
                            <span className="input-group-text">
                              <Phone size={18} />
                            </span>
                            <input
                              type="tel"
                              name="alternateNumber"
                              value={formData.alternateNumber}
                              onChange={handleChange}
                              className="form-control"
                              placeholder="(555) 987-6543 (optional)"
                            />
                          </div>
                          {errors.alternateNumber && (
                            <div className="invalid-feedback d-block">
                              {errors.alternateNumber}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* DOB and SSN */}
                      <div className="row g-2">
                        <div className="col-md-6 mb-3">
                          <label className="form-label login-label">
                            Date of Birth
                          </label>
                          <div className="input-group login-input-group">
                            <span className="input-group-text">
                              <Calendar size={18} />
                            </span>
                            <input
                              type="date"
                              name="dob"
                              value={formData.dob}
                              onChange={handleChange}
                              className={`form-control${errors.dob ? " is-invalid" : ""}`}
                            />
                          </div>
                          {errors.dob && (
                            <div className="invalid-feedback d-block">
                              {errors.dob}
                            </div>
                          )}
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label login-label">
                            SSN Last 4
                          </label>
                          <div className="input-group login-input-group">
                            <span className="input-group-text">
                              <IdCard size={18} />
                            </span>
                            <input
                              type="text"
                              name="ssnLastFour"
                              maxLength={4}
                              value={formData.ssnLastFour}
                              onChange={handleChange}
                              className={`form-control${errors.ssnLastFour ? " is-invalid" : ""}`}
                              placeholder="1234"
                            />
                          </div>
                          {errors.ssnLastFour && (
                            <div className="invalid-feedback d-block">
                              {errors.ssnLastFour}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Address Fields */}
                      <div className="mb-3">
                        <label className="form-label login-label">
                          Address Line 1
                        </label>
                        <div className="input-group login-input-group">
                          <span className="input-group-text">
                            <MapPin size={18} />
                          </span>
                          <input
                            type="text"
                            name="addressLine1"
                            value={formData.addressLine1}
                            onChange={handleChange}
                            className={`form-control${errors.addressLine1 ? " is-invalid" : ""}`}
                            placeholder="123 Main St"
                          />
                        </div>
                        {errors.addressLine1 && (
                          <div className="invalid-feedback d-block">
                            {errors.addressLine1}
                          </div>
                        )}
                      </div>
                      <div className="row g-2">
                        <div className="col-md-4 mb-3">
                          <label className="form-label login-label">City</label>
                          <input
                            type="text"
                            name="city"
                            value={formData.city}
                            onChange={handleChange}
                            className={`form-control${errors.city ? " is-invalid" : ""}`}
                            placeholder="City"
                          />
                          {errors.city && (
                            <div className="invalid-feedback d-block">
                              {errors.city}
                            </div>
                          )}
                        </div>
                        <div className="col-md-3 mb-3">
                          <label className="form-label login-label">
                            State
                          </label>
                          <input
                            type="text"
                            name="state"
                            value={formData.state}
                            onChange={handleChange}
                            className={`form-control${errors.state ? " is-invalid" : ""}`}
                            placeholder="State"
                          />
                          {errors.state && (
                            <div className="invalid-feedback d-block">
                              {errors.state}
                            </div>
                          )}
                        </div>
                        <div className="col-md-3 mb-3">
                          <label className="form-label login-label">ZIP</label>
                          <input
                            type="text"
                            name="zip"
                            value={formData.zip}
                            onChange={handleChange}
                            className={`form-control${errors.zip ? " is-invalid" : ""}`}
                            placeholder="ZIP"
                          />
                          {errors.zip && (
                            <div className="invalid-feedback d-block">
                              {errors.zip}
                            </div>
                          )}
                        </div>
                        <div className="col-md-2 mb-3">
                          <label className="form-label login-label">
                            Country
                          </label>
                          <input
                            type="text"
                            name="country"
                            value={formData.country}
                            onChange={handleChange}
                            className={`form-control${errors.country ? " is-invalid" : ""}`}
                            placeholder="Country"
                          />
                          {errors.country && (
                            <div className="invalid-feedback d-block">
                              {errors.country}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-3">
                        <button
                          type="button"
                          className="btn btn-outline-secondary w-50"
                          onClick={handleBack}
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          className="btn login-submit-btn w-50 d-inline-flex align-items-center justify-content-center gap-2"
                        >
                          Register
                        </button>
                      </div>
                    </form>
                  )}
                  <p className="form-footer-text mt-3">
                    Already have an account?{" "}
                    <Link to="/" className="form-footer-link">
                      Sign in
                    </Link>
                  </p>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default RegisterUser;
