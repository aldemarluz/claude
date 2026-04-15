import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import BillingBanner from "./BillingBanner";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  TrendingUp,
  Briefcase,
  Wifi,
  LogOut,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { getWorkspaceId } from "@/lib/workspace";

const navGroups = [
  {
    label: "Principal",
    items: [
      { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    ],
  },
  {
    label: "CRM",
    items: [
      { path: "/pipeline", icon: Users, label: "Pipeline" },
      { path: "/contacts", icon: UserCircle, label: "Contatos" },
      { path: "/proposals", icon: Briefcase, label: "Propostas" },
    ],
  },
  {
    label: "Comunicação",
    items: [
      { path: "/unified-inbox", icon: MessageSquare, label: "Inbox Unificado", showUnreadBadge: true },
      { path: "/whatsapp-channels", icon: Wifi, label: "Canais WhatsApp" },
      { path: "/marketing", icon: TrendingUp, label: "Marketing" },
      { path: "/automations", icon: Zap, label: "Automações" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { path: "/settings", icon: Settings, label: "Configurações" },
    ],
  },
];

const getInitials = (nameOrEmail) => {
  if (!nameOrEmail) return "U";
  const source = String(nameOrEmail).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Load the unread-conversation count from Base44 once. This replaces the
  // hardcoded "3" badge. Consumers that mark conversations as read should
  // refresh via a shared store in a future iteration.
  useEffect(() => {
    let cancelled = false;
    async function loadUnread() {
      try {
        const accountId = await getWorkspaceId();
        if (!accountId) return;
        const convs = await base44.entities.WhatsAppConversation.filter(
          { workspace_id: accountId },
          "-atualizado_em",
          200
        );
        if (cancelled) return;
        setUnreadCount((convs || []).filter((c) => c.nao_lido).length);
      } catch (err) {
        console.error("Failed to load unread count:", err);
      }
    }
    loadUnread();
    return () => { cancelled = true; };
  }, []);

  const displayName = user?.full_name || user?.email || "Conta";
  const initials = getInitials(user?.full_name || user?.email);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          collapsed ? "w-[72px]" : "w-[240px]"
        } bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300 shrink-0`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">C</span>
              </div>
              <span className="text-sidebar-foreground font-semibold text-lg tracking-tight">
                CRMFlow
              </span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
              <span className="text-primary-foreground font-bold text-sm">C</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto" aria-label="Navegação principal">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="text-xs font-semibold text-sidebar-foreground/30 uppercase tracking-widest px-3 mb-1">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.path === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.path);
                  const showBadge = item.showUnreadBadge && unreadCount > 0;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <item.icon className={`w-5 h-5 shrink-0 ${isActive ? "text-sidebar-primary" : ""}`} />
                      {!collapsed && (
                        <span className="text-sm font-medium truncate">{item.label}</span>
                      )}
                      {!collapsed && showBadge && (
                        <Badge className="ml-auto bg-primary/20 text-primary border-0 text-xs px-1.5">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse */}
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                  aria-label="Menu do usuário"
                >
                  <span className="text-primary text-sm font-semibold">{initials}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium truncate">{displayName}</p>
                    {user?.email && (
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="w-4 h-4 mr-2" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => logout?.()}>
                  <LogOut className="w-4 h-4 mr-2" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Billing Banner */}
        <BillingBanner />
        {/* Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
