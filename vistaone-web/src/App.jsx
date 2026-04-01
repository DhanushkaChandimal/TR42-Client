import Login from './components/Login'
import Dashboard from './components/Dashboard'
import WorkOrder from './components/WorkOrder'
import { Route, Routes, Navigate } from 'react-router-dom'

function App() {

    return (
        <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login/*" element={<Login />} />
            <Route path="/dashboard/*" element={<Dashboard />} />
            <Route path="/workorder/*" element={<WorkOrder />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
    )
}

export default App
