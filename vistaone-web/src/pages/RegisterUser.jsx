import React, { useState, useEffect } from "react";
import { useRegisterUser } from "../hooks/useRegisterUser";
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
    first_name: "",
    last_name: "",
    middle_name: "",
    contact_number: "",
    alternate_number: "",
    date_of_birth: "",
    ssn_last_four: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    client_id: "",
};

function RegisterUser() {
    const [formData, setFormData] = useState(initialState);
    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [step, setStep] = useState(1);
    const [registrationComplete, setRegistrationComplete] = useState(false);

    const { submitRegistration, loading, error, success } = useRegisterUser();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
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

        if (!formData.client_id) newErrors.client_id = "Company is required";

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

        const first_name = formData.first_name.trim();
        const middle_name = formData.middle_name.trim();
        const last_name = formData.last_name.trim();
        const contact_number = formData.contact_number.trim();
        const alternate_number = formData.alternate_number.trim();
        const date_of_birth = formData.date_of_birth;
        const ssn_last_four = formData.ssn_last_four.trim();
        const street = formData.street.trim();
        const city = formData.city.trim();
        const state = formData.state.trim();
        const zip = formData.zip.trim();
        const country = formData.country.trim();

        if (!first_name) {
            newErrors.first_name = "First name is required";
        } else if (!/^[a-zA-Z\s'-]+$/.test(first_name)) {
            newErrors.first_name = "Only letters are allowed";
        }

        if (!last_name) {
            newErrors.last_name = "Last name is required";
        } else if (!/^[a-zA-Z\s'-]+$/.test(last_name)) {
            newErrors.last_name = "Only letters are allowed";
        }

        if (middle_name && !/^[a-zA-Z\s'-]+$/.test(middle_name)) {
            newErrors.middle_name = "Only letters are allowed";
        }

        if (!contact_number) {
            newErrors.contact_number = "Contact number is required";
        } else if (
            !/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(contact_number)
        ) {
            newErrors.contact_number = "Invalid phone number";
        }

        if (
            alternate_number &&
            !/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(alternate_number)
        ) {
            newErrors.alternate_number = "Invalid alternate number";
        }

        if (!date_of_birth) {
            newErrors.date_of_birth = "Date of birth is required";
        } else {
            const today = new Date();
            const birthDate = new Date(date_of_birth);
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();

            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }

            if (age < 18) {
                newErrors.date_of_birth = "You must be at least 18 years old";
            }
        }

        if (ssn_last_four && !/^\d{4}$/.test(ssn_last_four)) {
            newErrors.ssn_last_four = "Must be 4 digits";
        } else if (ssn_last_four && ssn_last_four === "0000") {
            newErrors.ssn_last_four = "Invalid SSN";
        }

        if (!street) {
            newErrors.street = "Street is required";
        } else if (street.length < 5) {
            newErrors.street = "Address is too short";
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateStep2()) return;
        await submitRegistration(formData);
    };

    useEffect(() => {
        if (success) {
            setRegistrationComplete(true);
            setFormData(initialState);
        }
    }, [success]);

    const selectedCompany = companies.find((c) => c.id === formData.client_id);

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
                                    <p className="mb-0 fw-semibold">
                                        User Registration
                                    </p>
                                </div>
                            </div>
                            <div className="mt-5 pt-lg-4">
                                <p className="login-hero-overline mb-3 text-uppercase fw-semibold">
                                    Create your account
                                </p>
                                <h1 className="login-hero-title fw-semibold mb-4">
                                    Register to access the client command
                                    center.
                                </h1>
                                <p className="login-hero-text mb-4">
                                    Fill out the form to request access for job
                                    management, work orders, and more. Your
                                    registration will be reviewed by an
                                    administrator.
                                </p>
                            </div>
                        </div>
                    </section>
                    {/* Right registration panel */}
                    <section className="col-lg-5 order-1 order-md-2 d-flex align-items-center justify-content-center px-4 px-lg-5 py-5">
                        <div className="login-panel w-100 shadow-lg">
                            {error && (
                                <div
                                    className="alert alert-danger"
                                    role="alert"
                                >
                                    {error}
                                </div>
                            )}
                            {loading && (
                                <div className="text-center mb-3">
                                    <span
                                        className="spinner-border spinner-border-sm"
                                        role="status"
                                        aria-hidden="true"
                                    ></span>{" "}
                                    Registering...
                                </div>
                            )}
                            {registrationComplete ? (
                                <div className="text-center py-5">
                                    <h2 className="mb-3">
                                        Registration Successful!
                                    </h2>
                                    <p className="mb-4">
                                        Thank you for registering. Please check
                                        your email and follow the instructions
                                        to verify your account before logging
                                        in.
                                    </p>
                                    <Link
                                        to="/login"
                                        className="btn btn-primary"
                                    >
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
                                                    name="client_id"
                                                    value={formData.client_id}
                                                    onChange={handleChange}
                                                    className={`form-select${errors.client_id ? " is-invalid" : ""}`}
                                                >
                                                    <option value="">
                                                        Select your company
                                                    </option>
                                                    {companies.map((c) => (
                                                        <option
                                                            key={c.id}
                                                            value={c.id}
                                                        >
                                                            {c.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {errors.client_id && (
                                                    <div className="invalid-feedback d-block">
                                                        {errors.client_id}
                                                    </div>
                                                )}
                                                {/* Show company web address if available */}
                                                {selectedCompany?.web && (
                                                    <div className="mt-2 small text-primary">
                                                        Website:{" "}
                                                        <a
                                                            href={
                                                                selectedCompany.web
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            {
                                                                selectedCompany.web
                                                            }
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
                                                        value={
                                                            formData.username
                                                        }
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
                                                <label className="form-label login-label">
                                                    Email
                                                </label>
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
                                                        <LockKeyhole
                                                            size={18}
                                                        />
                                                    </span>
                                                    <input
                                                        type={
                                                            showPassword
                                                                ? "text"
                                                                : "password"
                                                        }
                                                        name="password"
                                                        value={
                                                            formData.password
                                                        }
                                                        onChange={handleChange}
                                                        className={`form-control${errors.password ? " is-invalid" : ""}`}
                                                        placeholder="Create a password"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setShowPassword(
                                                                (v) => !v,
                                                            )
                                                        }
                                                        className="btn"
                                                        tabIndex={-1}
                                                        aria-label={
                                                            showPassword
                                                                ? "Hide password"
                                                                : "Show password"
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
                                                        <LockKeyhole
                                                            size={18}
                                                        />
                                                    </span>
                                                    <input
                                                        type={
                                                            showConfirmPassword
                                                                ? "text"
                                                                : "password"
                                                        }
                                                        name="confirmPassword"
                                                        value={
                                                            formData.confirmPassword
                                                        }
                                                        onChange={handleChange}
                                                        className={`form-control${errors.confirmPassword ? " is-invalid" : ""}`}
                                                        placeholder="Re-enter password"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setShowConfirmPassword(
                                                                (v) => !v,
                                                            )
                                                        }
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
                                        <form
                                            onSubmit={handleSubmit}
                                            noValidate
                                        >
                                            {/* First, Middle, Last Name */}
                                            <div className="row g-2">
                                                <div className="col-md-4 mb-3">
                                                    <label className="form-label login-label">
                                                        First Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="first_name"
                                                        value={
                                                            formData.first_name
                                                        }
                                                        onChange={handleChange}
                                                        className={`form-control${errors.first_name ? " is-invalid" : ""}`}
                                                        placeholder="First name"
                                                    />
                                                    {errors.first_name && (
                                                        <div className="invalid-feedback d-block">
                                                            {errors.first_name}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="col-md-4 mb-3">
                                                    <label className="form-label login-label">
                                                        Middle Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="middle_name"
                                                        value={
                                                            formData.middle_name
                                                        }
                                                        onChange={handleChange}
                                                        className="form-control"
                                                        placeholder="Middle name (optional)"
                                                    />
                                                    {errors.middle_name && (
                                                        <div className="invalid-feedback d-block">
                                                            {errors.middle_name}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="col-md-4 mb-3">
                                                    <label className="form-label login-label">
                                                        Last Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="last_name"
                                                        value={
                                                            formData.last_name
                                                        }
                                                        onChange={handleChange}
                                                        className={`form-control${errors.last_name ? " is-invalid" : ""}`}
                                                        placeholder="Last name"
                                                    />
                                                    {errors.last_name && (
                                                        <div className="invalid-feedback d-block">
                                                            {errors.last_name}
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
                                                            name="contact_number"
                                                            value={
                                                                formData.contact_number
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            className={`form-control${errors.contact_number ? " is-invalid" : ""}`}
                                                            placeholder="(555) 123-4567"
                                                        />
                                                    </div>
                                                    {errors.contact_number && (
                                                        <div className="invalid-feedback d-block">
                                                            {
                                                                errors.contact_number
                                                            }
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
                                                            name="alternate_number"
                                                            value={
                                                                formData.alternate_number
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            className={`form-control${errors.alternate_number ? " is-invalid" : ""}`}
                                                            placeholder="(555) 987-6543 (optional)"
                                                        />
                                                    </div>
                                                    {errors.alternate_number && (
                                                        <div className="invalid-feedback d-block">
                                                            {
                                                                errors.alternate_number
                                                            }
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
                                                            <Calendar
                                                                size={18}
                                                            />
                                                        </span>
                                                        <input
                                                            type="date"
                                                            name="date_of_birth"
                                                            value={
                                                                formData.date_of_birth
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            className={`form-control${errors.date_of_birth ? " is-invalid" : ""}`}
                                                        />
                                                    </div>
                                                    {errors.date_of_birth && (
                                                        <div className="invalid-feedback d-block">
                                                            {
                                                                errors.date_of_birth
                                                            }
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
                                                            name="ssn_last_four"
                                                            maxLength={4}
                                                            value={
                                                                formData.ssn_last_four
                                                            }
                                                            onChange={
                                                                handleChange
                                                            }
                                                            className={`form-control${errors.ssn_last_four ? " is-invalid" : ""}`}
                                                            placeholder="1234"
                                                        />
                                                    </div>
                                                    {errors.ssn_last_four && (
                                                        <div className="invalid-feedback d-block">
                                                            {
                                                                errors.ssn_last_four
                                                            }
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
                                                        name="street"
                                                        value={formData.street}
                                                        onChange={handleChange}
                                                        className={`form-control${errors.street ? " is-invalid" : ""}`}
                                                        placeholder="123 Main St"
                                                    />
                                                </div>
                                                {errors.street && (
                                                    <div className="invalid-feedback d-block">
                                                        {errors.street}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="row g-2">
                                                <div className="col-md-4 mb-3">
                                                    <label className="form-label login-label">
                                                        City
                                                    </label>
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
                                                    <label className="form-label login-label">
                                                        ZIP
                                                    </label>
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
                                        <Link
                                            to="/"
                                            className="form-footer-link"
                                        >
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
