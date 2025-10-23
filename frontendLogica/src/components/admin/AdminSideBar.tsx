import React, { useState } from 'react';
import { Home, Users, BarChart3, Settings, Shield, Database, Bell, Activity, UserCheck, FileText, HelpCircle, LogOut, ChevronLeft, ChevronRight ,Notebook} from 'lucide-react';
import { useNavigate } from 'react-router-dom';


const cn = (...classes) => classes.filter(Boolean).join(' ');

const AdminSidebar = ({ className = "" , userName, userMail, initials}) => {
    const sidebarName = userName;
    const sidebarMail = userMail;
    const sidebarInitials = initials;
     const navigate = useNavigate();


  const [collapsed, setCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('/admin/dashboard');

  const menuItems = [
    {
      title: "Dashboard",
      items: [
        { icon: Home, label: "Overview", path: "/admin/dashboard" },
        { icon: Notebook, label: "Cliente", path: "/dashboard" },
      ]
    },
    {
      title: "Gestión de Usuarios",
      items: [
        { icon: Users, label: "Todos los usuarios", path: "/admin/users" },
        { icon: UserCheck, label: "Usuarios activos", path: "/admin/users/active" },
      ]
    }
  ];

  const bottomItems = [
    { icon: Settings, label: "Configuración", path: "/admin/settings" },
    { icon: HelpCircle, label: "Ayuda", path: "/admin/help" },
    { icon: LogOut, label: "Salir", path: "/logout" },
  ];

  return (
    <div className={cn(
      "bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white h-screen sticky top-0 overflow-y-auto hidden md:block transition-all duration-300 border-r border-slate-700/50",
      collapsed ? "w-16" : "w-64",
      className
    )}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            {!collapsed && (
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-adops-400 to-adops-600 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">Admin Panel</h1>
                  <p className="text-xs text-slate-400">Gestión del sistema</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors duration-200"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex-1 py-4 space-y-6">
          {menuItems.map((section, sectionIndex) => (
            <div key={sectionIndex} className="px-3">
              {!collapsed && (
                <h2 className="mb-3 px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {section.title}
                </h2>
              )}
              <div className="space-y-1">
                {section.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  const isActive = activeItem === item.path;
                  
                  return (
                    <button
                      key={itemIndex}
                      onClick={() => {
                        setActiveItem(item.path); 
                        navigate(item.path);
                      }}
                      className={cn(
                        "w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group relative",
                        isActive
                          ? "bg-gradient-to-r from-adops-500 to-adops-600 text-white shadow-lg shadow-adops-500/25"
                          : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                      )}
                    >
                      <Icon className={cn("h-5 w-5 flex-shrink-0", collapsed ? "mx-auto" : "mr-3")} />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      {isActive && (
                        <div className="absolute left-0 w-1 h-8 bg-white rounded-r-full"></div>
                      )}
                      
                      {/* Tooltip for collapsed state */}
                      {collapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 border border-slate-700">
                          {item.label}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Items */}
        <div className="px-3 py-4 border-t border-slate-700/50 space-y-1">
          {bottomItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeItem === item.path;
            
            return (
              <button
                key={index}
                onClick={() => setActiveItem(item.path)}
                className={cn(
                  "w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group relative",
                  isActive
                    ? "bg-gradient-to-r from-adops-500 to-adops-600 text-white shadow-lg shadow-adops-500/25"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50",
                  item.path === "/logout" && "text-red-400 hover:text-red-300 hover:bg-red-900/20"
                )}
              >
                <Icon className={cn("h-5 w-5 flex-shrink-0", collapsed ? "mx-auto" : "mr-3")} />
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
                
                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50 border border-slate-700">
                    {item.label}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* User Profile */}
        {!collapsed && (
          <div className="px-3 py-4 border-t border-slate-700/50">
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-slate-800/50">
              <div className="w-10 h-10 bg-gradient-to-r from-adops-400 to-adops-600 rounded-full flex items-center justify-center">
                <span className="text-sm font-semibold text-white">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{sidebarName}</p>
                <p className="text-xs text-slate-400 truncate">{sidebarMail}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSidebar;