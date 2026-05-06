import TopBar from "./TopBar";
import "../styles/appShell.css";
import SideBar from "./SideBar";
import { sidebarNav } from "../data/dashboardData";
import LoadingOverlay from "./LoadingOverlay";
import { useAuthContext } from "../context/AuthContext";
import { usePendingApprovalCount } from "../hooks/usePendingApprovalCount";

function AppShell({
    title,
    subtitle,
    eyebrow = "Welcome back",
    controls,
    children,
    loading = false,
    loadingText = "Loading...",
}) {
    const { isMaster, isAdmin, user, hasPermission } = useAuthContext();
    const pendingApprovalCount = usePendingApprovalCount();

    const adminSection = [];
    if (isAdmin) {
        adminSection.push({
            to: "/admin/users",
            label: "User Management",
            icon: "users",
        });
    }
    if (isMaster) {
        adminSection.push({
            to: "/admin/roles",
            label: "Role Management",
            icon: "shield",
        });
    }

    const filterNav = (items) =>
        items.filter((item) => !item.permission || hasPermission(item.permission, "read"));

    const decorate = (item) => {
        if (item.to === "/tickets" && pendingApprovalCount > 0) {
            return { ...item, badge: pendingApprovalCount };
        }
        return item;
    };

    const navData = {
        main: filterNav(sidebarNav.main).map(decorate),
        account: filterNav(sidebarNav.account),
        admin: adminSection,
        userName: user ? `${user.first_name} ${user.last_name}` : "User",
        userRole: user?.roles?.[0] ?? "",
        clientName: user?.client_name ?? "",
    };

    return (
        <div className="app-shell-page">
            <div className="app-shell-layout">
                <SideBar navData={navData} />

                <section className="app-shell-main">
                    <TopBar
                        title={title}
                        subtitle={subtitle}
                        eyebrow={eyebrow}
                        controls={controls}
                    />
                    <div
                        className="app-shell-content"
                        style={{ position: "relative" }}
                    >
                        <LoadingOverlay show={loading} text={loadingText} />
                        {children}
                    </div>
                </section>
            </div>
        </div>
    );
}

export default AppShell;
