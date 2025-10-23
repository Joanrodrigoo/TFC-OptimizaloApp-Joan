
import DashboardLayout from "@/components/layout/DashboardLayout";
import AccountsOverview from "@/components/dashboard/AccountsOverview";

const AccountsPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold mb-2">Gestión de Cuentas</h1>
        <p className="text-muted-foreground mb-6">
          Administra tus cuentas conectadas de Google Ads, tanto cuentas estándar como MCC (My Client Center).
        </p>
        
        <AccountsOverview />
      </div>
    </DashboardLayout>
  );
};

export default AccountsPage;
