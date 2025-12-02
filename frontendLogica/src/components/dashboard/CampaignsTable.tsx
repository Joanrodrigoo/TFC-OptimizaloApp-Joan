import React, { useEffect, useState } from 'react';
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

type CampaignMetrics = {
  tipo: 'SEARCH' | 'DISPLAY' | 'SHOPPING' | 'VIDEO' | 'UNSPECIFIED' | 'APP' | 'DISCOVERY' | 'LOCAL' | 'SMART' | 'PERFORMANCE_MAX' | 'TRAVEL' | 'DEMAND_GEN';
  impresiones: number;
  clics: number;
  ctr: number;
  cpa: number | null;
  cpc_medio: number | null;
  conversion_rate: number;
  conversiones: number;
  all_conversions: number;
  gasto: number;
  presupuesto: number;
  imp_lost_rank: number;
  imp_lost_budget: number;
};


type CampaignData = {
  [date: string]: CampaignMetrics;
};

type CampaignsResponse = {
  [campaignName: string]: CampaignData;
};

interface RecentCampaignsTableProps {
  customerId: string;
}

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export function CampaignsTable({ customerId }: RecentCampaignsTableProps) {
  const [campaigns, setCampaigns] = useState<CampaignsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

 useEffect(() => {
  if (!customerId) return;

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`https://optimizalo.app/api/google-ads-full-data?customerId=${customerId}`, {
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Error cargando campañas');

      const data = await res.json();
      
      // Transformar los datos a la estructura esperada
      const structured: CampaignsResponse = {};

      const today = new Date().toISOString().slice(0, 10);

      for (const c of data.campaigns || []) {
  structured[c.name] = {
    [today]: {
      tipo: c.type,
      impresiones: c.metrics.impressions || 0,
      clics: c.metrics.clicks || 0,
      ctr: c.metrics.ctr || 0,
      cpa: c.metrics.cost_per_conversion || 0,
      cpc_medio: c.metrics.average_cpc || 0,
      conversion_rate: c.metrics.conv_rate || 0,
      conversiones: c.metrics.conversions || 0,
      all_conversions: c.metrics.all_conversions || 0,
      gasto: c.metrics.cost_micros ? c.metrics.cost_micros / 1_000_000 : 0,
      presupuesto: c.budget_micros ? c.budget_micros / 1_000_000 : 0,
      imp_lost_rank: c.metrics.search_rank_lost_impression_share || 0,
      imp_lost_budget: c.metrics.search_budget_lost_impression_share || 0,
    }
  };
}


      setCampaigns(structured);
      setError(null);
    } catch (error) {
      setError(error.message || 'Error desconocido');
      setCampaigns(null);
    } finally {
      setLoading(false);
    }
  };

  fetchCampaigns();
}, [customerId]);


  const toggleExpand = (campaignName: string) => {
    setExpandedCampaign(expandedCampaign === campaignName ? null : campaignName);
  };

  const getCampaignStatusBadge = (metrics: CampaignMetrics) => {
    // Determinar el estado basado en las métricas
    if (metrics.gasto > 0 && metrics.clics > 0) {
      return <Badge className="bg-green-500">Active</Badge>;
    } else if (metrics.gasto === 0) {
      return <Badge variant="outline">Paused</Badge>;
    } else {
      return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Cargando campañas recientes...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  if (!campaigns) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">No hay campañas para mostrar</p>
      </div>
    );
  }

  // Procesar las campañas con su métrica más reciente
  const campaignEntries = Object.entries(campaigns).map(([name, dates]) => {

    const latestDate = Object.keys(dates).sort().reverse()[0];
    return { name, latestDate, metrics: dates[latestDate] };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Campaigns</h2>
      </div>

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
          {campaignEntries.map(({ name, latestDate, metrics }) => {
            if (!metrics) return null;
            return (
              <React.Fragment key={name}>

                <TableRow key={name} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{name}</TableCell>
                  <TableCell>{getCampaignStatusBadge(metrics)}</TableCell>
                  <TableCell>{metrics?.presupuesto !== undefined ? formatCurrency(metrics.presupuesto) : '0.00'}/day</TableCell>
                  <TableCell>{metrics?.impresiones !== undefined ? metrics.impresiones.toLocaleString() : '0'}</TableCell>
                  <TableCell>{metrics?.clics !== undefined ? metrics.clics.toLocaleString() : '0'}</TableCell>
                  <TableCell>{metrics?.gasto !== undefined ? formatCurrency(metrics.gasto) : '0.00'}</TableCell>
                  <TableCell>{metrics?.conversiones ?? 0}</TableCell>
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
                        <DropdownMenuItem onClick={() => toggleExpand(name)}>
                          {expandedCampaign === name ? "Hide Details" : "Show Details"}
                        </DropdownMenuItem>
                        <DropdownMenuItem>View Full Report</DropdownMenuItem>
                        <DropdownMenuItem>Edit Campaign</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                {expandedCampaign === name && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-muted/30">
                      <div className="p-4 space-y-4">
                        <div>
                          <h4 className="font-medium text-foreground">Campaign Details</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-sm">
                            <div>
                              <span className="font-medium">Campaign Type:</span>
                              <p>{metrics.tipo}</p>
                            </div>
                            <div>
                              <span className="font-medium">CTR:</span>
                              <p>{(metrics.ctr * 100).toFixed(2)}%</p>
                            </div>
                            <div>
                              <span className="font-medium">CPA:</span>
                              <p>{metrics.cpa !== null ? formatCurrency(metrics.cpa) : 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-medium">Avg CPC:</span>
                              <p>{metrics.cpc_medio !== null ? formatCurrency(metrics.cpc_medio) : 'N/A'}</p>
                            </div>
                            <div>
                              <span className="font-medium">Conversion Rate:</span>
                              <p>{(metrics.conversion_rate * 100).toFixed(2)}%</p>
                            </div>
                            <div>
                              <span className="font-medium">All Conversions:</span>
                              <p>{metrics.all_conversions}</p>
                            </div>
                            <div>
                              <span className="font-medium">Imp. Lost (Rank):</span>
                              <p>{metrics.imp_lost_rank}%</p>
                            </div>
                            <div>
                              <span className="font-medium">Imp. Lost (Budget):</span>
                              <p>{metrics.imp_lost_budget}%</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleExpand(name)}
                          >
                            Close
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}

              </React.Fragment>
            );
          })}

          {campaignEntries.length === 0 && (
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
}

export default CampaignsTable;