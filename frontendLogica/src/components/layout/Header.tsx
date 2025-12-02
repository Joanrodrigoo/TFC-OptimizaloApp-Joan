import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { useState } from "react";
import logoDark from "@/assets/logo-dark.png";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="container flex items-center justify-between h-14 sm:h-16 pl-2 pr-4 sm:pl-4 sm:pr-6 lg:pl-4 lg:pr-8">
        <div className="flex items-center gap-4 sm:gap-6">
          <Link to="/">
            <img src={logoDark} alt="optimizalo.app" className="h-7 sm:h-8" />
          </Link>
          <Link 
            to="/pricing" 
            className="hidden sm:block text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Precios
          </Link>
        </div>
        <nav className="hidden sm:flex items-center gap-4 md:gap-6">
          <Link 
            to="/login" 
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link to="/register">
            <Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg hover:shadow-xl transition-all px-4 md:px-6 py-4 md:py-5 text-sm md:text-base font-bold">
              Empieza ahora
            </Button>
          </Link>
        </nav>
        <div className="sm:hidden flex items-center gap-2">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[250px]">
              <nav className="flex flex-col gap-4 mt-8">
                <Link 
                  to="/pricing" 
                  className="text-base font-medium hover:text-primary transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Precios
                </Link>
                <Link 
                  to="/login" 
                  className="text-base font-medium hover:text-primary transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Iniciar sesión
                </Link>
              </nav>
            </SheetContent>
          </Sheet>
          <Link to="/register">
            <Button size="sm" className="shadow-md font-bold text-xs px-3 py-2 h-auto">Empieza ahora</Button>
          </Link>
        </div>
      </div>
    </header>
  );
};