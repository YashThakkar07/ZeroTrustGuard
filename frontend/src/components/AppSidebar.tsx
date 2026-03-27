import { useNavigate, useLocation } from "react-router-dom";
import {
  Shield,
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Upload,
  UserPlus,
  ShieldCheck
} from "lucide-react";
import { useState, useEffect } from "react";

export function AppSidebar() {

  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const storedRole = localStorage.getItem("ztg_role");
    setRole(storedRole);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("ztg_token");
    localStorage.removeItem("ztg_role");
    navigate("/login");
  };

  const navItems =
    role === "admin" || role === "super_admin"
      ? [
          { title: "SOC Dashboard", path: "/soc", icon: AlertTriangle },
          { title: "Web Security", path: "/web-security", icon: ShieldCheck },
          { title: "Activity Logs", path: "/soc", icon: Activity },
          { title: "User Management", path: "/soc/users", icon: Users },

          // NEW OPTION
          { title: "Add User", path: "/add-user", icon: UserPlus },
          { title: "File Management", path: "/files", icon: Upload },
          { title: "Approvals", path: "/approvals", icon: ShieldCheck },
          { title: "MFA Setup", path: "/mfa-setup", icon: Shield },
        ]
      : [
          { title: "Employee Dashboard", path: "/dashboard", icon: LayoutDashboard },
          { title: "Upload File", path: "/employee-upload", icon: Upload },
          ...(role === "staff" || role === "senior" ? [{ title: "Approvals", path: "/approvals", icon: ShieldCheck }] : []),
          { title: "MFA Setup", path: "/mfa-setup", icon: Shield }
        ];

  return (
    <aside
      className={`${
        collapsed ? "w-16" : "w-64"
      } min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300`}
    >

      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary-foreground" />
        </div>

        {!collapsed && (
          <div>
            <h1 className="text-sm font-bold">ZeroTrustGuard</h1>
            <p className="text-[10px] text-muted-foreground">
              Threat Protection
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {

          const isActive = location.pathname === item.path;

          return (
            <button
              key={item.title}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-sidebar-accent"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {!collapsed && <span>{item.title}</span>}
            </button>
          );

        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t">

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm hover:bg-destructive/10 text-destructive"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Logout</span>}
        </button>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex justify-center py-2"
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>

      </div>

    </aside>
  );
}