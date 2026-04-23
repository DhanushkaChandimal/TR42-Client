import { useState } from "react";
import { useRegisterClient } from "../hooks/useRegisterClient";
import { Link } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "../styles/login.css";
import {
    Mail,
    Phone,
    MapPin,
    Building2,
    Globe,
    Hash,
    User,
    LockKeyhole,
    Eye,
    EyeOff,
    ArrowRight,
} from "lucide-react";

const initialCompanyData = {
    client_name: "",
    client_code: "",
    company_email: "",
    company_contact_number: "",
    company_web_address: "",
    primary_contact_name: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "",
};

const initialAdminData = {
    first_name: "",
    last_name: "",
    username: "",
    email: "",
    contact_number: "",
    password: "",
    confirmPassword: "",
};

function RegisterClient() {
    const [companyData, setCompanyData] = useState(initialCompanyData);
    const [adminData, setAdminData] = useState(initialAdminData);
    const [companyErrors, setCompanyErrors] = useState({});
    const [adminErrors, setAdminErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [step, setStep] = useState(1);
    const [registrationComplete, setRegistrationComplete] = useState(false);

    const { submitClientRegistration, loading, error } = useRegisterClient();

    const handleCompanyChange = (e) => {
        const { name, value } = e.target;
        setCompanyData({ ...companyData, [name]: value });
        if (companyErrors[name])
            setCompanyErrors({ ...companyErrors, [name]: "" });
    };

    const handleAdminChange = (e) => {
        const { name, value } = e.target;
        setAdminData({ ...adminData, [name]: value });
        if (adminErrors[name]) setAdminErrors({ ...adminErrors, [name]: "" });
    };

    function validateStep1() {
        const newErrors = {};
        const {
            client_name,
            client_code,
            company_email,
            company_contact_number,
            company_web_address,
        } = companyData;

        if (!client_name.trim())
            newErrors.client_name = "Company name is required";
        else if (client_name.trim().length < 2)
            newErrors.client_name =
                "Company name must be at least 2 characters";

        if (!client_code.trim())
            newErrors.client_code = "Client code is required";
        else if (!/^[a-zA-Z0-9_-]{2,}$/.test(client_code.trim()))
            newErrors.client_code =
                "Code must be alphanumeric (letters, numbers, dashes, underscores)";

        if (!company_email.trim())
            newErrors.company_email = "Company email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company_email.trim()))
            newErrors.company_email = "Invalid email address";

        if (!company_contact_number.trim())
            newErrors.company_contact_number = "Contact number is required";
        else if (
            !/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(
                company_contact_number.trim(),
            )
        )
            newErrors.company_contact_number = "Invalid phone number";

        if (
            company_web_address.trim() &&
            !/^https?:\/\/.+\..+/.test(company_web_address.trim())
        )
            newErrors.company_web_address =
                "Must be a valid URL (e.g. https://example.com)";

        setCompanyErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    function validateStep2() {
        const newErrors = {};
        const { primary_contact_name, street, city, state, zip, country } =
            companyData;

        if (!primary_contact_name.trim())
            newErrors.primary_contact_name = "Primary contact name is required";
        else if (!/^[a-zA-Z\s'-]+$/.test(primary_contact_name.trim()))
            newErrors.primary_contact_name = "Only letters are allowed";

        if (!street.trim()) newErrors.street = "Street is required";
        else if (street.trim().length < 5)
            newErrors.street = "Address is too short";

        if (!city.trim()) newErrors.city = "City is required";
        else if (!/^[a-zA-Z\s'-]{2,}$/.test(city.trim()))
            newErrors.city = "Invalid city name";

        if (!state.trim()) newErrors.state = "State is required";
        else if (!/^[a-zA-Z\s'-]{2,}$/.test(state.trim()))
            newErrors.state = "Invalid state name";

        if (!zip.trim()) newErrors.zip = "ZIP code is required";
        else if (!/^\d{5}(-\d{4})?$/.test(zip.trim()))
            newErrors.zip = "Invalid ZIP code";

        if (!country.trim()) newErrors.country = "Country is required";
        else if (country.trim().length < 2)
            newErrors.country = "Invalid country";

        setCompanyErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    function validateStep3() {
        const newErrors = {};
        const {
            first_name,
            last_name,
            username,
            email,
            contact_number,
            password,
            confirmPassword,
        } = adminData;

        if (!first_name.trim()) newErrors.first_name = "First name is required";
        else if (!/^[a-zA-Z\s'-]+$/.test(first_name.trim()))
            newErrors.first_name = "Only letters are allowed";

        if (!last_name.trim()) newErrors.last_name = "Last name is required";
        else if (!/^[a-zA-Z\s'-]+$/.test(last_name.trim()))
            newErrors.last_name = "Only letters are allowed";

        if (!username.trim()) newErrors.username = "Username is required";
        else if (username.trim().length < 3)
            newErrors.username = "Username must be at least 3 characters";

        if (!email.trim()) newErrors.email = "Email is required";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
            newErrors.email = "Invalid email address";

        if (!contact_number.trim())
            newErrors.contact_number = "Contact number is required";
        else if (
            !/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(contact_number.trim())
        )
            newErrors.contact_number = "Invalid phone number";

        if (!password) newErrors.password = "Password is required";
        else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password))
            newErrors.password =
                "Must be 8+ characters with uppercase, lowercase, and a number";

        if (!confirmPassword)
            newErrors.confirmPassword = "Please confirm your password";
        else if (password !== confirmPassword)
            newErrors.confirmPassword = "Passwords do not match";

        setAdminErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }

    const handleNext = (e) => {
        e.preventDefault();
        if (validateStep1()) setStep(2);
    };

    const handleNextStep2 = (e) => {
        e.preventDefault();
        if (validateStep2()) setStep(3);
    };

    const handleBack = (e) => {
        e.preventDefault();
        setStep((prev) => prev - 1);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateStep3()) return;
        const ok = await submitClientRegistration({
            company: companyData,
            adminUser: adminData,
        });
        if (ok) {
            setRegistrationComplete(true);
            setCompanyData(initialCompanyData);
            setAdminData(initialAdminData);
        }
    };

    const stepTitles = [
        "Company Details",
        "Contact & Address",
        "Admin Account",
    ];
    const stepDescriptions = [
        "Enter your company's information.",
        "Provide the primary contact and registered address.",
        "Create the administrator account for your company.",
    ];

    return (
        <div className="login-page position-relative overflow-hidden">
            <div className="container-fluid position-relative">
                <div className="row min-vh-100 g-0">
                    {/* Left hero section */}
                    <section className="col-lg-7 order-2 order-md-1 d-flex flex-column justify-content-between px-4 px-lg-5 py-4 py-lg-5 login-hero">
                        <div>
                            <div className="login-badge d-inline-flex align-items-center gap-3 rounded-pill px-3 py-2">
                                <div className="login-badge-icon d-inline-flex align-items-center justify-content-center rounded-3">
                                    <Building2 size={18} />
                                </div>
                                <div>
                                    <p className="login-badge-overline mb-1 text-uppercase">
                                        Client Platform
                                    </p>
                                    <p className="mb-0 fw-semibold">
                                        Client Registration
                                    </p>
                                </div>
                            </div>
                            <div className="mt-5 pt-lg-4">
                                <p className="login-hero-overline mb-3 text-uppercase fw-semibold">
                                    Register your company
                                </p>
                                <h1 className="login-hero-title fw-semibold mb-4">
                                    Onboard your company to the client command
                                    center.
                                </h1>
                                <p className="login-hero-text mb-4">
                                    Register your organization to gain access to
                                    vendor management, work order tracking,
                                    compliance monitoring, and invoice review.
                                    Your administrator account will be created
                                    alongside your company profile.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Right registration panel */}
                    <section className="col-lg-5 order-1 order-md-2 d-flex align-items-center justify-content-center px-4 px-lg-5 py-5">
                        <div className="login-panel w-100 shadow-lg">
                            {error && (
                                <div
                                    className="alert alert-danger login-alert mb-4"
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
                                        Your company has been registered
                                        successfully.
                                    </p>
                                    <Link
                                        to="/login"
                                        className="btn login-submit-btn d-inline-flex align-items-center gap-2 px-4"
                                    >
                                        Go to Login
                                        <ArrowRight size={16} />
                                    </Link>
                                </div>
                            ) : (
                                <>
                                    <div className="mb-4">
                                        <p className="login-panel-overline mb-2 text-uppercase">
                                            Step {step} of 3
                                        </p>
                                        <h2 className="mb-2">
                                            {stepTitles[step - 1]}
                                        </h2>
                                        <p className="login-panel-text">
                                            {stepDescriptions[step - 1]}
                                        </p>
                                    </div>

                                    {/* ── Step 1: Company Details ── */}
                                    {step === 1 && (
                                        <form onSubmit={handleNext} noValidate>
                                            <div className="mb-3">
                                                <label className="form-label login-label">
                                                    Company Name
                                                </label>
                                                <div className="input-group login-input-group">
                                                    <span className="input-group-text">
                                                        <Building2 size={18} />
                                                    </span>
                                                    <input
                                                        type="text"
                                                        name="client_name"
                                                        value={
                                                            companyData.client_name
                                                        }
                                                        onChange={
                                                            handleCompanyChange
                                                        }
                                                        className={`form-control${companyErrors.client_name ? " is-invalid" : ""}`}
                                                        placeholder="Acme Corporation"
                                                    />
                                                </div>
                                                {companyErrors.client_name && (
                                                    <div className="invalid-feedback d-block">
                                                        {
                                                            companyErrors.client_name
                                                        }
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label login-label">
                                                    Client Code
                                                </label>
                                                <div className="input-group login-input-group">
                                                    <span className="input-group-text">
                                                        <Hash size={18} />
                                                    </span>
                                                    <input
                                                        type="text"
                                                        name="client_code"
                                                        value={
                                                            companyData.client_code
                                                        }
                                                        onChange={
                                                            handleCompanyChange
                                                        }
                                                        className={`form-control${companyErrors.client_code ? " is-invalid" : ""}`}
                                                        placeholder="ACME-01"
                                                    />
                                                </div>
                                                {companyErrors.client_code && (
                                                    <div className="invalid-feedback d-block">
                                                        {
                                                            companyErrors.client_code
                                                        }
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label login-label">
                                                    Company Email
                                                </label>
                                                <div className="input-group login-input-group">
                                                    <span className="input-group-text">
                                                        <Mail size={18} />
                                                    </span>
                                                    <input
                                                        type="email"
                                                        name="company_email"
                                                        value={
                                                            companyData.company_email
                                                        }
                                                        onChange={
                                                            handleCompanyChange
                                                        }
                                                        className={`form-control${companyErrors.company_email ? " is-invalid" : ""}`}
                                                        placeholder="info@company.com"
                                                    />
                                                </div>
                                                {companyErrors.company_email && (
                                                    <div className="invalid-feedback d-block">
                                                        {
                                                            companyErrors.company_email
                                                        }
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mb-3">
                                                <label className="form-label login-label">
                                                    Contact Number
                                                </label>
                                                <div className="input-group login-input-group">
                                                    <span className="input-group-text">
                                                        <Phone size={18} />
                                                    </span>
                                                    <input
                                                        type="tel"
                                                        name="company_contact_number"
                                                        value={
                                                            companyData.company_contact_number
                                                        }
                                                        onChange={
                                                            handleCompanyChange
                                                        }
                                                        className={`form-control${companyErrors.company_contact_number ? " is-invalid" : ""}`}
                                                        placeholder="(555) 123-4567"
                                                    />
                                                </div>
                                                {companyErrors.company_contact_number && (
                                                    <div className="invalid-feedback d-block">
                                                        {
                                                            companyErrors.company_contact_number
                                                        }
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mb-4">
                                                <label className="form-label login-label">
                                                    Website{" "}
                                                    <span className="text-muted fw-normal">
                                                        (optional)
                                                    </span>
                                                </label>
                                                <div className="input-group login-input-group">
                                                    <span className="input-group-text">
                                                        <Globe size={18} />
                                                    </span>
                                                    <input
                                                        type="text"
                                                        name="company_web_address"
                                                        value={
                                                            companyData.company_web_address
                                                        }
                                                        onChange={
                                                            handleCompanyChange
                                                        }
                                                        className={`form-control${companyErrors.company_web_address ? " is-invalid" : ""}`}
                                                        placeholder="https://company.com"
                                                    />
                                                </div>
                                                {companyErrors.company_web_address && (
                                                    <div className="invalid-feedback d-block">
                                                        {
                                                            companyErrors.company_web_address
                                                        }
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                type="submit"
                                                className="btn login-submit-btn w-100 d-inline-flex align-items-center justify-content-center gap-2"
                                            >
                                                Next <ArrowRight size={16} />
                                            </button>
                                        </form>
                                    )}

                                    {/* ── Step 2: Contact & Address ── */}
                                    {step === 2 && (
                                        <form
                                            onSubmit={handleNextStep2}
                                            noValidate
                                        >
                                            <div className="mb-3">
                                                <label className="form-label login-label">
                                                    Primary Contact Name
                                                </label>
                                                <div className="input-group login-input-group">
                                                    <span className="input-group-text">
                                                        <User size={18} />
                                                    </span>
                                                    <input
                                                        type="text"
                                                        name="primary_contact_name"
                                                        value={
                                                            companyData.primary_contact_name
                                                        }
                                                        onChange={
                                                            handleCompanyChange
                                                        }
                                                        className={`form-control${companyErrors.primary_contact_name ? " is-invalid" : ""}`}
                                                        placeholder="Jane Smith"
                                                    />
                                                </div>
                                                {companyErrors.primary_contact_name && (
                                                    <div className="invalid-feedback d-block">
                                                        {
                                                            companyErrors.primary_contact_name
                                                        }
                                                    </div>
                                                )}
                                            </div>

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
                                                        value={
                                                            companyData.street
                                                        }
                                                        onChange={
                                                            handleCompanyChange
                                                        }
                                                        className={`form-control${companyErrors.street ? " is-invalid" : ""}`}
                                                        placeholder="123 Main St"
                                                    />
                                                </div>
                                                {companyErrors.street && (
                                                    <div className="invalid-feedback d-block">
                                                        {companyErrors.street}
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
                                                        value={companyData.city}
                                                        onChange={
                                                            handleCompanyChange
                                                        }
                                                        className={`form-control${companyErrors.city ? " is-invalid" : ""}`}
                                                        placeholder="City"
                                                    />
                                                    {companyErrors.city && (
                                                        <div className="invalid-feedback d-block">
                                                            {companyErrors.city}
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
                                                        value={
                                                            companyData.state
                                                        }
                                                        onChange={
                                                            handleCompanyChange
                                                        }
                                                        className={`form-control${companyErrors.state ? " is-invalid" : ""}`}
                                                        placeholder="State"
                                                    />
                                                    {companyErrors.state && (
                                                        <div className="invalid-feedback d-block">
                                                            {
                                                                companyErrors.state
                                                            }
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
                                                        value={companyData.zip}
                                                        onChange={
                                                            handleCompanyChange
                                                        }
                                                        className={`form-control${companyErrors.zip ? " is-invalid" : ""}`}
                                                        placeholder="ZIP"
                                                    />
                                                    {companyErrors.zip && (
                                                        <div className="invalid-feedback d-block">
                                                            {companyErrors.zip}
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
                                                        value={
                                                            companyData.country
                                                        }
                                                        onChange={
                                                            handleCompanyChange
                                                        }
                                                        className={`form-control${companyErrors.country ? " is-invalid" : ""}`}
                                                        placeholder="US"
                                                    />
                                                    {companyErrors.country && (
                                                        <div className="invalid-feedback d-block">
                                                            {
                                                                companyErrors.country
                                                            }
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
                                                    Next{" "}
                                                    <ArrowRight size={16} />
                                                </button>
                                            </div>
                                        </form>
                                    )}

                                    {/* ── Step 3: Admin Account ── */}
                                    {step === 3 && (
                                        <form
                                            onSubmit={handleSubmit}
                                            noValidate
                                        >
                                            <div className="row g-2">
                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label login-label">
                                                        First Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="first_name"
                                                        value={
                                                            adminData.first_name
                                                        }
                                                        onChange={
                                                            handleAdminChange
                                                        }
                                                        className={`form-control${adminErrors.first_name ? " is-invalid" : ""}`}
                                                        placeholder="First name"
                                                    />
                                                    {adminErrors.first_name && (
                                                        <div className="invalid-feedback d-block">
                                                            {
                                                                adminErrors.first_name
                                                            }
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label login-label">
                                                        Last Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="last_name"
                                                        value={
                                                            adminData.last_name
                                                        }
                                                        onChange={
                                                            handleAdminChange
                                                        }
                                                        className={`form-control${adminErrors.last_name ? " is-invalid" : ""}`}
                                                        placeholder="Last name"
                                                    />
                                                    {adminErrors.last_name && (
                                                        <div className="invalid-feedback d-block">
                                                            {
                                                                adminErrors.last_name
                                                            }
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

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
                                                            adminData.username
                                                        }
                                                        onChange={
                                                            handleAdminChange
                                                        }
                                                        className={`form-control${adminErrors.username ? " is-invalid" : ""}`}
                                                        placeholder="Choose a username"
                                                    />
                                                </div>
                                                {adminErrors.username && (
                                                    <div className="invalid-feedback d-block">
                                                        {adminErrors.username}
                                                    </div>
                                                )}
                                            </div>

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
                                                        value={adminData.email}
                                                        onChange={
                                                            handleAdminChange
                                                        }
                                                        className={`form-control${adminErrors.email ? " is-invalid" : ""}`}
                                                        placeholder="admin@company.com"
                                                    />
                                                </div>
                                                {adminErrors.email && (
                                                    <div className="invalid-feedback d-block">
                                                        {adminErrors.email}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mb-3">
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
                                                            adminData.contact_number
                                                        }
                                                        onChange={
                                                            handleAdminChange
                                                        }
                                                        className={`form-control${adminErrors.contact_number ? " is-invalid" : ""}`}
                                                        placeholder="(555) 123-4567"
                                                    />
                                                </div>
                                                {adminErrors.contact_number && (
                                                    <div className="invalid-feedback d-block">
                                                        {
                                                            adminErrors.contact_number
                                                        }
                                                    </div>
                                                )}
                                            </div>

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
                                                            adminData.password
                                                        }
                                                        onChange={
                                                            handleAdminChange
                                                        }
                                                        className={`form-control${adminErrors.password ? " is-invalid" : ""}`}
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
                                                {adminErrors.password && (
                                                    <div className="invalid-feedback d-block">
                                                        {adminErrors.password}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mb-4">
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
                                                            adminData.confirmPassword
                                                        }
                                                        onChange={
                                                            handleAdminChange
                                                        }
                                                        className={`form-control${adminErrors.confirmPassword ? " is-invalid" : ""}`}
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
                                                {adminErrors.confirmPassword && (
                                                    <div className="invalid-feedback d-block">
                                                        {
                                                            adminErrors.confirmPassword
                                                        }
                                                    </div>
                                                )}
                                            </div>

                                            <div className="d-flex gap-2">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary w-50"
                                                    onClick={handleBack}
                                                >
                                                    Back
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={loading}
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
                                            to="/login"
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

export default RegisterClient;
