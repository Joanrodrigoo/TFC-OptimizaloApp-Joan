
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CampaignsTable from "@/components/dashboard/CampaignsTable";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { GoogleAdsAccount } from "@/types";

// Mock accounts data
const mockAccounts: GoogleAdsAccount[] = [
  {
    id: "1",
    accountId: "123-456-7890",
    accountName: "Main Agency Account",
    connected: true,
    userId: "user-1",
    refreshToken: "mock-token-1",
    createdAt: new Date().toISOString(),
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: "2",
    accountId: "234-567-8901",
    accountName: "Client: Fashion Outlet",
    connected: true,
    userId: "user-1",
    refreshToken: "mock-token-2",
    createdAt: new Date().toISOString(),
    lastSyncedAt: null,
  },
];

const CampaignsPage = () => {
  const [selectedAccount, setSelectedAccount] = useState<string>(mockAccounts[0]?.id || "");
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsRefreshing(false);
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold mb-2">Campaigns</h1>
        <p className="text-muted-foreground mb-6">
          View and manage your Google Ads campaigns across all connected accounts.
        </p>
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div className="w-full md:w-72">
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Accounts</SelectItem>
                {mockAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? "Refreshing..." : "Refresh Data"}
          </Button>
        </div>
        
        <CampaignsTable accountId={selectedAccount || undefined} />
      </div>
    </DashboardLayout>
  );
};

export default CampaignsPage;
