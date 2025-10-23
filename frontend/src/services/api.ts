
import { ApiResponse, AuthResponse, User, GoogleAdsAccount, Campaign, AiFeedback } from "@/types";

// Base API URL - in a real app, this would be an environment variable
const API_BASE_URL = "/api";

// Helper function for handling API responses
async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  if (!response.ok) {
    // Try to parse the error response
    try {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.message || `Error: ${response.status} ${response.statusText}`
      };
    } catch (e) {
      // If we can't parse the error, return a generic error
      return {
        success: false,
        error: `Error: ${response.status} ${response.statusText}`
      };
    }
  }
  
  const data = await response.json();
  return {
    success: true,
    data
  };
}

// Auth API
export const authApi = {
  // Start registration process with email
  initiateRegistration: async (email: string): Promise<ApiResponse<{ message: string }>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      
      return handleResponse<{ message: string }>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
  
  // Complete registration with token and user details
  completeRegistration: async (
    token: string,
    email: string,
    name: string,
    password: string
  ): Promise<ApiResponse<AuthResponse>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, email, name, password }),
      });
      
      return handleResponse<AuthResponse>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
  
  // Login with email and password
  login: async (email: string, password: string): Promise<ApiResponse<AuthResponse>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      
      return handleResponse<AuthResponse>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
  
  // Logout
  logout: async (): Promise<ApiResponse<{ message: string }>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      return handleResponse<{ message: string }>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
};

// Google Ads API
export const googleAdsApi = {
  // Get OAuth URL for connecting a new account
  getOAuthUrl: async (): Promise<ApiResponse<{ url: string }>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/google-ads/oauth-url`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      return handleResponse<{ url: string }>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
  
  // Handle OAuth callback with code
  handleOAuthCallback: async (code: string): Promise<ApiResponse<GoogleAdsAccount>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/google-ads/oauth-callback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ code }),
      });
      
      return handleResponse<GoogleAdsAccount>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
  
  // Get all connected accounts for current user
  getAccounts: async (): Promise<ApiResponse<GoogleAdsAccount[]>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/google-ads/accounts`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      return handleResponse<GoogleAdsAccount[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
  
  // Sync account data (trigger manual sync)
  syncAccount: async (accountId: string): Promise<ApiResponse<{ message: string }>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/google-ads/accounts/${accountId}/sync`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      return handleResponse<{ message: string }>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
  
  // Get campaigns for an account
  getCampaigns: async (accountId: string): Promise<ApiResponse<Campaign[]>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/google-ads/accounts/${accountId}/campaigns`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      return handleResponse<Campaign[]>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
};

// AI Feedback API
export const aiFeedbackApi = {
  // Get AI feedback for a campaign
  getCampaignFeedback: async (campaignId: string): Promise<ApiResponse<AiFeedback>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/ai-feedback/campaigns/${campaignId}`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      return handleResponse<AiFeedback>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
  
  // Generate new AI feedback for a campaign
  generateCampaignFeedback: async (campaignId: string): Promise<ApiResponse<AiFeedback>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/ai-feedback/campaigns/${campaignId}/generate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      return handleResponse<AiFeedback>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
};

// User API
export const userApi = {
  // Get current user profile
  getCurrentUser: async (): Promise<ApiResponse<User>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        headers: {
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      return handleResponse<User>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
  
  // Update user profile
  updateProfile: async (userData: Partial<User>): Promise<ApiResponse<User>> => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(userData),
      });
      
      return handleResponse<User>(response);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
};
