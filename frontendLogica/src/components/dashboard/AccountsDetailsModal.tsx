
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GoogleAdsAccount } from "@/types";
import { ExternalLink, AlertCircle } from "lucide-react";

interface AccountDetailsModalProps {
  account: GoogleAdsAccount | null;
  isOpen: boolean;
  onClose: () => void;
  onSync: (accountId: string) => void;
}

const AccountDetailsModal = ({ account, isOpen, onClose }: AccountDetailsModalProps) => {
  if (!account) return null;
  
const mockMetrics = {
    totalCampaigns: 12,
    activeCampaigns: 8,
    totalSpend: "€4,563.78",
    clicks: "1,234",
    impressions: "45,678",
    ctr: "2.7%",
    costPerClick: "€3.70"
  };

  const mockCampaigns = [
    { name: "Summer Sale 2024", status: "Active", budget: "€500/day", performance: "Good" },
    { name: "Brand Awareness", status: "Paused", budget: "€200/day", performance: "Average" },
    { name: "Product Launch", status: "Active", budget: "€1000/day", performance: "Excellent" }
  ];



  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {account.accountName}
            <Badge variant={account.accountType === "MCC" ? "default" : "secondary"}>
              {account.accountType}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Account ID: {account.accountId}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Account Status */}
          <Card>
            <CardHeader>
              <CardTitle>
                Estado de la cuenta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium">Estado de conexión</p>
                  <Badge variant={account.connected ? "default" : "destructive"}>
                    {account.connected ? "Conectada" : "Desconectada"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium">Fecha de conexión</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(account.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Acciones</p>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Ver en Google Ads
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          {account.connected && (
            <Card>
              <CardHeader>
                <CardTitle>Métricas de rendimiento (últimos 30 días)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{mockMetrics.totalSpend}</p>
                    <p className="text-sm text-muted-foreground">Gasto total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{mockMetrics.clicks}</p>
                    <p className="text-sm text-muted-foreground">Clics</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{mockMetrics.impressions}</p>
                    <p className="text-sm text-muted-foreground">Impresiones</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{mockMetrics.ctr}</p>
                    <p className="text-sm text-muted-foreground">CTR</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaigns Overview */}
          {account.connected && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Resumen de campañas
                  <Badge variant="outline">
                    {mockMetrics.activeCampaigns} de {mockMetrics.totalCampaigns} activas
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockCampaigns.map((campaign, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium">{campaign.name}</h4>
                        <p className="text-sm text-muted-foreground">Presupuesto: {campaign.budget}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={campaign.status === "Active" ? "default" : "secondary"}
                        >
                          {campaign.status}
                        </Badge>
                        <Badge 
                          variant="outline"
                          className={
                            campaign.performance === "Excellent" ? "text-green-600 border-green-600" :
                            campaign.performance === "Good" ? "text-blue-600 border-blue-600" :
                            "text-yellow-600 border-yellow-600"
                          }
                        >
                          {campaign.performance}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Disconnected State */}
          {!account.connected && (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Cuenta desconectada</h3>
                  <p className="text-muted-foreground mb-4">
                    Esta cuenta necesita ser reconectada para mostrar datos actualizados.
                  </p>
                  <Button>Reconectar cuenta</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AccountDetailsModal;