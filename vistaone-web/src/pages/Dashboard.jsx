import AppShell from '../components/AppShell'

const Dashboard = () => {
    return (
        <AppShell
            title="Dashboard"
            subtitle="Operator summary for vendors, work orders, and risk insights"
            eyebrow="Welcome back"
        >
            <div className="p-3 rounded-3 border bg-white">
                <h2 className="h5 mb-2">Overview</h2>
                <p className="text-secondary mb-0">Dashboard widgets will be added here.</p>
            </div>
        </AppShell>
    )
}

export default Dashboard
