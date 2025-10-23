
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Campaign } from "@/types";
import { formatCurrency } from "@/lib/utils";

// Mock data
const mockCampaigns: Campaign[] = [
  {
    id: "1",
    accountId: "1",
    campaignId: "10001",
    name: "Summer Sale 2023",
    status: "ENABLED",
    budget: 1500,
    startDate: "2023-06-01",
    endDate: "2023-08-31",
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: "2",
    accountId: "1", 
    campaignId: "10002",
    name: "Brand Awareness",
    status: "ENABLED",
    budget: 2500,
    startDate: "2023-01-01",
    endDate: null,
    lastSyncedAt: new Date().toISOString(),
  },
  {
    id: "3",
    accountId: "1",
    campaignId: "10003",
    name: "Holiday Special",
    status: "PAUSED",
    budget: 3000,
    startDate: "2023-11-15",
    endDate: "2024-01-15",
    lastSyncedAt: new Date().toISOString(),
  },
];

// Mock metrics for campaigns
const mockMetricsMap = {
  "1": { impressions: 12500, clicks: 750, cost: 1250.50, conversions: 25 },
  "2": { impressions: 45000, clicks: 1200, cost: 2100.75, conversions: 40 },
  "3": { impressions: 8000, clicks: 320, cost: 950.25, conversions: 12 },
};

// Mock AI feedback
const mockAiFeedbackMap = {
  "1": { 
    feedback: "This campaign is performing well, but there's room for optimization in the ad copy.",
    recommendations: [
      "Consider adding more specific call-to-actions in your ads",
      "Test different headlines to improve click-through rate",
      "Adjust bidding strategy to focus on conversions"
    ]
  },
  "2": { 
    feedback: "Your brand awareness campaign has good reach but low engagement.",
    recommendations: [
      "Refine your audience targeting to reach more relevant users",
      "Increase bid for placements that have shown better performance",
      "Consider creating video ads to increase engagement"
    ]
  },
  "3": { 
    feedback: "This seasonal campaign needs attention before the holiday season.",
    recommendations: [
      "Review your keywords and remove underperforming ones",
      "Allocate more budget to top-performing ad groups",
      "Create holiday-specific landing pages to improve conversion rates"
    ]
  },
};

interface CampaignsTableProps {
  accountId?: string;
}

const CampaignsTable = ({ accountId }: CampaignsTableProps) => {
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  
  // Filter campaigns by accountId if provided
  const campaigns = accountId 
    ? mockCampaigns.filter(c => c.accountId === accountId) 
    : mockCampaigns;
  
  const toggleExpand = (campaignId: string) => {
    setExpandedCampaign(expandedCampaign === campaignId ? null : campaignId);
  };

  const getCampaignStatusBadge = (status: Campaign["status"]) => {
    switch (status) {
      case "ENABLED":
        return <Badge className="bg-green-500">Active</Badge>;
      case "PAUSED":
        return <Badge variant="outline">Paused</Badge>;
      case "REMOVED":
        return <Badge variant="destructive">Removed</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Budget</TableHead>
            <TableHead>Impressions</TableHead>
            <TableHead>Clicks</TableHead>
            <TableHead>Cost</TableHead>
            <TableHead>Conv.</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => {
            const metrics = mockMetricsMap[campaign.id];
            
            return (
              <>
                <TableRow key={campaign.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{campaign.name}</TableCell>
                  <TableCell>{getCampaignStatusBadge(campaign.status)}</TableCell>
                  <TableCell>{formatCurrency(campaign.budget)}/day</TableCell>
                  <TableCell>{metrics?.impressions.toLocaleString()}</TableCell>
                  <TableCell>{metrics?.clicks.toLocaleString()}</TableCell>
                  <TableCell>{formatCurrency(metrics?.cost)}</TableCell>
                  <TableCell>{metrics?.conversions}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Campaign Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toggleExpand(campaign.id)}>
                          {expandedCampaign === campaign.id ? "Hide AI Feedback" : "Show AI Feedback"}
                        </DropdownMenuItem>
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit Campaign</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                {expandedCampaign === campaign.id && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-muted/30">
                      <div className="p-4 space-y-4">
                        <div>
                          <h4 className="font-medium text-adops-800">AI Feedback</h4>
                          <p className="text-sm mt-1">
                            {mockAiFeedbackMap[campaign.id]?.feedback || "No feedback available"}
                          </p>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-adops-800">Recommendations</h4>
                          <ul className="list-disc pl-5 text-sm mt-1 space-y-1">
                            {mockAiFeedbackMap[campaign.id]?.recommendations.map((rec, i) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                        
                        <div className="flex justify-end">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-adops-600"
                            onClick={() => toggleExpand(campaign.id)}
                          >
                            Close
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
          
          {campaigns.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-6">
                <p className="text-muted-foreground">No campaigns found</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default CampaignsTable;
