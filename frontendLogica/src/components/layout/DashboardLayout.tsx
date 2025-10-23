
import { ReactNode, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden md:block w-64 border-r" />
      
      <div className="flex flex-col flex-1 w-full min-w-0">
        {/* Mobile Header with Menu Button */}
        <div className="flex md:hidden items-center justify-between p-4 border-b" style={{ backgroundColor: '#12BAA9' }}>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="bg-white hover:bg-gray-50 text-gray-900 border-white">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64">
              <Sidebar className="border-0" />
            </SheetContent>
          </Sheet>
          
          {/* Logo */}
          <div className="text-lg font-bold text-white">
            AdOptimizer
          </div>
        </div>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;