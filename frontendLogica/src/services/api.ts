import {
  ApiResponse,
  AuthResponse,
  User,
  GoogleAdsAccount,
  Campaign,
  AiFeedback,
  Recomendacion,
  CampaignMetrics,
  Keyword
} from "@/types";

import { formatDateForAPI } from "@/lib/utils";

// Base API URL - usar env var en prod preferiblemente
const API_BASE_URL = "/api";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  "Content-Type": "application/json",
});

// Helper para manejar respuesta
async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (!response.ok) {
    try {
      const errorData = await response.json();
      return {
        success: false,
        error:
          errorData.message ||
          `Error: ${response.status} ${response.statusText}`,
      };
    } catch {
      return {
        success: false,
        error: `Error: ${response.status} ${response.statusText}`,
      };
    }
  }
  const data = await response.json();
  return { success: true, data };
}

// Auth API
export const authApi = {
  initiateRegistration: async (
    email: string
  ): Promise<ApiResponse<{ message: string }>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  completeRegistration: async (
    token: string,
    email: string,
    name: string,
    password: string
  ): Promise<ApiResponse<AuthResponse>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, name, password }),
      });
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  login: async (
    email: string,
    password: string
  ): Promise<ApiResponse<AuthResponse>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  logout: async (): Promise<ApiResponse<{ message: string }>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

// Google Ads API
export const googleAdsApi = {
  getOAuthUrl: async (): Promise<ApiResponse<{ url: string }>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/google-ads/oauth-url`, {
        headers: getAuthHeaders(),
      });
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  handleOAuthCallback: async (
    code: string
  ): Promise<ApiResponse<GoogleAdsAccount>> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/google-ads/oauth-callback`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ code }),
        }
      );
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  getAccounts: async (): Promise<ApiResponse<GoogleAdsAccount[]>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/google-ads/accounts`, {
        headers: getAuthHeaders(),
      });
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  syncAccount: async (
    accountId: string
  ): Promise<ApiResponse<{ message: string }>> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/google-ads/accounts/${accountId}/sync`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  getCampaigns: async (accountId: string): Promise<ApiResponse<Campaign[]>> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/google-ads/accounts/${accountId}/campaigns`,
        {
          headers: getAuthHeaders(),
        }
      );
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  getFullAccountData: async (
    customerId: string
  ): Promise<ApiResponse<CampaignMetrics[]>> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/google-ads-full-data?customerId=${encodeURIComponent(
          customerId
        )}`,
        {
          headers: getAuthHeaders(),
        }
      );
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

// AI Feedback API
export const aiFeedbackApi = {
  getCampaignFeedback: async (
    campaignId: string
  ): Promise<ApiResponse<AiFeedback>> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/ai-feedback/campaigns/${campaignId}`,
        {
          headers: getAuthHeaders(),
        }
      );
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  generateCampaignFeedback: async (
    campaignId: string
  ): Promise<ApiResponse<AiFeedback>> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/ai-feedback/campaigns/${campaignId}/generate`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        }
      );
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

// User API
export const userApi = {
  getCurrentUser: async (): Promise<ApiResponse<User>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        headers: getAuthHeaders(),
      });
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  updateProfile: async (
    userData: Partial<User>
  ): Promise<ApiResponse<User>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(userData),
      });
      return handleResponse(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

export async function getCampaignMetrics(customerId: string) {
  const url = `${API_BASE_URL}/metrics/${customerId}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Error al obtener métricas: ${response.statusText}`);
  }

  return await response.json();
}

export async function getCampaignMetricsByCustomer(
  customerId: string,
  from: string,
  to: string
) {
  const url = `${API_BASE_URL}/campaign-metrics/${customerId}?from=${encodeURIComponent(
    from
  )}&to=${encodeURIComponent(to)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Error al obtener métricas de campañas: ${response.statusText}`
    );
  }

  return await response.json();
}

// ✅ Fetch de keywords por campaña
export const fetchKeywords = async (
  campaignId: string,
  dateRange: { from: Date; to: Date }
): Promise<Keyword[]> => {
  if (!campaignId) {
    throw new Error("campaignId es requerido");
  }

  const from = formatDateForAPI(dateRange.from);
  const to = formatDateForAPI(dateRange.to);

  const url = `/api/campaigns/${encodeURIComponent(campaignId)}/keywords?from=${from}&to=${to}`;
  console.log("Haciendo fetch a keywords por campaña date : from" , from , "to:", to)
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error al obtener keywords: ${response.status} - ${response.statusText}`);
  }

  return await response.json();
};


// ✅ Fetch de keywords por ad group
export const fetchKeywordsByAdGroup = async (
  adGroupId: string,
  dateRange: { from: Date; to: Date }
): Promise<Keyword[]> => {
  if (!adGroupId) {
    throw new Error("adGroupId es requerido");
  }

  const from =formatDateForAPI(dateRange.from);
  const to = formatDateForAPI(dateRange.to);

  const url = `/api/ad-groups/${encodeURIComponent(adGroupId)}/keywords?from=${from}&to=${to}`;
  console.log("Haciendo fetch a keywords por adGroup date : from" , from , "to:", to)
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error al obtener keywords: ${response.status} - ${response.statusText}`);
  }

  return await response.json();
};


export async function fetchAccountMetrics(
  customerId: string,
  dateRange?: { from: Date; to: Date }
) {
  if (!customerId) throw new Error("customerId es requerido");

  let url = `${API_BASE_URL}/account-metrics/${customerId}`;

  if (dateRange) {
    const from = dateRange.from.toISOString().split("T")[0];
    const to = dateRange.to.toISOString().split("T")[0];
    url += `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
}

export async function fetchRecomendaciones(
  customer_id: number
): Promise<Recomendacion[]> {
  if (!customer_id) {
    throw new Error("El parámetro customer_id es requerido");
  }

  const response = await fetch(`/api/recomendaciones/${customer_id}`);

  if (!response.ok) {
    throw new Error(
      `Error al obtener las recomendaciones: ${response.statusText}`
    );
  }

  const data = await response.json();
  
  // Validar que data sea un array
  if (!Array.isArray(data)) {
    console.error('❌ La API no devolvió un array:', data);
    throw new Error('Formato de respuesta inválido: se esperaba un array');
  }
  
  return data;
}

export async function fetchAppliedRecommendations(
  customer_id: number
): Promise<Recomendacion[]> {
  if (!customer_id) {
    throw new Error("El parámetro customer_id es requerido");
  }

  const response = await fetch(`/api/recomendaciones-aplicadas/${customer_id}`);

  if (!response.ok) {
    throw new Error(
      `Error al obtener las recomendaciones aplicadas: ${response.statusText}`
    );
  }

  const data = await response.json();
  
  // Validar que data sea un array
  if (!Array.isArray(data)) {
    console.error('❌ La API no devolvió un array:', data);
    throw new Error('Formato de respuesta inválido: se esperaba un array');
  }
  
  return data;
}

export async function applyRecommendation(
  id: number,
  resultado: {
    estado: "improved" | "no_change" | "worsened";
    mejora_real: string;
    periodo_comparacion: string;
    variacion_kpi: number;
  }
): Promise<{ message: string; id: number }> {
  if (!id) {
    throw new Error("El parámetro id es requerido");
  }

  const response = await fetch(`/api/recomendaciones/${id}/aplicar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // 👈 Añadir esto si usas cookies/sesiones
    body: JSON.stringify({ resultado }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.message || `Error HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

export const fetchGoogleAccounts = async () => {
  const response = await fetch("/api/google-accounts", {
    credentials: "include", // Para enviar cookies si usas sesiones
  });

  if (!response.ok) {
    throw new Error("Error al obtener las cuentas de Google Ads");
  }

  const data = await response.json();

  return data.accounts;
};
