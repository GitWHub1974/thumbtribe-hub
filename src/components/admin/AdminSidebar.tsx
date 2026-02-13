import { NavLink } from "react-router-dom";
import { LayoutDashboard, FolderKanban, Users, Settings, LogOut, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import logoWhite from "@/assets/logo_white.png";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", to: "/admin" },
  { icon: FolderKanban, label: "Projects", to: "/admin/projects" },
  { icon: Users, label: "Clients", to: "/admin/clients" },
  { icon: Settings, label: "Jira Settings", to: "/admin/jira-settings" },
];

const AdminSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useAuth();

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 sticky top-0",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
        <div className="w-20 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0 overflow-hidden">
          <img src={logoWhite} alt="Logo" className="w-16 h-5 object-contain" />
        </div>
        {!collapsed && (
          <span className="font-heading font-bold text-lg text-sidebar-accent-foreground tracking-tight">
            Admin
          </span>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/admin"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="py-4 px-3 space-y-1 border-t border-sidebar-border">
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <ChevronLeft className={cn("w-5 h-5 shrink-0 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
