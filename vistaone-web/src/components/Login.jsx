import { useState } from 'react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Fuel } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import '../styles/login.css'

const Login = () => {
    const navigate = useNavigate()
    const { login, isLoading, error, clearError } = useAuth()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [formError, setFormError] = useState('')

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!email.trim() || !password.trim()) {
            setFormError('Please enter your email and password.')
            return
        }

        setFormError('')
        clearError()

        const result = await login({ email, password })

        if (result) {
            navigate('/dashboard', { replace: true })
        }
    }

    return (
        <div className="login-page position-relative overflow-hidden">

            <div className="container-fluid position-relative">
                <div className="row min-vh-100 g-0">
                    <section className="col-lg-7 d-flex flex-column justify-content-between px-4 px-lg-5 py-4 py-lg-5 login-hero">
                        <div>
                            <div className="login-badge d-inline-flex align-items-center gap-3 rounded-pill px-3 py-2">
                                <div className="login-badge-icon d-inline-flex align-items-center justify-content-center rounded-3">
                                    <Fuel size={18} />
                                </div>
                                <div>
                                    <p className="login-badge-overline mb-1 text-uppercase">Client Platform</p>
                                    <p className="mb-0 fw-semibold">Client Command Center</p>
                                </div>
                            </div>

                            <div className="mt-5 pt-lg-4">
                                <p className="login-hero-overline mb-3 text-uppercase fw-semibold">Operations visibility</p>
                                <h1 className="login-hero-title fw-semibold mb-4">
                                    Sign in to monitor vendors, fraud risk, and service delivery.
                                </h1>
                                <p className="login-hero-text mb-0">
                                    Access the client control surface for vendor approval, compliance monitoring, invoice review, and anomaly analytics.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="col-lg-5 d-flex align-items-center justify-content-center px-4 px-lg-5 py-5">
                        <div className="login-panel w-100 shadow-lg">
                            <div className="mb-4">
                                <p className="login-panel-overline mb-2 text-uppercase">Secure access</p>
                                <h2 className="mb-2">Welcome back</h2>
                                <p className="login-panel-text">
                                    Sign in with your client operator account to continue to the dashboard.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit}>
                                <div className="mb-4">
                                    <label className="form-label login-label">Work email</label>
                                    <div className="input-group login-input-group">
                                        <span className="input-group-text">
                                            <Mail size={18} />
                                        </span>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(event) => {
                                                setEmail(event.target.value)
                                                if (formError) {
                                                    setFormError('')
                                                }
                                            }}
                                            className="form-control"
                                            placeholder="name@company.com"
                                        />
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label login-label">Password</label>
                                    <div className="input-group login-input-group">
                                        <span className="input-group-text">
                                            <LockKeyhole size={18} />
                                        </span>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(event) => {
                                                setPassword(event.target.value)
                                                if (formError) {
                                                    setFormError('')
                                                }
                                            }}
                                            className="form-control"
                                            placeholder="Enter password"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((prev) => !prev)}
                                            className="btn"
                                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="small mb-4">
                                    <button type="button" className="btn btn-link p-0">
                                        Forgot password?
                                    </button>
                                </div>

                                {(formError || error) && (
                                    <div className="alert alert-danger mb-4" role="alert">
                                        {formError || error}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn login-submit-btn w-100 d-inline-flex align-items-center justify-content-center gap-2"
                                    disabled={isLoading}
                                >
                                    Enter dashboard
                                    <ArrowRight size={16} />
                                </button>
                            </form>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}

export default Login