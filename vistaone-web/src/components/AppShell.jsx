import TopBar from './TopBar'
import '../styles/appShell.css'
import Sidebar from './Sidebar'
import { sidebarNav } from '../data/dashboardData'
import LoadingOverlay from './LoadingOverlay';


function AppShell({ title, subtitle, eyebrow = 'Welcome back', controls, children, loading = false, loadingText = 'Loading...' }) {
  return (
    <div className="app-shell-page">
      <div className="app-shell-layout">
        <Sidebar navData={sidebarNav} />

        <section className="app-shell-main">
          <TopBar title={title} subtitle={subtitle} eyebrow={eyebrow} controls={controls} />
          <div className="app-shell-content" style={{ position: 'relative' }}>
            <LoadingOverlay show={loading} text={loadingText} />
            {children}
          </div>
        </section>
      </div>
    </div>
  )
}

export default AppShell
