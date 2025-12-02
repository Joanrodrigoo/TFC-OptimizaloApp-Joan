import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { subDays } from "date-fns";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import SyncProgressBar from "@/components/account/SyncProgressBar";

import AccountMetrics from "@/components/account/AccountMetrics";
import HierarchicalCampaignsList from "@/components/account/HierarchicalCampaignsList";
import KeywordsList from "@/components/account/KeywordsList";
import SearchTermsList from "@/components/account/SearchTermsList";
import AudiencesList from "@/components/account/AudiencesList";
import RecommendationsPanel from "@/components/account/RecommendationsPanel";
import DateRangeFilter from "@/components/account/DateRangeFilter";
import { fetchGoogleAccounts } from "@/services/api";

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
          </div>
        </div>

        {/* Métricas principales */}
        <AccountMetrics
          key={`metrics-${account.accountId}-${refreshKey}`}
          accountId={account.accountId}
          dateRange={dateRange}
        />

        {/* Recomendaciones de IA */}
        <div id="recommendations">
          <RecommendationsPanel
            key={`recommendations-${account.accountId}-${refreshKey}`}
            accountId={account.accountId}
            navigation={navigation}
            specificFilter={specificRecommendationFilter}
          />
        </div>

        {/* Estructura de campañas */}
        <div id="campaigns">
          <div className="overflow-x-auto">
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
          <div className="space-y-6">
            {/* Solo mostrar Keywords si NO es Performance Max */}
            {selectedCampaignType !== 'PERFORMANCE_MAX' && (
              <div id="keywords">
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
              <div id="search-terms">
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
              <div id="audiences">
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
