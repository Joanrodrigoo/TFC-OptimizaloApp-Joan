
import { cn } from "@/lib/utils";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Database, Search, Settings, PlusCircle } from "lucide-react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

const Sidebar = ({ className }: SidebarProps) => {
  const location = useLocation();
  
  return (
    <div className={cn("pb-12 bg-sidebar text-sidebar-foreground h-screen", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Dashboard
          </h2>
          <div className="space-y-1">
            <Button
              variant={location.pathname === "/dashboard" ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link to="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                Overview
              </Link>
            </Button>
            <Button
              variant={location.pathname === "/dashboard/campaigns" ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link to="/dashboard/campaigns">
                <Database className="mr-2 h-4 w-4" />
                Campaigns
              </Link>
            </Button>
            <Button
              variant={location.pathname === "/dashboard/analytics" ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link to="/dashboard/analytics">
                <Search className="mr-2 h-4 w-4" />
                Analytics
              </Link>
            </Button>
          </div>
        </div>
        
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Google Ads
          </h2>
          <div className="space-y-1">
            <Button
              variant={location.pathname === "/dashboard/accounts" ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link to="/dashboard/accounts">
                <Database className="mr-2 h-4 w-4" />
                Connected Accounts
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Connect New Account
            </Button>
          </div>
        </div>
        
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            Settings
          </h2>
          <div className="space-y-1">
            <Button
              variant={location.pathname === "/dashboard/settings" ? "secondary" : "ghost"}
              className="w-full justify-start"
              asChild
            >
              <Link to="/dashboard/settings">
                <Settings className="mr-2 h-4 w-4" />
                Account Settings
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
