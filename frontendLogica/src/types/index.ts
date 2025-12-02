// User related types
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface PendingRegistration {
  email: string;
  token: string;
  expiresAt: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Google Ads related types
export interface GoogleAdsAccount {
  id: string;
  accountId: string;
  accountName: string;
  connected: boolean;
  userId: string;
  refreshToken: string;
  createdAt: string;
  lastSyncedAt: string | null;
  accountType: 'STANDARD' | 'MCC'; // Nuevo campo para distinguir tipos de cuenta
  parentAccountId?: string; // ID de la cuenta MCC padre si es una subcuenta
}

export interface Keyword extends Record<string, unknown> {
  keywordId: string;
  keywordText: string;
  customerId: string;
  campaignId: string;
  campaignName: string;
  adGroupId: string;
  adGroupName: string;
  matchType: number;  // ✅ Debe ser number
  status: string;
  isNegative?: boolean;
  
  // Métricas básicas
  impressions: number;
  clicks: number;
  costMicros: number;
  costEuros: number;
  conversions: number;
  ctr: number | null;
  averageCpcMicros: number | null;
  averageCpcEuros: number | null;
  qualityScore: number | null;
  
  // ✅ Nuevos campos de conversión
  conversionsValue: number;
  allConversions: number;
  allConversionsValue: number;
  
  // ✅ KPIs calculados
  roas: number;
  costePorConversion: number;
  tasaConversion: number;
}





export type CampaignStatus = 'UNSPECIFIED' | 'UNKNOWN' | 'ENABLED' | 'PAUSED' | 'REMOVED';

export const CampaignStatusMap: Record<number, CampaignStatus> = {
  0: 'UNSPECIFIED',
  1: 'UNKNOWN',
  2: 'ENABLED',
  3: 'PAUSED',
  4: 'REMOVED',
};


export type AdvertisingChannelType = 
  | 'UNSPECIFIED'
  | 'SEARCH'
  | 'DISPLAY'
  | 'SHOPPING'
  | 'HOTEL'
  | 'VIDEO'
  | 'MULTI_CHANNEL'
  | 'LOCAL'
  | 'SMART'
  | 'PERFORMANCE_MAX'
  | 'LOCAL_SERVICES'
  | 'DISCOVERY'
  | 'DEMAND_GEN'
  | 'UNKNOWN';

export const AdvertisingChannelTypeMap: Record<number, AdvertisingChannelType> = {
  0: 'UNSPECIFIED',
  1: 'UNKNOWN',
  2: 'SEARCH',
  3: 'DISPLAY',
  4: 'SHOPPING',
  5: 'HOTEL',
  6: 'VIDEO',
  7: 'MULTI_CHANNEL',
  8: 'LOCAL',
  9: 'SMART',
  10: 'PERFORMANCE_MAX',
  11: 'LOCAL_SERVICES',
  12: 'DISCOVERY',
  13: 'DEMAND_GEN',

};

export interface CampaignMetrics {
  id: number;
  customer_id: string;
  campaign_id: number;
  campaign_name: string | null;
  campaign_status: number | null;
  campaign_type: number | null;
  location_option_setting: string | null;
  date: string; // format 'YYYY-MM-DD'
  impressions: number;
  clicks: number;
  ctr: number;
  average_cpc_micros: number;
  cost_micros: number;
  conversions: number;
  conversion_rate: number;
  cost_per_conversion_micros: number;
  all_conversions: number;
  value_per_all_conversions: number;
  search_impression_share: number;
  search_rank_lost_impression_share: number;
  search_budget_lost_impression_share: number;
  extra_metrics: string | null; // JSON string? Potser cal parsejar-ho
  resources_metrics: string | null; // JSON string?
  created_at: string; // o Date si es parseja
  updated_at: string;
  video_views: number;
  video_view_rate: number;
  engagements: number;
  engagement_rate: number;
  phone_calls: number;
  phone_impressions: number;
  phone_through_rate: number;
  view_through_conversions: number;
  percent_new_visitors: number;
  average_time_on_site: number;
  bidding_strategy: string | null;
  budget_micros: number;
  geo_target_region: string | null;
}


export interface Campaign {
  id: string;
  accountId: string;
  campaignId: string;
  name: string;
  type: AdvertisingChannelType;
  status: CampaignStatus;
  budget: number;
  startDate: string;
  endDate: string | null;
  lastSyncedAt: string;
}

export interface AdGroup {
  id: string;
  campaignId: string;
  adGroupId: string;
  name: string;
  status: 'ENABLED' | 'PAUSED' | 'REMOVED';
}

export interface Ad {
  adGroupId: string;
  adId: string;
  headline: string;
  description: string;
  status: string;

  // Datos adicionales desde la API
  adGroupName?: string;
  finalUrl?: string;

  headlines?: string[];
  descriptions?: string[];
  paths?: string[];
  callouts?: string[];
  sitelinks?: Array<{ title: string; url: string }>;
  images?: Array<{ url: string; type: string }>;
  videos?: Array<{ url: string; type: string }>;

  // Métricas
  impressions?: number;
  clicks?: number;
  conversions?: number;
  ctr?: number;
  cpc?: number;
}


export interface Metrics {
  id: string;
  entityId: string; // Could be campaign ID, ad group ID, or ad ID
  entityType: 'CAMPAIGN' | 'ADGROUP' | 'AD';
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
  date: string;
}

// AI Feedback related types
export interface AiFeedback {
  id: string;
  entityId: string; // Could be campaign ID, ad group ID, or ad ID
  entityType: 'CAMPAIGN' | 'ADGROUP' | 'AD';
  feedback: string;
  recommendations: string[];
  createdAt: string;
}

export interface Recomendacion {
  id: number;
  customer_id: number;
  titulo: string;
  descripcion: string;
  categoria: string;
  prioridad: string;
  impacto_estimado: string;
  tipo_objeto: string;
  objeto_id: number | null;
  estado: 'pendiente' | 'aplicada' | 'rechazada' | 'fallida';
  fecha_aplicacion: string | null;
  fecha_creacion: string;
   resultado?: {
    estado: "improved" | "no_change" | "worsened";
    mejora_real: string;
    periodo_comparacion: string;
    variacion_kpi: number;
  };
  detalle?: {
    justificacion: string;
    kpi_objetivo: string;
    valor_actual: string;
    valor_esperado: string;
  };
  nombre_objeto?: string;

}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
