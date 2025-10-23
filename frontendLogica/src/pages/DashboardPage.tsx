
import DashboardLayout from "@/components/layout/DashboardLayout";
import AccountsOverview from "@/components/dashboard/AccountsOverview";


const DashboardPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        </div>
        
        <div className="space-y-6">
          <AccountsOverview />
        </div>
        
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
