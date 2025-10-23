import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthProvider";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import AdminProtectedRoute from "@/components/auth/AdminProtectedRoute";

// Pages
import LandingPage from "@/components/landing/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import AccountsPage from "@/pages/AccountsPage";
import AccountDetailPage from "@/pages/AccountDetailPage";
import CampaignsPage from "@/pages/CampaignsPage";
import NotFound from "@/pages/NotFound";
import UserSettingsPage from "./pages/UserSettingsPage";
import SubscribePage from "./pages/SubscribePage";
import SubscriptionSuccess from "@/pages/SubscriptionSuccess";
import SubscriptionCanceled from "@/pages/SubscriptionCanceled";

import ForgotPasswordPage from "@/pages/ForgotPasswordPage"; 
import AdminView from "@/pages/AdminView";

const queryClient = new QueryClient();

const App = () => (
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* Password Reset Routes */}
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ForgotPasswordPage />} />

            {/* Admin Routes - SEPARADAS con su propio protector */}
            <Route element={<AdminProtectedRoute />}>
              <Route path="/admin" element={<AdminView />} />
            </Route>

            {/* User Protected Routes - SIN redirección de admin */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/accounts" element={<AccountsPage />} />
              <Route path="/dashboard/accounts/:accountId" element={<AccountDetailPage />} />
              <Route path="/dashboard/campaigns" element={<CampaignsPage />} />
              <Route path="/dashboard/settings" element={<UserSettingsPage />} />
              <Route path="/subscribe" element={<SubscribePage />} />
              <Route path="/subscription/success" element={<SubscriptionSuccess />} />
              <Route path="/subscription/canceled" element={<SubscriptionCanceled />} />
            </Route>

            {/* Fallback Routes */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProvider>
);

export default App;