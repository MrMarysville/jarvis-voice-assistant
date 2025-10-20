import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  CheckSquare,
  DollarSign,
  TrendingUp,
  Calendar,
  MessageSquare,
  LogOut,
  Receipt,
} from "lucide-react";
import { VoiceAssistantSimple } from "@/components/VoiceAssistantSimple";
import { NotificationsPanel } from "@/components/NotificationsPanel";
import { GlobalSearch } from "@/components/GlobalSearch";
import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();
  useKeyboardShortcuts(); // Enable global keyboard shortcuts
  const { user, logout } = useAuth();
  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      logout();
    },
  });

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Quotes", href: "/quotes", icon: FileText },
    { name: "Invoices", href: "/invoices", icon: Receipt },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Products", href: "/products", icon: Package },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "Payments", href: "/payments", icon: DollarSign },
    { name: "Expenses", href: "/expenses", icon: TrendingUp },
    { name: "Messages", href: "/messages", icon: MessageSquare },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return location === "/";
    }
    return location.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - Icons Only */}
      <aside className="fixed inset-y-0 left-0 z-50 w-16 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Logo */}
        <div className="flex items-center justify-center h-16 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <span className="text-sidebar-primary-foreground font-bold text-sm">J</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Tooltip key={item.name} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link href={item.href}>
                    <div
                      className={`mx-2 flex items-center justify-center h-10 w-10 rounded-lg transition-colors cursor-pointer ${
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.name}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* User actions */}
        <div className="p-2 border-t border-sidebar-border space-y-2">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="flex justify-center">
                <VoiceAssistantSimple />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Voice Assistant (AI)</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 mx-auto"
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Logout</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      {/* Main content with better padding */}
      <div className="pl-16">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-16 items-center gap-4 px-8">
            {/* Global Search */}
            <div className="flex-1 max-w-xl">
              <GlobalSearch />
            </div>
            
            {/* Right side actions */}
            <div className="flex items-center gap-2">
              <VoiceAssistantSimple />
              <NotificationsPanel />
            </div>
          </div>
        </header>

        <main className="min-h-screen p-8">{children}</main>
      </div>
    </div>
  );
}

