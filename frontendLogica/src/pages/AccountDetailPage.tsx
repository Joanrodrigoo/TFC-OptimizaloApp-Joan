import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { subDays } from "date-fns";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Brain } from "lucide-react";
import SyncProgressBar from "@/components/account/SyncProgressBar";

import AccountMetrics from "@/components/account/AccountMetrics";
import HierarchicalCampaignsList from "@/components/account/HierarchicalCampaignsList";
import KeywordsList from "@/components/account/KeywordsList";
import SearchTermsList from "@/components/account/SearchTermsList";
import AudiencesList from "@/components/account/AudiencesList";
import RecommendationsPanel from "@/components/account/RecommendationsPanel";
import DateRangeFilter from "@/components/account/DateRangeFilter";
import { fetchGoogleAccounts } from "@/services/api";

import { useToast } from "@/components/ui/use-toast";

export interface NavigationState {
  level: "campaigns" | "adgroups" | "ads";
  selectedCampaign?: string;
  selectedAdGroup?: string;
  campaignName?: string;
  adGroupName?: string;
}

type Account = {
  id: string;
  accountId: string;
  accountName: string;
  accountType: string;
  connected: boolean;
  lastSyncedAt: string | null;
  parentAccountId?: string;
};

const AccountDetailPage = () => {
  const { accountId } = useParams();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSyncVisible, setIsSyncVisible] = useState(false);
  const [isSyncInProgress, setIsSyncInProgress] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const yesterday = subDays(new Date(), 1);

  const [dateRange, setDateRange] = useState({
    from: subDays(yesterday, 14),
    to: yesterday,
  });

  const [navigation, setNavigation] = useState<NavigationState>({
    level: "campaigns",
  });

  const [specificRecommendationFilter, setSpecificRecommendationFilter] =
    useState<{
      type: "campaign" | "adgroup" | "ad";
      id: string;
      name: string;
    } | null>(null);

  const [selectedCampaignType, setSelectedCampaignType] = useState<string | null>(null);

  useEffect(() => {
    const loadAccount = async () => {
      try {
        const accounts = await fetchGoogleAccounts();
        const found = accounts.find((acc) => acc.accountId === accountId);
        if (!found) {
          throw new Error("Cuenta no encontrada");
        }
        setAccount(found);
      } catch (err) {
        console.error(err);
        setError("Error al cargar la cuenta");
      } finally {
        setLoading(false);
      }
    };

    if (accountId) {
      loadAccount();
    }
  }, [accountId]);

  useEffect(() => {
    setNavigation({ level: "campaigns" });
    setSpecificRecommendationFilter(null);
  }, [accountId]);

  const handleSyncComplete = () => {
    console.log("✅ Sincronización completada, actualizando datos...");
    setRefreshKey((prev) => prev + 1);
    setIsSyncInProgress(false);
  };

  const handleNavigationChange = (newNavigation: NavigationState) => {
    setNavigation(newNavigation);
    setSpecificRecommendationFilter(null);
  };

  const handleSyncVisibilityChange = (visible: boolean) => {
    setIsSyncVisible(visible);
    setIsSyncInProgress(visible);
  };

  const { toast } = useToast();

  // Llamar al endpoint de análisis con IA (schedule-analysis ya existente)
  const handleAnalyzeAccount = async () => {
    if (!account || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/schedule-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ customerId: account.accountId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Empezar a hacer polling para ver cuándo acaba el análisis
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/analysis-status/${account.accountId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            
            // Si ya no está ni pending ni processing, asumimos que terminó
            if (statusData.pending === 0 && statusData.processing === 0) {
              clearInterval(pollInterval);
              
              // Pedir las recomendaciones para ver cuántas son
              try {
                const recsRes = await fetch(`/api/recomendaciones/${account.accountId}`);
                if (recsRes.ok) {
                  const recsData = await recsRes.json();
                  toast({
                    title: "Análisis completado",
                    description: `Se han generado ${recsData.length} recomendaciones nuevas con IA.`,
                  });
                }
              } catch (e) {
                console.error("Error obteniendo count de recomendaciones", e);
              }
              
              setRefreshKey((prev) => prev + 1);
              setIsAnalyzing(false);
            }
          }
        } catch (pollErr) {
          console.error("Error durante el polling:", pollErr);
        }
      }, 3000); // comprobar cada 3 segundos

    } catch (err) {
      console.error("Error lanzando análisis:", err);
      setIsAnalyzing(false);
      toast({
        title: "Error",
        description: "No se pudo iniciar el análisis con IA.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-muted-foreground">Cargando cuenta...</div>
      </DashboardLayout>
    );
  }

  if (error || !account) {
    return (
      <DashboardLayout>
        <div className="p-6 text-red-500">
          {error || "Cuenta no encontrada"}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout> 
      {/* Barra de progreso de sincronización (fija en top) */}
      <SyncProgressBar
        key={`sync-${account.accountId}`}
        customerId={account.accountId}
        onComplete={handleSyncComplete}
        onVisibilityChange={handleSyncVisibilityChange}
      />
      
      <div className={`space-y-6 transition-all duration-300 ${isSyncVisible ? 'pt-32 md:pt-16' : 'pt-6'}`}>
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
          <div className="min-w-0 flex-1 w-full lg:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold break-words">
              {account.accountName}
            </h1>
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mt-2">
              <span className="text-muted-foreground text-sm">
                ID: {account.accountId}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{account.accountType}</Badge>
                <Badge variant="default" className="bg-green-500">
                  {account.connected ? "Conectada" : "Desconectada"}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <DateRangeFilter
              customerId={account.accountId}
              dateRange={dateRange}
              onChange={setDateRange}
              disabled={isSyncInProgress}
            />
            {/* Botón Analizar con IA — llama al endpoint de analysis ya existente */}
            <Button
              id="btn-analyze-account"
              onClick={handleAnalyzeAccount}
              disabled={isAnalyzing || isSyncInProgress}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4" />
                  Analizar con IA
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Métricas principales */}
        <AccountMetrics
          key={`metrics-${account.accountId}-${refreshKey}`}
          accountId={account.accountId}
          dateRange={dateRange}
        />

        {/* Recomendaciones de IA */}
        <div id="recommendations" className="w-full min-w-0">
          <RecommendationsPanel
            key={`recommendations-${account.accountId}-${refreshKey}`}
            accountId={account.accountId}
            navigation={navigation}
            specificFilter={specificRecommendationFilter}
          />
        </div>

        {/* Estructura de campañas */}
        <div id="campaigns" className="w-full min-w-0">
          <div className="overflow-x-auto w-full">
            <HierarchicalCampaignsList
              key={`campaigns-${account.accountId}-${refreshKey}`}
              accountId={account.accountId}
              dateRange={dateRange}
              navigation={navigation}
              onNavigationChange={handleNavigationChange}
              onCampaignTypeChange={setSelectedCampaignType}
              onShowRecommendations={(type, id) => {
                console.log("onShowRecommendations called:", type, id);

                let name = "";
                if (type === "campaign") {
                  name =
                    id === "1"
                      ? "Campaña Verano 2024"
                      : id === "2"
                      ? "Campaña Black Friday"
                      : `Campaña ${id}`;
                } else if (type === "adgroup") {
                  name =
                    id === "1" ? "Productos Verano - Camisetas" : `Grupo ${id}`;
                } else {
                  name = `Anuncio ${id}`;
                }

                console.log("Setting specific filter:", { type, id, name });
                setSpecificRecommendationFilter({ type, id, name });

                setTimeout(() => {
                  document
                    .getElementById("recommendations")
                    ?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
            />
          </div>
        </div>

        {/* Keywords, Términos de Búsqueda y Segmentación */}
        {navigation.selectedCampaign || navigation.selectedAdGroup ? (
          <div className="space-y-6 w-full min-w-0">
            {/* Solo mostrar Keywords si NO es Performance Max */}
            {selectedCampaignType !== 'PERFORMANCE_MAX' && (
              <div id="keywords" className="w-full min-w-0 overflow-x-auto">
                <KeywordsList
                  key={`keywords-${account.accountId}-${navigation.selectedCampaign}-${navigation.selectedAdGroup}-${refreshKey}`}
                  accountId={account.accountId}
                  dateRange={dateRange}
                  navigation={navigation}
                />
              </div>
            )}
            
            {/* Solo mostrar Search Terms si NO es Performance Max */}
            {selectedCampaignType !== 'PERFORMANCE_MAX' && (
              <div id="search-terms" className="w-full min-w-0 overflow-x-auto">
                <SearchTermsList
                  key={`search-terms-${account.accountId}-${refreshKey}`}
                  accountId={account.accountId}
                  dateRange={dateRange}
                  navigation={navigation}
                />
              </div>
            )}
            
            {/* Solo mostrar Audiences si NO es Performance Max */}
            {selectedCampaignType !== 'PERFORMANCE_MAX' && (
              <div id="audiences" className="w-full min-w-0 overflow-x-auto">
                <AudiencesList
                  key={`audiences-${account.accountId}-${refreshKey}`}
                  accountId={account.accountId}
                  campaignId={navigation.selectedCampaign}
                  adGroupId={navigation.selectedAdGroup}
                  dateRange={dateRange}
                />
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <div className="text-muted-foreground">
                <h3 className="text-lg font-medium mb-2">Análisis detallado</h3>
                <p>
                  Selecciona una campaña o grupo de anuncios para ver el
                  análisis detallado de:
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {selectedCampaignType !== 'PERFORMANCE_MAX' && (
                    <>
                      <Badge variant="outline">Palabras clave</Badge>
                      <Badge variant="outline">Términos de búsqueda</Badge>
                      <Badge variant="outline">Segmentos de audiencia</Badge>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AccountDetailPage;
