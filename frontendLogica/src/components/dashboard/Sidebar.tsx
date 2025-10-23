import { cn } from "@/lib/utils";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, Database, Search, Settings, PlusCircle, Building, Users, HelpCircle, LogOut } from "lucide-react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { GoogleAdsAccount } from "@/types";
import { useAuth } from "@/hooks/useAuth";

const Sidebar = ({ className }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [accounts, setAccounts] = useState<GoogleAdsAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { logout } = useAuth();
  
  // Estado del usuario
  const [user, setUser] = useState<{ name: string; email: string; avatar?: string } | null>(null);

  // Fetch cuentas
  const fetchAccounts = async () => {
    try {
      const response = await fetch("https://pwi.es/api/google-accounts", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error al obtener cuentas");
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error("Error cargando cuentas:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch usuario
  const fetchUserData = async () => {
    try {
      const response = await fetch("https://pwi.es/api/auth/profile", {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Error al obtener usuario");
      const data = await response.json();
      setUser({
        name: data.name || "Sin nombre",
        email: data.email || "Sin correo",
        avatar: data.avatarUrl || "",
      });
    } catch (error) {
      console.error("Error cargando usuario:", error);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchUserData();
  }, []);

  const handleAccountChange = (accountId: string) => {
    setSelectedAccount(accountId);
    navigate(`/dashboard/accounts/${accountId}`);
  };

  const handleLogout = () => {
    console.log("Logging out...");
    logout();
    navigate("/login");
  };

  // Organización de cuentas como en el archivo funcional
  const mainAccounts = accounts.filter(
    (a) => a.accountType === "STANDARD" && !a.parentAccountId
  );
  const mccAccounts = accounts.filter((a) => a.accountType === "MCC");
  const getSubAccounts = (mccId: string) =>
    accounts.filter((a) => a.parentAccountId === mccId);

  // Check if we're on an account detail page
  const isAccountDetailPage = location.pathname.startsWith('/dashboard/accounts/') && location.pathname.split('/').length === 4;

  // Function to scroll to section
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className={cn("pb-0 bg-slate-800 text-white h-screen sticky top-0 overflow-y-auto w-64", className)}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="px-4 py-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
              <Building className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">AdOps AI</h1>
            </div>
          </div>
        </div>

        {/* Account Selector */}
        <div className="px-4 py-4 border-b border-slate-700">
          <Select value={selectedAccount} onValueChange={handleAccountChange} disabled={loading}>
            <SelectTrigger className="w-full bg-slate-700 border-slate-600 text-white">
              <SelectValue placeholder={loading ? "Cargando..." : "Seleccionar cuenta"} />
            </SelectTrigger>
            <SelectContent className="bg-slate-700 border-slate-600">
              {mainAccounts.map((account) => (
                <SelectItem 
                  key={account.id}
                  value={account.id}
                  className="text-white hover:bg-slate-600 focus:bg-slate-600"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{account.accountName}</span>
                    <span className="text-xs text-slate-400">{account.accountId}</span>
                  </div>
                </SelectItem>
              ))}
              
              {mccAccounts.map((mccAccount) => {
                const subAccounts = getSubAccounts(mccAccount.accountId);
                return (
                  <div key={mccAccount.id}>
                    <SelectItem 
                      value={mccAccount.id}
                      className="text-white hover:bg-slate-600 focus:bg-slate-600"
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <Building className="w-3 h-3 text-teal-400" />
                          <span className="font-medium">{mccAccount.accountName}</span>
                        </div>
                        <span className="text-xs text-slate-400">{mccAccount.accountId}</span>
                      </div>
                    </SelectItem>
                    {subAccounts.map((subAccount) => (
                      <SelectItem 
                        key={subAccount.id}
                        value={subAccount.id}
                        className="text-white hover:bg-slate-600 focus:bg-slate-600 pl-6"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm truncate" title={`└ ${subAccount.accountName}`}>
                            └ {subAccount.accountName}
                          </span>
                          <span className="text-xs text-slate-400 truncate" title={subAccount.accountId}>
                            {subAccount.accountId}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                );
              })}
              
              {!loading && accounts.length === 0 && (
                <div className="p-3 text-center text-slate-400 text-sm">
                  No hay cuentas conectadas
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Navigation */}
        <div className="flex-1 py-4">
          {/* Dashboard Section */}
          <div className="px-4 mb-6">
            <h2 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
              Dashboard
            </h2>
            <div className="space-y-1">
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-white hover:bg-teal-500 hover:text-white",
                  location.pathname === "/dashboard" && "bg-teal-500 text-white"
                )}
                asChild
              >
                <Link to="/dashboard">
                  <Home className="mr-3 h-4 w-4" />
                  Overview
                </Link>
              </Button>
              
              {/* Separador debajo de Overview */}
              <div className="my-3 border-t border-slate-700"></div>
              
              {/* Account Navigation Icons - Only show when on account detail page */}
              {isAccountDetailPage && (
                <>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-slate-700 text-sm"
                    onClick={() => scrollToSection('recommendations')}
                  >
                    <Search className="mr-3 h-4 w-4" />
                    Recomendaciones
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-slate-700 text-sm"
                    onClick={() => scrollToSection('campaigns')}
                  >
                    <Database className="mr-3 h-4 w-4" />
                    Campañas
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-slate-700 text-sm"
                    onClick={() => scrollToSection('keywords')}
                  >
                    <Settings className="mr-3 h-4 w-4" />
                    Keywords
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-slate-700 text-sm"
                    onClick={() => scrollToSection('search-terms')}
                  >
                    <Search className="mr-3 h-4 w-4" />
                    Términos de Búsqueda
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-white hover:bg-slate-700 text-sm"
                    onClick={() => scrollToSection('audiences')}
                  >
                    <Users className="mr-3 h-4 w-4" />
                    Audiencias
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Add Account Button */}
        <div className="px-4 pb-4">
          <Button
            className="w-full bg-teal-500 hover:bg-teal-600 text-white font-medium"
            onClick={() => {
              window.location.href = "https://pwi.es/auth";
            }}
          >
            <PlusCircle className="mr-3 h-4 w-4" />
            Añadir Cuenta
          </Button>
        </div>
        
        {/* User Profile with Dropdown */}
        <div className="px-4 py-4 border-t border-slate-700">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full p-0 h-auto justify-start hover:bg-slate-700">
                <div className="flex items-center gap-3 p-3 w-full">
                  <Avatar className="w-10 h-10">
                    {user?.avatar ? (
                      <AvatarImage src={user.avatar} />
                    ) : (
                      <AvatarFallback className="bg-teal-500 text-white font-medium">
                        {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-white truncate">
                      {user?.name || "Cargando..."}
                    </p>
                    <p className="text-xs text-slate-400 truncate">
                      {user?.email || ""}
                    </p>
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-slate-700 border-slate-600">
              <DropdownMenuItem 
                className="text-white hover:bg-slate-600 focus:bg-slate-600"
                asChild
              >
                <Link to="/dashboard/settings">
                  <Settings className="mr-3 h-4 w-4" />
                  Configuración
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-white hover:bg-slate-600 focus:bg-slate-600">
                <HelpCircle className="mr-3 h-4 w-4" />
                Ayuda
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-600" />
              <DropdownMenuItem 
                className="text-white hover:bg-slate-600 focus:bg-slate-600"
                onClick={handleLogout}
              >
                <LogOut className="mr-3 h-4 w-4" />
                Salir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;