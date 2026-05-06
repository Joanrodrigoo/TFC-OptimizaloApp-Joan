import React, { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { FilterPopover } from "@/components/ui/filter-popover";
import { PaginationControls } from "@/components/ui/pagination-controls";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Search,
  ChevronRight,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Loader2,
  Check,
  ArrowLeft,
} from "lucide-react";
import { formatCurrency, formatDateForAPI } from "@/lib/utils";
import { NavigationState } from "@/pages/AccountDetailPage";
import AdDetailsModal from "./AdDetailsModal";
import {
  getCampaignMetricsByCustomer,
  fetchRecomendaciones,
} from "@/services/api";
import {
  CampaignStatusMap,
  AdvertisingChannelTypeMap,
  Recomendacion,
} from "@/types/index";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import AssetPreviewModal from "./AssetPreviewModal";

interface HierarchicalCampaignsListProps {
  accountId: string;
  dateRange: { from: Date; to: Date };
  navigation: NavigationState;
  onNavigationChange: (navigation: NavigationState) => void;
  onShowRecommendations?: (
    type: "campaign" | "adgroup" | "ad",
    id: string
  ) => void;
  onCampaignTypeChange?: (type: string | null) => void;
}

type SortField =
  | keyof CampaignWithMetrics
  | keyof AdGroup
  | keyof Ad
  | keyof AssetGroup
  | keyof Asset;
type SortOrder = "asc" | "desc";

interface CampaignWithMetrics extends Record<string, unknown> {
  id: string;
  name: string;
  type: string;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;

  // ✅ Nuevos campos para conversiones
  conversions_value: number; // Valor total conversiones primarias
  all_conversions: number; // Total de todas las conversiones
  all_conversions_value: number; // Valor total de todas las conversiones

  // ✅ KPIs calculados
  roas: number; // Return on Ad Spend
  coste_por_conversion: number; // Coste por conversión en €
  tasa_conversion_porcentaje: number; // Tasa de conversión en %

  // ✅ Otros campos del endpoint (opcional, según necesites)
  cost_per_conversion_micros?: number; // Coste por conversión original
  conversion_rate?: number; // Tasa desde API
  value_per_all_conversions?: number; // Valor medio por conversión
  search_impression_share?: number; // % cuota de impresiones
  search_rank_lost_impression_share?: number;
  search_budget_lost_impression_share?: number;
}

interface AdGroup extends Record<string, unknown> {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  status: string;
  bid?: number | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;

  // ✅ Nuevos campos de conversión
  conversions_value: number; // Valor conversiones primarias
  all_conversions: number; // Total conversiones
  all_conversions_value: number; // Valor total conversiones

  // ✅ KPIs calculados
  roas: number; // Return on Ad Spend
  coste_por_conversion: number; // Coste por conversión
  tasa_conversion: number; // Tasa de conversión (%)
}

interface Ad extends Record<string, unknown> {
  id: string;
  adId: string;
  name?: string;
  headline1: string;
  headline2: string;
  headline: string;
  headlines?: string[];
  description: string;
  descriptions?: string[];
  adGroupId: string;
  adGroupName: string;
  status: string;
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  cpc: number;
  cost?: number;
  finalUrl: string;
  adType?: string;
  paths?: string[];
  callouts?: string[];
  sitelinks?: Array<{ title: string; url: string }>;
  images?: string[];
  videos?: string[];

  // ✅ Nuevos campos de conversión
  conversions_value: number; // Valor conversiones primarias
  all_conversions: number; // Total conversiones
  all_conversions_value: number; // Valor total conversiones

  // ✅ KPIs calculados
  roas: number; // Return on Ad Spend
  coste_por_conversion: number; // Coste por conversión
  tasa_conversion: number; // Tasa de conversión (%)
}

interface AssetGroup extends Record<string, unknown> {
  id: string;
  assetGroupId: string;
  assetGroupName: string;
  campaignId: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;
  conversionsValue: number; // Ya lo tenías
  videoViews: number;
  engagementRate: number;

  // ✅ Nuevos campos de conversión (si aún no los tienes)
  allConversions: number; // Total conversiones
  allConversionsValue: number; // Valor total conversiones

  // ✅ KPIs calculados
  roas: number; // Return on Ad Spend
  costePorConversion: number; // Coste por conversión
  tasaConversion: number; // Tasa de conversión (%)
}

interface Asset extends Record<string, unknown> {
  id: string;
  assetId: string;
  assetGroupId: string;
  fieldType: string;
  textValue: string | null;
  imageUrl: string | null;
  youtubeVideoId: string | null;
  youtubeLink: string | null;
  performanceLabel: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cost: number;
  conversions: number;

  // ✅ Nuevos campos de conversión
  conversionsValue: number; // Valor conversiones primarias
  allConversions: number; // Total conversiones
  allConversionsValue: number; // Valor total conversiones

  // ✅ KPIs calculados
  roas: number; // Return on Ad Spend
  costePorConversion: number; // Coste por conversión
  tasaConversion: number; // Tasa de conversión (%)
}

interface ApiError extends Error {
  status?: number;
}

const ITEMS_PER_PAGE = 10;
const TIMEOUT_MS = 30000;

const AdStatusMap: Record<string, string> = {
  "0": "UNSPECIFIED",
  "1": "UNKNOWN",
  "2": "ENABLED",
  "3": "PAUSED",
  "4": "REMOVED",
};

const AdGroupStatusMap: Record<string, string> = {
  "0": "UNSPECIFIED",
  "1": "UNKNOWN",
  "2": "ENABLED",
  "3": "PAUSED",
  "4": "REMOVED",
};

const AssetGroupStatusMap: Record<string, string> = {
  "0": "UNSPECIFIED",
  "1": "UNKNOWN",
  "2": "ENABLED",
  "3": "PAUSED",
  "4": "REMOVED",
};

// Mapeo de fieldType a nombres legibles
const FieldTypeMap: Record<string, string> = {
  "0": "No especificado",
  "1": "Desconocido",
  "2": "Título",
  "3": "Descripción",
  "4": "Texto obligatorio",
  "5": "Imagen marketing",
  "6": "Paquete multimedia",
  "7": "Vídeo YouTube",
  "8": "Reservar en Google",
  "9": "Formulario de leads",
  "10": "Promoción",
  "11": "Destacado",
  "12": "Fragmento estructurado",
  "13": "Enlace de sitio",
  "14": "App móvil",
  "15": "Destacado hotel",
  "16": "Llamada",
  "17": "Título largo",
  "18": "Nombre empresa",
  "19": "Imagen cuadrada",
  "20": "Imagen vertical",
  "21": "Logo",
  "22": "Logo horizontal",
  "23": "Vídeo",
  "24": "Precio",
  "25": "Llamada a la acción",
  "26": "Imagen anuncio",
  "27": "Logo empresa",
  "28": "Propiedad hotel",
  "30": "Tarjeta carrusel",
  "31": "Mensaje empresa",
  "32": "Imagen vertical alta",
  "33": "Vídeos YouTube relacionados",
};
// Función para calcular performance dinámicamente
const calculatePerformanceLabel = (asset: Asset): string => {
  // Si el performance no es PENDING, devolver el valor original
  if (asset.performanceLabel !== "PENDING") {
    return asset.performanceLabel;
  }

  // Si no hay impresiones, mantener PENDING
  if (asset.impressions === 0) {
    return "PENDING";
  }

  // Calcular métricas
  const hasConversions = asset.conversions > 0;
  const hasClicks = asset.clicks > 0;
  const ctr = asset.ctr || 0;
  const conversionRate = asset.tasaConversion || 0;

  // Criterios de rendimiento
  // BEST: Tiene conversiones Y (CTR > 2% O tasa conversión > 3%)
  if (hasConversions && (ctr > 2 || conversionRate > 3)) {
    return "BEST";
  }

  // GOOD: Tiene conversiones O (CTR > 1.5% Y clicks > 10)
  if (hasConversions || (ctr > 1.5 && asset.clicks > 10)) {
    return "GOOD";
  }

  // LOW: CTR < 0.5% O (impresiones > 100 Y clicks < 5)
  if (ctr < 0.5 || (asset.impressions > 100 && asset.clicks < 5)) {
    return "LOW";
  }

  // AVERAGE: Todo lo demás con datos
  if (hasClicks || asset.impressions > 0) {
    return "AVERAGE";
  }

  // Sin datos suficientes
  return "PENDING";
};

const HierarchicalCampaignsList = ({
  accountId,
  dateRange,
  navigation,
  onNavigationChange,
  onShowRecommendations,
  onCampaignTypeChange,
}: HierarchicalCampaignsListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("impressions");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const isMobile = useIsMobile();

  const [currentPageCampaigns, setCurrentPageCampaigns] = useState(1);
  const [currentPageAdGroups, setCurrentPageAdGroups] = useState(1);
  const [currentPageAds, setCurrentPageAds] = useState(1);
  const [currentPageAssetGroups, setCurrentPageAssetGroups] = useState(1);
  const [currentPageAssets, setCurrentPageAssets] = useState(1);

  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([]);
  const [adGroups, setAdGroups] = useState<AdGroup[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [assetGroups, setAssetGroups] = useState<AssetGroup[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  const [loading, setLoading] = useState(false);
  const [adGroupsLoading, setAdGroupsLoading] = useState(false);
  const [adsLoading, setAdsLoading] = useState(false);
  const [assetGroupsLoading, setAssetGroupsLoading] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

  const [recommendationsCount, setRecommendationsCount] = useState<
    Record<string, number>
  >({});
  const [error, setError] = useState<string | null>(null);

  const getAvailableTypes = (campaigns: CampaignWithMetrics[]) => {
    const types = new Set<string>();
    campaigns.forEach((campaign) => {
      if (campaign.type) types.add(campaign.type);
    });

    const typeOptions = [{ value: "all", label: "Todos los tipos" }];
    if (types.has("SEARCH"))
      typeOptions.push({ value: "SEARCH", label: "Búsqueda" });
    if (types.has("DISPLAY"))
      typeOptions.push({ value: "DISPLAY", label: "Display" });
    if (types.has("SHOPPING"))
      typeOptions.push({ value: "SHOPPING", label: "Shopping" });
    if (types.has("VIDEO"))
      typeOptions.push({ value: "VIDEO", label: "Vídeo" });
    if (types.has("PERFORMANCE_MAX"))
      typeOptions.push({ value: "PERFORMANCE_MAX", label: "Performance Max" });

    return typeOptions;
  };

  const createTimeoutController = (timeoutMs: number = TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return { controller, timeoutId };
  };

  const handleApiError = (error: ApiError, context: string) => {
    console.error(`Error en ${context}:`, error);

    if (error.name === "AbortError") {
      return `Timeout: ${context} tardó demasiado en responder`;
    }

    if (error.status === 504) {
      return `Gateway timeout: ${context} no disponible temporalmente`;
    }

    if (error.status === 500) {
      return `Error del servidor en ${context}`;
    }

    return error.message || `Error desconocido en ${context}`;
  };

  const convertMicrosToEuros = useCallback(
    (micros: string | number | null | undefined): number => {
      if (micros === null || micros === undefined || isNaN(Number(micros)))
        return 0;
      return Number(micros) / 1_000_000;
    },
    []
  );

  const loadRecommendationsCount = useCallback(async () => {
    if (!accountId) return;

    try {
      const data = await fetchRecomendaciones(Number(accountId));
      const countMap: Record<string, number> = {};

      data.forEach((rec: Recomendacion) => {
        if (rec.estado === "pendiente" && rec.objeto_id) {
          const key = `${rec.tipo_objeto}_${rec.objeto_id}`;
          countMap[key] = (countMap[key] || 0) + 1;
        }
      });

      setRecommendationsCount(countMap);
    } catch (err) {
      console.error("Error cargando conteo de recomendaciones:", err);
      setRecommendationsCount({});
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) {
      loadRecommendationsCount();
    }
  }, [accountId, loadRecommendationsCount]);

  const getRecommendationsCount = (
    type: "campaign" | "adgroup" | "ad",
    id: string
  ) => {
    const typeMap = {
      campaign: "campaign",
      adgroup: "ad_group",
      ad: "ad",
    };
    const key = `${typeMap[type]}_${id}`;
    return recommendationsCount[key] || 0;
  };

  const AIIndicator = ({
    type,
    id,
    className = "",
  }: {
    type: "campaign" | "adgroup" | "ad";
    id: string;
    className?: string;
  }) => {
    const count = getRecommendationsCount(type, id);

    if (count === 0) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center justify-center w-6 h-6 bg-green-500 rounded-full cursor-pointer transition-all duration-200 ease-out">
                <Check className="w-4 h-4 text-white" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>¡Excelente! Has completado todas las recomendaciones</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onShowRecommendations?.(type, id);
    };

    return (
      <button
        onClick={handleClick}
        className={`flex items-center justify-center gap-1 px-3 h-8 rounded-full text-sm font-bold text-white group-hover:shadow-lg group-hover:scale-110 group-hover:bg-red-600 transition-all duration-200 ease-out bg-red-500 cursor-pointer ${className}`}
      >
        <span>IA</span>
        <span>{count}</span>
      </button>
    );
  };

  useEffect(() => {
    setCurrentPageCampaigns(1);
    setCurrentPageAdGroups(1);
    setCurrentPageAds(1);
    setCurrentPageAssetGroups(1);
    setCurrentPageAssets(1);
  }, [searchTerm]);

  useEffect(() => {
    if (navigation.level === "campaigns") {
      setCurrentPageCampaigns(1);
    } else if (navigation.level === "adgroups") {
      setCurrentPageAdGroups(1);
      setCurrentPageAssetGroups(1);
    } else if (navigation.level === "ads") {
      setCurrentPageAds(1);
      setCurrentPageAssets(1);
    }
  }, [
    navigation.level,
    navigation.selectedCampaign,
    navigation.selectedAdGroup,
  ]);

  const sortCampaigns = useCallback(
    (
      campaigns: CampaignWithMetrics[],
      sortField?: keyof CampaignWithMetrics,
      sortDirection: "asc" | "desc" = "asc"
    ): CampaignWithMetrics[] => {
      return [...campaigns].sort((a, b) => {
        if (sortField) {
          const aValue = a[sortField];
          const bValue = b[sortField];
          if (aValue == null && bValue != null) return 1;
          if (aValue != null && bValue == null) return -1;
          if (aValue == null && bValue == null) return 0;
          if (typeof aValue === "number" && typeof bValue === "number") {
            return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
          }
          return sortDirection === "asc"
            ? String(aValue).localeCompare(String(bValue))
            : String(bValue).localeCompare(String(aValue));
        }
        const statusPriority: Record<string, number> = {
          ENABLED: 0,
          PAUSED: 1,
          REMOVED: 2,
        };
        const aStatusPriority =
          statusPriority[a.status as keyof typeof statusPriority] ?? 3;
        const bStatusPriority =
          statusPriority[b.status as keyof typeof statusPriority] ?? 3;
        if (aStatusPriority !== bStatusPriority) {
          return aStatusPriority - bStatusPriority;
        }
        if ((b.impressions ?? 0) !== (a.impressions ?? 0)) {
          return (b.impressions ?? 0) - (a.impressions ?? 0);
        }
        return (b.ctr ?? 0) - (a.ctr ?? 0);
      });
    },
    []
  );

  const loadCampaignMetrics = useCallback(async () => {
    if (!accountId) return;

    setLoading(true);
    setError(null);

    const { controller, timeoutId } = createTimeoutController();

    try {
      const fromDate = formatDateForAPI(dateRange.from);
      const toDate = formatDateForAPI(dateRange.to);

      const data = await getCampaignMetricsByCustomer(
        accountId,
        fromDate,
        toDate
      );

      if (!data || !Array.isArray(data)) {
        throw new Error("No se recibieron datos válidos de campañas");
      }

      const mappedCampaigns: CampaignWithMetrics[] = data.map(
        (campaign: any) => ({
          id: campaign.campaign_id,
          name: campaign.campaign_name || "Campaña sin nombre",
          status: CampaignStatusMap[campaign.campaign_status] ?? "UNKNOWN",
          type:
            AdvertisingChannelTypeMap[campaign.campaign_type] ?? "UNSPECIFIED",
          budget: convertMicrosToEuros(campaign.budget_micros || "0"),
          spend: parseFloat(campaign.cost_micros || "0"),
          impressions: parseInt(campaign.impressions || "0", 10),
          clicks: parseInt(campaign.clicks || "0", 10),
          conversions: parseFloat(campaign.conversions || "0"),
          ctr: parseFloat(campaign.ctr || "0"),
          cpc: parseFloat(campaign.average_cpc_micros || "0"), // ✅ Corregido: era cost_per_conversion_micros

          // ✅ Nuevos campos de conversión
          conversions_value: parseFloat(campaign.conversions_value || "0"),
          all_conversions: parseFloat(campaign.all_conversions || "0"),
          all_conversions_value: parseFloat(
            campaign.all_conversions_value || "0"
          ),

          // ✅ KPIs calculados
          roas: parseFloat(campaign.roas || "0"),
          coste_por_conversion: parseFloat(
            campaign.coste_por_conversion || "0"
          ),
          tasa_conversion_porcentaje: parseFloat(
            campaign.tasa_conversion_porcentaje || "0"
          ),

          // ✅ Campos opcionales adicionales (si los necesitas en el front)
          cost_per_conversion_micros: parseFloat(
            campaign.cost_per_conversion_micros || "0"
          ),
          conversion_rate: parseFloat(campaign.conversion_rate || "0"),
          value_per_all_conversions: parseFloat(
            campaign.value_per_all_conversions || "0"
          ),
          search_impression_share: parseFloat(
            campaign.search_impression_share || "0"
          ),
          search_rank_lost_impression_share: parseFloat(
            campaign.search_rank_lost_impression_share || "0"
          ),
          search_budget_lost_impression_share: parseFloat(
            campaign.search_budget_lost_impression_share || "0"
          ),
        })
      );

      setCampaigns(mappedCampaigns);
    } catch (err: unknown) {
      const apiError = err as ApiError;
      const errorMessage = handleApiError(apiError, "cargar campañas");
      setError(errorMessage);
      setCampaigns([]);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [accountId, dateRange, convertMicrosToEuros]);

  const loadAdGroups = useCallback(
    async (campaignId: string) => {
      if (!campaignId) return;

      setAdGroupsLoading(true);
      setError(null);

      const { controller, timeoutId } = createTimeoutController();

      try {
        const fromDate = formatDateForAPI(dateRange.from);
        const toDate = formatDateForAPI(dateRange.to);

        const url = `/api/campaigns/${campaignId}/ad-groups?from=${fromDate}&to=${toDate}`;

        const res = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }

        const rawData = await res.json();

        if (!Array.isArray(rawData)) {
          throw new Error("Formato de datos inválido para grupos de anuncios");
        }

        const mappedAdGroups: AdGroup[] = rawData.map((adGroup: any) => ({
          id: adGroup.id || adGroup.ad_group_id,
          name: adGroup.ad_group_name || adGroup.name || "Grupo sin nombre",
          campaignId: adGroup.campaign_id || campaignId,
          campaignName: adGroup.campaign_name || "",
          status: AdGroupStatusMap[String(adGroup.status)] || "UNKNOWN",
          bid: adGroup.bid ? parseFloat(String(adGroup.bid)) : null,
          spend: parseFloat(String(adGroup.cost || adGroup.spend || "0")),
          impressions: parseInt(String(adGroup.impressions || "0"), 10),
          clicks: parseInt(String(adGroup.clicks || "0"), 10),
          conversions: parseFloat(String(adGroup.conversions || "0")),
          ctr: parseFloat(String(adGroup.ctr || "0")),
          cpc: parseFloat(String(adGroup.average_cpc || adGroup.cpc || "0")),

          // ✅ Nuevos campos de conversión
          conversions_value: parseFloat(
            String(adGroup.conversions_value || "0")
          ),
          all_conversions: parseFloat(String(adGroup.all_conversions || "0")),
          all_conversions_value: parseFloat(
            String(adGroup.all_conversions_value || "0")
          ),

          // ✅ KPIs calculados
          roas: parseFloat(String(adGroup.roas || "0")),
          coste_por_conversion: parseFloat(
            String(adGroup.coste_por_conversion || "0")
          ),
          tasa_conversion: parseFloat(String(adGroup.tasa_conversion || "0")),
        }));

        setAdGroups(mappedAdGroups);
      } catch (err: unknown) {
        const apiError = err as ApiError;
        const errorMessage = handleApiError(
          apiError,
          "cargar grupos de anuncios"
        );
        setError(errorMessage);
        setAdGroups([]);
      } finally {
        clearTimeout(timeoutId);
        setAdGroupsLoading(false);
      }
    },
    [dateRange]
  );

  const loadAssetGroups = useCallback(
    async (campaignId: string) => {
      if (!campaignId) return;

      setAssetGroupsLoading(true);
      setError(null);

      const { controller, timeoutId } = createTimeoutController();

      try {
        const fromDate = formatDateForAPI(dateRange.from);
        const toDate = formatDateForAPI(dateRange.to);

        const url = `/api/campaigns/${campaignId}/asset-groups?from=${fromDate}&to=${toDate}`;

        console.log("🔄 Cargando asset groups:", url);

        const res = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }

        const rawData = await res.json();
        console.log("✅ Asset groups recibidos:", rawData);

        if (!Array.isArray(rawData)) {
          throw new Error("Formato de datos inválido para asset groups");
        }

        const mappedAssetGroups: AssetGroup[] = rawData.map((ag: any) => ({
          id: ag.assetGroupId || ag.id,
          assetGroupId: ag.assetGroupId || ag.id,
          assetGroupName: ag.assetGroupName || "Grupo sin nombre",
          campaignId: ag.campaignId || campaignId,
          status: AssetGroupStatusMap[String(ag.status)] || "UNKNOWN",
          impressions: Number(ag.impressions) || 0,
          clicks: Number(ag.clicks) || 0,
          ctr: Number(ag.ctr) || 0,
          cost: Number(ag.cost) || 0,
          conversions: Number(ag.conversions) || 0,
          conversionsValue: Number(ag.conversionsValue) || 0,
          videoViews: Number(ag.videoViews) || 0,
          engagementRate: Number(ag.engagementRate) || 0,

          // ✅ Nuevos campos de conversión
          allConversions: Number(ag.allConversions) || 0,
          allConversionsValue: Number(ag.allConversionsValue) || 0,

          // ✅ KPIs calculados
          roas: Number(ag.roas) || 0,
          costePorConversion: Number(ag.costePorConversion) || 0,
          tasaConversion: Number(ag.tasaConversion) || 0,
        }));

        setAssetGroups(mappedAssetGroups);
        console.log("✅ Asset groups procesados:", mappedAssetGroups.length);
      } catch (err: unknown) {
        const apiError = err as ApiError;
        const errorMessage = handleApiError(apiError, "cargar asset groups");
        setError(errorMessage);
        setAssetGroups([]);
      } finally {
        clearTimeout(timeoutId);
        setAssetGroupsLoading(false);
      }
    },
    [dateRange]
  );

  const loadAds = useCallback(
    async (adGroupId: string) => {
      if (!adGroupId) return;

      setAdsLoading(true);
      setError(null);

      const { controller, timeoutId } = createTimeoutController();

      try {
        const fromDate = formatDateForAPI(dateRange.from);
        const toDate = formatDateForAPI(dateRange.to);

        const url = `/api/ad-groups/${adGroupId}/ads?from=${fromDate}&to=${toDate}`;

        const res = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }

        const rawData = await res.json();

        if (!Array.isArray(rawData)) {
          throw new Error("Formato de datos inválido para anuncios");
        }

        const mappedAds: Ad[] = rawData.map((ad: any) => {
          const headlines = Array.isArray(ad.ad_headline) ? ad.ad_headline : [];
          const descriptions = Array.isArray(ad.ad_description)
            ? ad.ad_description
            : [];
          const callouts = Array.isArray(ad.callouts) ? ad.callouts : [];
          const images = Array.isArray(ad.images) ? ad.images : [];

          const finalUrls = Array.isArray(ad.final_urls) ? ad.final_urls : [];
          const finalMobileUrls = Array.isArray(ad.final_mobile_urls)
            ? ad.final_mobile_urls
            : [];
          const finalUrl =
            ad.final_url || (finalUrls.length > 0 ? finalUrls[0] : "");
          const displayUrl = ad.display_url || "";
          const path1 = ad.path1 || "";
          const path2 = ad.path2 || "";

          const sitelinks = Array.isArray(ad.sitelinks)
            ? ad.sitelinks.map((link: any) => {
                if (
                  typeof link === "object" &&
                  link !== null &&
                  link.title &&
                  link.url
                ) {
                  return { title: link.title, url: link.url };
                }
                if (typeof link === "string") {
                  try {
                    const parsed = JSON.parse(link);
                    return {
                      title:
                        parsed.title ||
                        parsed.text ||
                        parsed.linkText ||
                        "Sitelink",
                      url: parsed.url || parsed.link || parsed.finalUrl || "",
                    };
                  } catch {
                    return { title: link, url: "" };
                  }
                }
                return { title: "Sitelink", url: "" };
              })
            : [];

          return {
            id: ad.ad_id || "",
            adId: ad.ad_id || "",
            name: ad.name || "",
            headline: headlines[0] || "",
            headline1: headlines[0] || "",
            headline2: headlines[1] || "",
            headlines: headlines,
            description: descriptions[0] || "",
            descriptions: descriptions,
            adGroupId: ad.ad_group_id || "",
            adGroupName: "",
            status: AdStatusMap[String(ad.status)] || "UNKNOWN",
            impressions: ad.impressions || 0,
            clicks: ad.clicks || 0,
            conversions: ad.conversions || 0,
            ctr: ad.ctr || 0,
            cpc: ad.average_cpc || 0,
            cost: ad.cost || 0,
            finalUrl: finalUrl,
            adType: ad.ad_type || "",
            paths: [path1, path2].filter(Boolean),
            callouts: callouts,
            sitelinks: sitelinks,
            images: images,
            videos: [],

            // ✅ Nuevos campos de conversión
            conversions_value: parseFloat(String(ad.conversions_value || "0")),
            all_conversions: parseFloat(String(ad.all_conversions || "0")),
            all_conversions_value: parseFloat(
              String(ad.all_conversions_value || "0")
            ),

            // ✅ KPIs calculados
            roas: parseFloat(String(ad.roas || "0")),
            coste_por_conversion: parseFloat(
              String(ad.coste_por_conversion || "0")
            ),
            tasa_conversion: parseFloat(String(ad.tasa_conversion || "0")),
          };
        });

        setAds(mappedAds);
      } catch (err: unknown) {
        const apiError = err as ApiError;
        const errorMessage = handleApiError(apiError, "cargar anuncios");
        setError(errorMessage);
        setAds([]);
      } finally {
        clearTimeout(timeoutId);
        setAdsLoading(false);
      }
    },
    [dateRange]
  );

  const loadAssets = useCallback(
    async (assetGroupId: string) => {
      if (!assetGroupId) return;

      setAssetsLoading(true);
      setError(null);

      const { controller, timeoutId } = createTimeoutController();

      try {
        const fromDate = formatDateForAPI(dateRange.from);
        const toDate = formatDateForAPI(dateRange.to);

        const url = `/api/asset-groups/${assetGroupId}/assets?from=${fromDate}&to=${toDate}`;

        console.log("🔄 Cargando assets:", url);

        const res = await fetch(url, {
          credentials: "include",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!res.ok) {
          throw new Error(`Error ${res.status}: ${res.statusText}`);
        }

        const rawData = await res.json();
        console.log("✅ Assets recibidos:", rawData);

        if (!Array.isArray(rawData)) {
          throw new Error("Formato de datos inválido para assets");
        }

        const mappedAssets: Asset[] = rawData.map((asset: any) => ({
          id: asset.assetId || asset.id,
          assetId: asset.assetId || asset.id,
          assetGroupId: asset.assetGroupId || assetGroupId,
          fieldType: asset.fieldType || "UNKNOWN",
          textValue: asset.textValue || null,
          imageUrl: asset.imageUrl || null,
          youtubeVideoId: asset.youtubeVideoId || null,
          youtubeLink: asset.youtubeLink || null,
          performanceLabel: asset.performanceLabel || "UNSPECIFIED",
          impressions: Number(asset.impressions) || 0,
          clicks: Number(asset.clicks) || 0,
          ctr: Number(asset.ctr) || 0,
          cost: Number(asset.cost) || 0,
          conversions: Number(asset.conversions) || 0,

          // ✅ Nuevos campos de conversión
          conversionsValue: Number(asset.conversionsValue) || 0,
          allConversions: Number(asset.allConversions) || 0,
          allConversionsValue: Number(asset.allConversionsValue) || 0,

          // ✅ KPIs calculados
          roas: Number(asset.roas) || 0,
          costePorConversion: Number(asset.costePorConversion) || 0,
          tasaConversion: Number(asset.tasaConversion) || 0,
        }));

        setAssets(mappedAssets);
        console.log("✅ Assets procesados:", mappedAssets.length);
      } catch (err: unknown) {
        const apiError = err as ApiError;
        const errorMessage = handleApiError(apiError, "cargar assets");
        setError(errorMessage);
        setAssets([]);
      } finally {
        clearTimeout(timeoutId);
        setAssetsLoading(false);
      }
    },
    [dateRange]
  );

  const getSelectedCampaignType = useCallback(() => {
    if (!navigation.selectedCampaign) return null;
    const campaign = campaigns.find(
      (c) => c.id === navigation.selectedCampaign
    );
    return campaign?.type || null;
  }, [navigation.selectedCampaign, campaigns]);

  // Notificar cambios en el tipo de campaña seleccionada
  useEffect(() => {
    const campaignType = getSelectedCampaignType();
    if (onCampaignTypeChange) {
      onCampaignTypeChange(campaignType);
    }
  }, [getSelectedCampaignType, onCampaignTypeChange]);

  useEffect(() => {
    if (navigation.level === "campaigns") {
      setAdGroups([]);
      setAssetGroups([]);
      setAds([]);
      setAssets([]);
    } else if (navigation.level === "adgroups") {
      setAds([]);
      setAssets([]);
      if (navigation.selectedCampaign) {
        const campaignType = getSelectedCampaignType();
        if (campaignType === "PERFORMANCE_MAX") {
          loadAssetGroups(navigation.selectedCampaign);
        } else {
          loadAdGroups(navigation.selectedCampaign);
        }
      }
    } else if (navigation.level === "ads") {
      if (navigation.selectedAdGroup) {
        const campaignType = getSelectedCampaignType();
        if (campaignType === "PERFORMANCE_MAX") {
          loadAssets(navigation.selectedAdGroup);
        } else {
          loadAds(navigation.selectedAdGroup);
        }
      }
    }
  }, [
    navigation.level,
    navigation.selectedCampaign,
    navigation.selectedAdGroup,
    loadAdGroups,
    loadAssetGroups,
    loadAds,
    loadAssets,
    getSelectedCampaignType,
  ]);

  useEffect(() => {
    if (accountId && dateRange.from && dateRange.to) {
      loadCampaignMetrics();
    }
  }, [accountId, dateRange.from, dateRange.to, loadCampaignMetrics]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return null;
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4" />
    ) : (
      <ArrowDown className="h-4 w-4" />
    );
  };

  const sortData = <T extends Record<string, any>>(data: T[]): T[] => {
    if (!sortField) return data;

    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal == null && bVal != null) return 1;
      if (aVal != null && bVal == null) return -1;
      if (aVal == null && bVal == null) return 0;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const getTypeBadge = (type: string) => {
    const typeStyles = {
      SEARCH: "bg-blue-100 text-blue-800",
      DISPLAY: "bg-purple-100 text-purple-800",
      SHOPPING: "bg-green-100 text-green-800",
      VIDEO: "bg-red-100 text-red-800",
      PERFORMANCE_MAX: "bg-cyan-100 text-cyan-800",
    };

    const style = typeStyles[type as keyof typeof typeStyles];

    return (
      <Badge variant="outline" className={style || "bg-gray-100 text-gray-800"}>
        {type.replace(/_/g, " ")}
      </Badge>
    );
  };

  const getPerformanceLabelBadge = (label: string) => {
    switch (label) {
      case "BEST":
        return <Badge className="bg-green-500">Mejor</Badge>;
      case "GOOD":
        return <Badge className="bg-blue-500">Bueno</Badge>;
      case "AVERAGE":
        return <Badge className="bg-yellow-500">Promedio</Badge>;
      case "LOW":
        return <Badge className="bg-orange-500">Bajo</Badge>;
      case "PENDING":
        return <Badge variant="outline">Pendiente</Badge>;
      default:
        return <Badge variant="secondary">N/A</Badge>;
    }
  };

  const getFieldTypeBadge = (fieldType: string) => {
    const typeStyles: Record<string, string> = {
      "2": "bg-blue-500 text-white", // Título
      "3": "bg-purple-500 text-white", // Descripción
      "5": "bg-pink-500 text-white", // Imagen marketing
      "7": "bg-red-500 text-white", // Vídeo YouTube
      "11": "bg-green-500 text-white", // Destacado
      "13": "bg-cyan-500 text-white", // Enlace de sitio
      "17": "bg-indigo-500 text-white", // Título largo
      "19": "bg-rose-500 text-white", // Imagen cuadrada
      "20": "bg-violet-500 text-white", // Imagen vertical
      "21": "bg-amber-500 text-white", // Logo
      "23": "bg-orange-500 text-white", // Vídeo
    };

    const style = typeStyles[fieldType] || "bg-gray-100 text-gray-800";
    const label = FieldTypeMap[fieldType] || `Tipo ${fieldType}`;

    return (
      <Badge variant="outline" className={style}>
        {label}
      </Badge>
    );
  };

  const handleAdClick = (ad: Ad) => {
    setSelectedAd(ad);
    setIsAdModalOpen(true);
  };

  const SortableHeader = ({
    field,
    children,
  }: {
    field: SortField;
    children: React.ReactNode;
  }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 select-none whitespace-nowrap"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {getSortIcon(field)}
      </div>
    </TableHead>
  );

  const ErrorDisplay = ({
    message,
    onRetry,
  }: {
    message: string;
    onRetry: () => void;
  }) => (
    <div className="flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-red-600 mb-4">
          <p className="font-semibold">Ha ocurrido un error</p>
          <p className="text-sm mt-2">{message}</p>
        </div>
        <div className="space-x-2">
          <Button onClick={onRetry} variant="outline">
            Reintentar
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="ghost"
            size="sm"
          >
            Recargar página
          </Button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando campañas...</span>
      </div>
    );
  }

  if (error && navigation.level === "campaigns") {
    return <ErrorDisplay message={error} onRetry={loadCampaignMetrics} />;
  }
  // RENDERIZADO DE CAMPAÑAS
  if (navigation.level === "campaigns") {
    const filteredCampaigns = campaigns.filter((campaign) => {
      const matchesSearch = (campaign.name || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === "all" || campaign.type === typeFilter;
      return matchesSearch && matchesType;
    });

    const sortedCampaigns = sortCampaigns(
      filteredCampaigns,
      sortField as keyof CampaignWithMetrics | undefined,
      sortOrder
    );

    const totalCampaigns = sortedCampaigns.length;
    const totalCampaignPages = Math.ceil(totalCampaigns / ITEMS_PER_PAGE);
    const startIndex = (currentPageCampaigns - 1) * ITEMS_PER_PAGE;
    const paginatedCampaigns = sortedCampaigns.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );

    return (
      <div className="space-y-0">
        <div className="bg-primary text-primary-foreground px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-semibold">Campañas</h2>
        </div>

        <Card className="rounded-t-none border-t-0">
          <CardContent className="p-6">
            <div className="flex flex-row gap-3 justify-between items-center mb-6">
              <FilterPopover
                filters={[
                  {
                    key: "type",
                    label: "Tipo",
                    value: typeFilter,
                    onChange: setTypeFilter,
                    options: getAvailableTypes(campaigns),
                  },
                ]}
                onClearAll={() => {
                  setTypeFilter("all");
                }}
              />

              <div className="relative flex-1 max-w-[200px] sm:max-w-[280px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar campañas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isMobile ? (
              <div className="space-y-3">
                {paginatedCampaigns.map((campaign) => (
                  <Card
                    key={campaign.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() =>
                      onNavigationChange({
                        level: "adgroups",
                        selectedCampaign: campaign.id,
                        campaignName: campaign.name,
                      })
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <h3 className="font-bold text-sm flex-1 overflow-hidden break-words line-clamp-2">
                          {campaign.name}
                        </h3>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                      <div className="flex gap-2 mb-3">
                        {getTypeBadge(campaign.type)}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">
                            Presupuesto:
                          </span>
                          <div className="font-medium">
                            {formatCurrency(campaign.budget)}/día
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Coste:</span>
                          <div className="font-medium">
                            {formatCurrency(campaign.spend)}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CPC:</span>
                          <div className="font-medium">
                            {formatCurrency(campaign.cpc)}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Impresiones:
                          </span>
                          <div className="font-medium">
                            {campaign.impressions.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Clics:</span>
                          <div className="font-medium">
                            {campaign.clicks.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CTR:</span>
                          <div className="font-medium">
                            {campaign.ctr.toFixed(2)}%
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Tasa de Conversión:
                          </span>
                          <div className="font-medium">
                            {campaign.tasa_conversion_porcentaje.toFixed(2)}%
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Conversiones
                        </div>
                        <div className="font-medium">
                          {Math.round(campaign.conversions)}
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Coste/Conv:
                          </span>
                          <div className="font-medium">
                            {campaign.coste_por_conversion.toFixed(2)}€
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">ROAS:</span>
                          <div className="font-medium">
                            {campaign.roas.toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <AIIndicator type="campaign" id={campaign.id} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-full table-auto">
                  <TableHeader>
                    <TableRow>
                      <SortableHeader field="name">
                        <span className="font-bold">Campaña</span>
                      </SortableHeader>
                      <SortableHeader field="type">
                        <span className="font-bold">Tipo</span>
                      </SortableHeader>
                      <SortableHeader field="budget">
                        <span className="font-bold">Presupuesto</span>
                      </SortableHeader>
                      <SortableHeader field="spend">
                        <span className="font-bold">Coste</span>
                      </SortableHeader>
                      <SortableHeader field="cpc">
                        <span className="font-bold">CPC</span>
                      </SortableHeader>
                      <SortableHeader field="impressions">
                        <span className="font-bold">Impresiones</span>
                      </SortableHeader>
                      <SortableHeader field="clicks">
                        <span className="font-bold">Clics</span>
                      </SortableHeader>
                      <SortableHeader field="ctr">
                        <span className="font-bold">CTR</span>
                      </SortableHeader>
                      <SortableHeader field="conversionRate">
                        <span className="font-bold">Tasa de Conversión</span>
                      </SortableHeader>
                      <SortableHeader field="conversions">
                        <span className="font-bold">Conversiones</span>
                      </SortableHeader>
                      <SortableHeader field="costPerConversion">
                        <span className="font-bold">Coste/Conv</span>
                      </SortableHeader>
                      <SortableHeader field="roas">
                        <span className="font-bold">ROAS</span>
                      </SortableHeader>
                      <TableHead
                        className="sticky right-0 border-l-2 border-r-2 border-t-2 w-20 text-center px-4 font-bold whitespace-nowrap"
                        style={{
                          backgroundColor: "#12BAA9",
                          borderLeftColor: "#12BAA9",
                          borderRightColor: "#12BAA9",
                          borderTopColor: "#12BAA9",
                          color: "white",
                        }}
                      >
                        IA
                      </TableHead>
                      <TableHead className="w-8 font-bold whitespace-nowrap"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCampaigns.map((campaign) => (
                      <TableRow
                        key={campaign.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() =>
                          onNavigationChange({
                            level: "adgroups",
                            selectedCampaign: campaign.id,
                            campaignName: campaign.name,
                          })
                        }
                      >
                        <TableCell className="font-medium">
                          {campaign.name}
                        </TableCell>
                        <TableCell>{getTypeBadge(campaign.type)}</TableCell>
                        <TableCell>
                          {formatCurrency(campaign.budget)}/día
                        </TableCell>
                        <TableCell>{formatCurrency(campaign.spend)}</TableCell>
                        <TableCell>{formatCurrency(campaign.cpc)}</TableCell>
                        <TableCell>
                          {campaign.impressions.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {campaign.clicks.toLocaleString()}
                        </TableCell>
                        <TableCell>{campaign.ctr.toFixed(2)}%</TableCell>
                        <TableCell>
                          {campaign.tasa_conversion_porcentaje.toFixed(2)}%
                        </TableCell>
                        {/* ✅ Tasa de Conversión */}
                        <TableCell>
                          {Math.round(campaign.conversions)}
                        </TableCell>
                        <TableCell>
                          {campaign.coste_por_conversion.toFixed(2)}€
                        </TableCell>
                        {/* ✅ Coste/Conv */}
                        <TableCell>{campaign.roas.toFixed(2)}</TableCell>
                        {/* ✅ ROAS */}
                        <TableCell
                          className="sticky right-0 border-l-2 border-r-2 border-t-2 border-b-2 text-center px-4 bg-white hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                          style={{
                            borderLeftColor: "#12BAA9",
                            borderRightColor: "#12BAA9",
                            borderTopColor: "#12BAA9",
                            borderBottomColor: "#12BAA9",
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const aiButton =
                              e.currentTarget.querySelector("button");
                            if (aiButton) {
                              (aiButton as HTMLButtonElement).click();
                            }
                          }}
                        >
                          <div className="flex justify-center group">
                            <AIIndicator type="campaign" id={campaign.id} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <PaginationControls
              currentPage={currentPageCampaigns}
              totalPages={totalCampaignPages}
              totalItems={totalCampaigns}
              itemsPerPage={ITEMS_PER_PAGE}
              itemName="campañas"
              onPageChange={setCurrentPageCampaigns}
            />
          </CardContent>
        </Card>
      </div>
    );
  }
  // RENDERIZADO DE GRUPOS DE ANUNCIOS O ASSET GROUPS
  if (navigation.level === "adgroups") {
    const campaignType = getSelectedCampaignType();
    const isPmax = campaignType === "PERFORMANCE_MAX";

    // Si es Performance Max, mostrar Asset Groups
    if (isPmax) {
      if (assetGroupsLoading) {
        return (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Cargando grupos de recursos...</span>
          </div>
        );
      }

      if (error) {
        return (
          <ErrorDisplay
            message={error}
            onRetry={() =>
              navigation.selectedCampaign &&
              loadAssetGroups(navigation.selectedCampaign)
            }
          />
        );
      }

      if (assetGroups.length === 0) {
        return (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <p className="text-muted-foreground mb-4">
                No se encontraron grupos de recursos para esta campaña
              </p>
              <Button
                onClick={() =>
                  navigation.selectedCampaign &&
                  loadAssetGroups(navigation.selectedCampaign)
                }
                variant="outline"
              >
                Reintentar
              </Button>
            </div>
          </div>
        );
      }

      const filteredAssetGroups = assetGroups.filter((ag) => {
        const matchesSearch = (ag.assetGroupName || '')
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

        return matchesSearch;
      });

      const sortedAssetGroups = sortData(filteredAssetGroups);

      const totalAssetGroups = sortedAssetGroups.length;
      const totalAssetGroupPages = Math.ceil(totalAssetGroups / ITEMS_PER_PAGE);
      const startIndexAssetGroups =
        (currentPageAssetGroups - 1) * ITEMS_PER_PAGE;
      const paginatedAssetGroups = sortedAssetGroups.slice(
        startIndexAssetGroups,
        startIndexAssetGroups + ITEMS_PER_PAGE
      );

      return (
        <div className="space-y-0">
          <div className="bg-primary text-primary-foreground px-4 sm:px-6 py-4 rounded-t-lg">
            <div className="flex flex-row gap-2 sm:gap-3 items-center overflow-x-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigationChange({ level: "campaigns" })}
                className="bg-white hover:bg-primary/10 text-primary border-white shrink-0 transition-all"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Volver</span>
              </Button>

              <Breadcrumb>
                <BreadcrumbList className="text-base sm:text-xl whitespace-nowrap">
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      className="cursor-pointer hover:text-primary-foreground/80 text-primary-foreground font-semibold"
                      onClick={() => onNavigationChange({ level: "campaigns" })}
                    >
                      Campañas
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-primary-foreground/60" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-primary-foreground font-semibold">
                      {navigation.campaignName || "Campaña"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>

          <Card className="rounded-t-none border-t-0">
            <CardContent className="p-6">
              <div className="flex flex-row gap-3 justify-between items-center mb-6">
                <div className="relative flex-1 max-w-[200px] sm:max-w-[280px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar grupos de recursos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {isMobile ? (
                <div className="space-y-3">
                  {paginatedAssetGroups.map((assetGroup) => (
                    <Card
                      key={assetGroup.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() =>
                        onNavigationChange({
                          level: "ads",
                          selectedCampaign: navigation.selectedCampaign,
                          selectedAdGroup: assetGroup.id,
                          campaignName: navigation.campaignName,
                          adGroupName: assetGroup.assetGroupName,
                        })
                      }
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="font-medium text-sm">
                            {assetGroup.assetGroupName}
                          </h3>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">
                              Coste:
                            </span>
                            <div className="font-medium">
                              {formatCurrency(assetGroup.cost)}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Impresiones:
                            </span>
                            <div className="font-medium">
                              {assetGroup.impressions.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Clics:
                            </span>
                            <div className="font-medium">
                              {assetGroup.clicks.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">CTR:</span>
                            <div className="font-medium">
                              {assetGroup.ctr.toFixed(2)}%
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Vistas Video:
                            </span>
                            <div className="font-medium">
                              {assetGroup.videoViews.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Engagement:
                            </span>
                            <div className="font-medium">
                              {assetGroup.engagementRate.toFixed(2)}%
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs text-muted-foreground">
                                Conversiones
                              </div>
                              <div className="font-medium">
                                {Math.round(assetGroup.conversions)}
                              </div>
                            </div>
                            <AIIndicator type="adgroup" id={assetGroup.id} />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-full table-auto">
                    <TableHeader>
                      <TableRow>
                        <SortableHeader field="assetGroupName">
                          <span className="font-bold">Grupo de Recursos</span>
                        </SortableHeader>
                        <SortableHeader field="cost">
                          <span className="font-bold">Coste</span>
                        </SortableHeader>
                        <SortableHeader field="impressions">
                          <span className="font-bold">Impresiones</span>
                        </SortableHeader>
                        <SortableHeader field="clicks">
                          <span className="font-bold">Clics</span>
                        </SortableHeader>
                        <SortableHeader field="ctr">
                          <span className="font-bold">CTR</span>
                        </SortableHeader>
                        <SortableHeader field="conversions">
                          <span className="font-bold">Conversiones</span>
                        </SortableHeader>
                        <SortableHeader field="conversionsValue">
                          <span className="font-bold">Valor Conv.</span>
                        </SortableHeader>
                        <SortableHeader field="videoViews">
                          <span className="font-bold">Vistas Video</span>
                        </SortableHeader>
                        <SortableHeader field="engagementRate">
                          <span className="font-bold">Engagement</span>
                        </SortableHeader>
                        <TableHead
                          className="sticky right-0 border-l-2 border-r-2 border-t-2 w-20 text-center px-4 font-bold whitespace-nowrap"
                          style={{
                            backgroundColor: "#12BAA9",
                            borderLeftColor: "#12BAA9",
                            borderRightColor: "#12BAA9",
                            borderTopColor: "#12BAA9",
                            color: "white",
                          }}
                        >
                          IA
                        </TableHead>
                        <TableHead className="w-8 font-bold whitespace-nowrap"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAssetGroups.map((assetGroup) => (
                        <TableRow
                          key={assetGroup.id}
                          className="hover:bg-muted/50 cursor-pointer"
                          onClick={() =>
                            onNavigationChange({
                              level: "ads",
                              selectedCampaign: navigation.selectedCampaign,
                              selectedAdGroup: assetGroup.id,
                              campaignName: navigation.campaignName,
                              adGroupName: assetGroup.assetGroupName,
                            })
                          }
                        >
                          <TableCell className="font-medium">
                            {assetGroup.assetGroupName}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(assetGroup.cost)}
                          </TableCell>
                          <TableCell>
                            {assetGroup.impressions.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {assetGroup.clicks.toLocaleString()}
                          </TableCell>
                          <TableCell>{assetGroup.ctr.toFixed(2)}%</TableCell>
                          <TableCell>
                            {Math.round(assetGroup.conversions)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(assetGroup.conversionsValue)}
                          </TableCell>
                          <TableCell>
                            {assetGroup.videoViews.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            {assetGroup.engagementRate.toFixed(2)}%
                          </TableCell>
                          <TableCell
                            className="sticky right-0 border-l-2 border-r-2 border-t-2 border-b-2 text-center px-4 bg-white hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                            style={{
                              borderLeftColor: "#12BAA9",
                              borderRightColor: "#12BAA9",
                              borderTopColor: "#12BAA9",
                              borderBottomColor: "#12BAA9",
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const aiButton =
                                e.currentTarget.querySelector("button");
                              if (aiButton) {
                                (aiButton as HTMLButtonElement).click();
                              }
                            }}
                          >
                            <div className="flex justify-center group">
                              <AIIndicator type="adgroup" id={assetGroup.id} />
                            </div>
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <PaginationControls
                currentPage={currentPageAssetGroups}
                totalPages={totalAssetGroupPages}
                totalItems={totalAssetGroups}
                itemsPerPage={ITEMS_PER_PAGE}
                itemName="grupos de recursos"
                onPageChange={setCurrentPageAssetGroups}
              />
            </CardContent>
          </Card>
        </div>
      );
    }
    // Si NO es Performance Max, mostrar Ad Groups normales
    if (adGroupsLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando grupos de anuncios...</span>
        </div>
      );
    }

    if (error) {
      return (
        <ErrorDisplay
          message={error}
          onRetry={() =>
            navigation.selectedCampaign &&
            loadAdGroups(navigation.selectedCampaign)
          }
        />
      );
    }

    if (adGroups.length === 0) {
      return (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              No se encontraron grupos de anuncios para esta campaña
            </p>
            <Button
              onClick={() =>
                navigation.selectedCampaign &&
                loadAdGroups(navigation.selectedCampaign)
              }
              variant="outline"
            >
              Reintentar
            </Button>
          </div>
        </div>
      );
    }

    const filteredAdGroups = adGroups.filter((adGroup) => {
      const matchesSearch = (adGroup.name || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      return matchesSearch;
    });

    const sortedAdGroups = sortData(filteredAdGroups);

    const totalAdGroups = sortedAdGroups.length;
    const totalAdGroupPages = Math.ceil(totalAdGroups / ITEMS_PER_PAGE);
    const startIndexAdGroups = (currentPageAdGroups - 1) * ITEMS_PER_PAGE;
    const paginatedAdGroups = sortedAdGroups.slice(
      startIndexAdGroups,
      startIndexAdGroups + ITEMS_PER_PAGE
    );

    return (
      <div className="space-y-0">
        <div className="bg-primary text-primary-foreground px-4 sm:px-6 py-4 rounded-t-lg">
          <div className="flex flex-row gap-2 sm:gap-3 items-center overflow-x-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigationChange({ level: "campaigns" })}
              className="bg-white hover:bg-primary/10 text-primary border-white shrink-0 transition-all"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Volver</span>
            </Button>

            <Breadcrumb>
              <BreadcrumbList className="text-base sm:text-xl whitespace-nowrap">
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className="cursor-pointer hover:text-primary-foreground/80 text-primary-foreground font-semibold"
                    onClick={() => onNavigationChange({ level: "campaigns" })}
                  >
                    Campañas
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-primary-foreground/60" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-primary-foreground font-semibold">
                    {navigation.campaignName || "Campaña"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        <Card className="rounded-t-none border-t-0">
          <CardContent className="p-6">
            <div className="flex flex-row gap-3 justify-between items-center mb-6">
              <div className="relative flex-1 max-w-[200px] sm:max-w-[280px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar grupos de anuncios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isMobile ? (
              <div className="space-y-3">
                {paginatedAdGroups.map((adGroup) => (
                  <Card
                    key={adGroup.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() =>
                      onNavigationChange({
                        level: "ads",
                        selectedCampaign: navigation.selectedCampaign,
                        selectedAdGroup: adGroup.id,
                        campaignName: navigation.campaignName,
                        adGroupName: adGroup.name,
                      })
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start gap-2 mb-3">
                        <h3 className="font-medium text-sm flex-1 overflow-hidden break-words line-clamp-2">
                          {adGroup.name}
                        </h3>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">Coste:</span>
                          <div className="font-medium">
                            {formatCurrency(adGroup.spend)}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CPC:</span>
                          <div className="font-medium">
                            {formatCurrency(adGroup.cpc || 0)}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Impresiones:
                          </span>
                          <div className="font-medium">
                            {adGroup.impressions.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Clics:</span>
                          <div className="font-medium">
                            {adGroup.clicks.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CTR:</span>
                          <div className="font-medium">
                            {(adGroup.ctr || 0).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Tasa de Conversión:
                          </span>
                          <div className="font-medium">
                            {adGroup.tasa_conversion.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Conversiones:
                        </span>
                        <div className="font-medium">
                          {Math.round(adGroup.conversions || 0)}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Coste/Conv:
                        </span>
                        <div className="font-medium">
                          {adGroup.coste_por_conversion.toFixed(2)}€
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">ROAS:</span>
                        <div className="font-medium">
                          {adGroup.roas.toFixed(2)}
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between">
                          <AIIndicator type="adgroup" id={adGroup.id} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-full table-auto">
                  <TableHeader>
                    <TableRow>
                      <SortableHeader field="name">
                        <span className="font-bold">Grupo de Anuncios</span>
                      </SortableHeader>
                      <SortableHeader field="spend">
                        <span className="font-bold">Coste</span>
                      </SortableHeader>
                      <SortableHeader field="cpc">
                        <span className="font-bold">CPC</span>
                      </SortableHeader>
                      <SortableHeader field="impressions">
                        <span className="font-bold">Impresiones</span>
                      </SortableHeader>
                      <SortableHeader field="clicks">
                        <span className="font-bold">Clics</span>
                      </SortableHeader>
                      <SortableHeader field="ctr">
                        <span className="font-bold">CTR</span>
                      </SortableHeader>
                      <SortableHeader field="tasa_conversion">
                        <span className="font-bold">Tasa de Conversión</span>
                      </SortableHeader>
                      <SortableHeader field="conversions">
                        <span className="font-bold">Conversiones</span>
                      </SortableHeader>
                      <SortableHeader field="coste_por_conversion">
                        <span className="font-bold">Coste/Conv</span>
                      </SortableHeader>
                      <SortableHeader field="roas">
                        <span className="font-bold">ROAS</span>
                      </SortableHeader>
                      <TableHead
                        className="sticky right-0 border-l-2 border-r-2 border-t-2 w-20 text-center px-4 font-bold"
                        style={{
                          backgroundColor: "#12BAA9",
                          borderLeftColor: "#12BAA9",
                          borderRightColor: "#12BAA9",
                          borderTopColor: "#12BAA9",
                          color: "white",
                        }}
                      >
                        IA
                      </TableHead>
                      <TableHead className="w-8 font-bold whitespace-nowrap"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAdGroups.map((adGroup) => (
                      <TableRow
                        key={adGroup.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() =>
                          onNavigationChange({
                            level: "ads",
                            selectedCampaign: navigation.selectedCampaign,
                            selectedAdGroup: adGroup.id,
                            campaignName: navigation.campaignName,
                            adGroupName: adGroup.name,
                          })
                        }
                      >
                        <TableCell className="font-medium">
                          {adGroup.name}
                        </TableCell>
                        <TableCell>{formatCurrency(adGroup.spend)}</TableCell>
                        <TableCell>
                          {formatCurrency(adGroup.cpc || 0)}
                        </TableCell>
                        <TableCell>
                          {adGroup.impressions.toLocaleString()}
                        </TableCell>
                        <TableCell>{adGroup.clicks.toLocaleString()}</TableCell>
                        <TableCell>{(adGroup.ctr || 0).toFixed(2)}%</TableCell>
                        <TableCell>
                          {(adGroup.tasa_conversion || 0).toFixed(2)}%
                        </TableCell>
                        <TableCell>
                          {Math.round(adGroup.conversions || 0)}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(adGroup.coste_por_conversion || 0)}
                        </TableCell>
                        <TableCell>{(adGroup.roas || 0).toFixed(2)}</TableCell>

                        <TableCell
                          className="sticky right-0 border-l-2 border-r-2 border-t-2 border-b-2 text-center px-4 bg-white hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                          style={{
                            borderLeftColor: "#12BAA9",
                            borderRightColor: "#12BAA9",
                            borderTopColor: "#12BAA9",
                            borderBottomColor: "#12BAA9",
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const aiButton =
                              e.currentTarget.querySelector("button");
                            if (aiButton) {
                              (aiButton as HTMLButtonElement).click();
                            }
                          }}
                        >
                          <div className="flex justify-center group">
                            <AIIndicator type="adgroup" id={adGroup.id} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <ChevronRight className="h-4 w-4" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <PaginationControls
              currentPage={currentPageAdGroups}
              totalPages={totalAdGroupPages}
              totalItems={totalAdGroups}
              itemsPerPage={ITEMS_PER_PAGE}
              itemName="grupos de anuncios"
              onPageChange={setCurrentPageAdGroups}
            />
          </CardContent>
        </Card>
      </div>
    );
  }
  // RENDERIZADO DE ANUNCIOS O ASSETS
  if (navigation.level === "ads") {
    const campaignType = getSelectedCampaignType();
    const isPmax = campaignType === "PERFORMANCE_MAX";

    // Si es Performance Max, mostrar Assets
    if (isPmax) {
      if (assetsLoading) {
        return (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Cargando recursos...</span>
          </div>
        );
      }

      if (error) {
        return (
          <ErrorDisplay
            message={error}
            onRetry={() =>
              navigation.selectedAdGroup &&
              loadAssets(navigation.selectedAdGroup)
            }
          />
        );
      }

      const filteredAssets = assets.filter((asset) => {
        const matchesSearch =
          (asset.textValue || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (asset.fieldType || '').toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
      });

      const sortedAssets = sortData(filteredAssets);

      const totalAssets = sortedAssets.length;
      const totalAssetPages = Math.ceil(totalAssets / ITEMS_PER_PAGE);
      const startIndexAssets = (currentPageAssets - 1) * ITEMS_PER_PAGE;
      const paginatedAssets = sortedAssets.slice(
        startIndexAssets,
        startIndexAssets + ITEMS_PER_PAGE
      );

      return (
        <div className="space-y-0">
          <div className="bg-primary text-primary-foreground px-4 sm:px-6 py-4 rounded-t-lg">
            <div className="flex flex-row gap-2 sm:gap-3 items-center overflow-x-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  onNavigationChange({
                    level: "adgroups",
                    selectedCampaign: navigation.selectedCampaign,
                    campaignName: navigation.campaignName,
                  })
                }
                className="bg-white hover:bg-primary/10 text-primary border-white shrink-0 transition-all"
              >
                <ArrowLeft className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Volver</span>
              </Button>

              <Breadcrumb>
                <BreadcrumbList className="text-base sm:text-xl whitespace-nowrap">
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      className="cursor-pointer hover:text-primary-foreground/80 text-primary-foreground font-semibold"
                      onClick={() => onNavigationChange({ level: "campaigns" })}
                    >
                      Campañas
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-primary-foreground/60" />
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      className="cursor-pointer hover:text-primary-foreground/80 text-primary-foreground font-semibold"
                      onClick={() =>
                        onNavigationChange({
                          level: "adgroups",
                          selectedCampaign: navigation.selectedCampaign,
                          campaignName: navigation.campaignName,
                        })
                      }
                    >
                      {navigation.campaignName || "Campaña"}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="text-primary-foreground/60" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="text-primary-foreground font-semibold">
                      {navigation.adGroupName || "Grupo de Recursos"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>

          <Card className="rounded-t-none border-t-0">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center">
                <div className="relative flex-1 max-w-[200px] sm:max-w-[280px] ml-auto">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar recursos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {isMobile ? (
                <div className="space-y-3">
                  {paginatedAssets.map((asset) => (
                    <Card
                      key={asset.id}
                      className="hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4">
                        <div className="mb-3">
                          {getFieldTypeBadge(asset.fieldType)}
                          {asset.textValue && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAsset(asset);
                                setIsAssetModalOpen(true);
                              }}
                              className="text-sm font-medium text-blue-600 hover:underline mt-2 block text-left"
                            >
                              {asset.textValue}
                            </button>
                          )}
                          {asset.youtubeLink && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAsset(asset);
                                setIsAssetModalOpen(true);
                              }}
                              className="flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver vídeo de YouTube
                            </button>
                          )}
                          {asset.imageUrl && (
                            <a
                              href={asset.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-sm text-blue-600 hover:underline mt-2 flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver imagen
                            </a>
                          )}
                        </div>

                        <div className="flex gap-2 mb-3 items-center justify-between">
                          {getPerformanceLabelBadge(
                            calculatePerformanceLabel(asset)
                          )}
                          <AIIndicator type="ad" id={asset.id} />
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-muted-foreground">
                              Impresiones:
                            </span>
                            <div className="font-medium">
                              {asset.impressions.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Clics:
                            </span>
                            <div className="font-medium">
                              {asset.clicks.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Coste:
                            </span>
                            <div className="font-medium">
                              {formatCurrency(asset.cost)}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground">
                              Conversiones:
                            </span>
                            <div className="font-medium">
                              {Math.round(asset.conversions)}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-full table-auto">
                    <TableHeader>
                      <TableRow>
                        <SortableHeader field="fieldType">
                          <span className="font-bold">Tipo</span>
                        </SortableHeader>
                        <SortableHeader field="textValue">
                          <span className="font-bold">Contenido</span>
                        </SortableHeader>
                        <SortableHeader field="performanceLabel">
                          <span className="font-bold">Rendimiento</span>
                        </SortableHeader>
                        <SortableHeader field="impressions">
                          <span className="font-bold">Impresiones</span>
                        </SortableHeader>
                        <SortableHeader field="clicks">
                          <span className="font-bold">Clics</span>
                        </SortableHeader>
                        <SortableHeader field="cost">
                          <span className="font-bold">Coste</span>
                        </SortableHeader>
                        <SortableHeader field="conversions">
                          <span className="font-bold">Conversiones</span>
                        </SortableHeader>
                        <TableHead
                          className="sticky right-0 border-l-2 border-r-2 border-t-2 w-20 text-center px-4 font-bold"
                          style={{
                            backgroundColor: "#12BAA9",
                            borderLeftColor: "#12BAA9",
                            borderRightColor: "#12BAA9",
                            borderTopColor: "#12BAA9",
                            color: "white",
                          }}
                        >
                          IA
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAssets.map((asset) => (
                        <TableRow key={asset.id} className="hover:bg-muted/50">
                          <TableCell>
                            {getFieldTypeBadge(asset.fieldType)}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {asset.textValue ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAsset(asset);
                                  setIsAssetModalOpen(true);
                                }}
                                className="font-medium text-blue-600 hover:underline text-left truncate block w-full"
                              >
                                <span className="block truncate max-w-[280px]">
                                  {asset.textValue}
                                </span>
                              </button>
                            ) : asset.youtubeLink ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAsset(asset);
                                  setIsAssetModalOpen(true);
                                }}
                                className="flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span className="truncate">
                                  Ver vídeo de YouTube
                                </span>
                              </button>
                            ) : asset.imageUrl ? (
                              <a
                                href={asset.imageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-blue-600 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span className="truncate">Ver imagen</span>
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>

                          <TableCell>
                            {getPerformanceLabelBadge(
                              calculatePerformanceLabel(asset)
                            )}
                          </TableCell>
                          <TableCell>
                            {asset.impressions.toLocaleString()}
                          </TableCell>
                          <TableCell>{asset.clicks.toLocaleString()}</TableCell>
                          <TableCell>{formatCurrency(asset.cost)}</TableCell>
                          <TableCell>{Math.round(asset.conversions)}</TableCell>
                          <TableCell
                            className="sticky right-0 border-l-2 border-r-2 border-t-2 border-b-2 text-center px-4 bg-white hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                            style={{
                              borderLeftColor: "#12BAA9",
                              borderRightColor: "#12BAA9",
                              borderTopColor: "#12BAA9",
                              borderBottomColor: "#12BAA9",
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const aiButton =
                                e.currentTarget.querySelector("button");
                              if (aiButton) {
                                (aiButton as HTMLButtonElement).click();
                              }
                            }}
                          >
                            <div className="flex justify-center group">
                              <AIIndicator type="ad" id={asset.id} />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <PaginationControls
                currentPage={currentPageAssets}
                totalPages={totalAssetPages}
                totalItems={totalAssets}
                itemsPerPage={ITEMS_PER_PAGE}
                itemName="recursos"
                onPageChange={setCurrentPageAssets}
              />
            </CardContent>
          </Card>
          <AssetPreviewModal
            asset={selectedAsset}
            isOpen={isAssetModalOpen}
            onClose={() => {
              setIsAssetModalOpen(false);
              setSelectedAsset(null);
            }}
          />
        </div>
      );
    }
    // Si NO es Performance Max, mostrar Ads normales
    if (adsLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando anuncios...</span>
        </div>
      );
    }

    if (error) {
      return (
        <ErrorDisplay
          message={error}
          onRetry={() =>
            navigation.selectedAdGroup && loadAds(navigation.selectedAdGroup)
          }
        />
      );
    }

    const filteredAds = ads.filter((ad) => {
      const matchesSearch =
        (ad.headline1 || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ad.headline2 || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ad.name && ad.name.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesSearch;
    });

    const sortedAds = sortData(filteredAds);

    const totalAds = sortedAds.length;
    const totalAdPages = Math.ceil(totalAds / ITEMS_PER_PAGE);
    const startIndexAds = (currentPageAds - 1) * ITEMS_PER_PAGE;
    const paginatedAds = sortedAds.slice(
      startIndexAds,
      startIndexAds + ITEMS_PER_PAGE
    );

    return (
      <div className="space-y-0">
        <div className="bg-primary text-primary-foreground px-4 sm:px-6 py-4 rounded-t-lg">
          <div className="flex flex-row gap-2 sm:gap-3 items-center overflow-x-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                onNavigationChange({
                  level: "adgroups",
                  selectedCampaign: navigation.selectedCampaign,
                  campaignName: navigation.campaignName,
                })
              }
              className="bg-white hover:bg-primary/10 text-primary border-white shrink-0 transition-all"
            >
              <ArrowLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Volver</span>
            </Button>

            <Breadcrumb>
              <BreadcrumbList className="text-base sm:text-xl whitespace-nowrap">
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className="cursor-pointer hover:text-primary-foreground/80 text-primary-foreground font-semibold"
                    onClick={() => onNavigationChange({ level: "campaigns" })}
                  >
                    Campañas
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-primary-foreground/60" />
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className="cursor-pointer hover:text-primary-foreground/80 text-primary-foreground font-semibold"
                    onClick={() =>
                      onNavigationChange({
                        level: "adgroups",
                        selectedCampaign: navigation.selectedCampaign,
                        campaignName: navigation.campaignName,
                      })
                    }
                  >
                    {navigation.campaignName || "Campaña"}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-primary-foreground/60" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="text-primary-foreground font-semibold">
                    {navigation.adGroupName || "Grupo de anuncios"}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>

        <Card className="rounded-t-none border-t-0">
          <CardContent className="p-6">
            <div className="flex flex-row gap-3 justify-between items-center mb-6">
              <div className="relative flex-1 max-w-[200px] sm:max-w-[280px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar anuncios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isMobile ? (
              <div className="space-y-3">
                {paginatedAds.map((ad) => (
                  <Card
                    key={ad.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleAdClick(ad)}
                  >
                    <CardContent className="p-4">
                      <div className="mb-3">
                        <div className="font-medium text-blue-600 text-sm mb-1 overflow-hidden text-ellipsis line-clamp-2">
                          {ad.headline1}
                        </div>
                        <div className="font-medium text-blue-600 text-sm mb-2 overflow-hidden text-ellipsis line-clamp-2">
                          {ad.headline2}
                        </div>
                        {ad.description && (
                          <div className="text-xs text-muted-foreground overflow-hidden text-ellipsis line-clamp-2">
                            {ad.description}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 mb-3 items-center justify-between">
                        <AIIndicator type="ad" id={ad.id} />
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-muted-foreground">
                            Impresiones:
                          </span>
                          <div className="font-medium">
                            {ad.impressions.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Clics:</span>
                          <div className="font-medium">
                            {ad.clicks.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CTR:</span>
                          <div className="font-medium">
                            {(ad.ctr || 0).toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">CPC:</span>
                          <div className="font-medium">
                            {formatCurrency(ad.cpc || 0)}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            Conversiones:
                          </span>
                          <div className="font-medium">
                            {Math.round(ad.conversions || 0)}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">URL:</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="h-auto p-0 text-xs"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a
                              href={ad.finalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-full table-auto">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px] font-bold whitespace-nowrap">
                        Anuncio
                      </TableHead>
                      <SortableHeader field="impressions">
                        <span className="font-bold">Impresiones</span>
                      </SortableHeader>
                      <SortableHeader field="clicks">
                        <span className="font-bold">Clics</span>
                      </SortableHeader>
                      <SortableHeader field="ctr">
                        <span className="font-bold">CTR</span>
                      </SortableHeader>
                      <SortableHeader field="cpc">
                        <span className="font-bold">CPC</span>
                      </SortableHeader>
                      <SortableHeader field="conversions">
                        <span className="font-bold">Conversiones</span>
                      </SortableHeader>
                      <TableHead
                        className="sticky right-0 border-l-2 border-r-2 border-t-2 w-20 text-center px-4 font-bold"
                        style={{
                          backgroundColor: "#12BAA9",
                          borderLeftColor: "#12BAA9",
                          borderRightColor: "#12BAA9",
                          borderTopColor: "#12BAA9",
                          color: "white",
                        }}
                      >
                        IA
                      </TableHead>
                      <TableHead className="w-16 font-bold whitespace-nowrap">
                        URL Final
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAds.map((ad) => (
                      <TableRow
                        key={ad.id}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleAdClick(ad)}
                      >
                        <TableCell>
                          <div className="space-y-1">
                            {ad.name && (
                              <div className="font-medium text-blue-600">
                                {ad.name}
                              </div>
                            )}
                            <div className="font-medium text-blue-600">
                              {ad.headline1}
                            </div>
                            {ad.headline2 && (
                              <div className="font-medium text-blue-600">
                                {ad.headline2}
                              </div>
                            )}
                            {ad.description && (
                              <div className="text-sm text-muted-foreground">
                                {ad.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{ad.impressions.toLocaleString()}</TableCell>
                        <TableCell>{ad.clicks.toLocaleString()}</TableCell>
                        <TableCell>{(ad.ctr || 0).toFixed(1)}%</TableCell>
                        <TableCell>{formatCurrency(ad.cpc || 0)}</TableCell>
                        <TableCell>{Math.round(ad.conversions || 0)}</TableCell>
                        <TableCell
                          className="sticky right-0 border-l-2 border-r-2 border-t-2 border-b-2 text-center px-4 bg-white hover:bg-gray-50 cursor-pointer transition-colors duration-200"
                          style={{
                            borderLeftColor: "#12BAA9",
                            borderRightColor: "#12BAA9",
                            borderTopColor: "#12BAA9",
                            borderBottomColor: "#12BAA9",
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const aiButton =
                              e.currentTarget.querySelector("button");
                            if (aiButton) {
                              (aiButton as HTMLButtonElement).click();
                            }
                          }}
                        >
                          <div className="flex justify-center group">
                            <AIIndicator type="ad" id={ad.id} />
                          </div>
                        </TableCell>
                        <TableCell>
                          {ad.finalUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              asChild
                              onClick={(e) => e.stopPropagation()}
                            >
                              <a
                                href={ad.finalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <PaginationControls
              currentPage={currentPageAds}
              totalPages={totalAdPages}
              totalItems={totalAds}
              itemsPerPage={ITEMS_PER_PAGE}
              itemName="anuncios"
              onPageChange={setCurrentPageAds}
            />

            <AdDetailsModal
              ad={selectedAd}
              isOpen={isAdModalOpen}
              onClose={() => setIsAdModalOpen(false)}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

export default HierarchicalCampaignsList;
