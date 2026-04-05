import Login from './components/Login'
import Dashboard from './components/Dashboard'
import { Route, Routes, Navigate } from 'react-router-dom'
import ProtectedRoute from './routes/ProtectedRoute'

function App() {

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
    )
}

export default App
