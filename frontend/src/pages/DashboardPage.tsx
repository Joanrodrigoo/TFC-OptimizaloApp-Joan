
import DashboardLayout from "@/components/layout/DashboardLayout";
import MetricsOverview from "@/components/dashboard/MetricsOverview";
import AccountsOverview from "@/components/dashboard/AccountsOverview";
import CampaignsTable from "@/components/dashboard/CampaignsTable";

const DashboardPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
          <MetricsOverview />
        </div>
        
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">Google Ads Accounts</h2>
          <AccountsOverview />
        </div>
        
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Recent Campaigns</h2>
          <CampaignsTable />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;
