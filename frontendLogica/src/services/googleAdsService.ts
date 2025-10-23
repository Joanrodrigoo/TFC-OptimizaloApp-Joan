// src/services/googleAdsService.ts
import { googleAdsApi } from "@/services/api";

export const fetchGoogleAdsFullData = async (customerId: string) => {
  const response = await googleAdsApi.getFullAccountData(customerId);
  if (!response.success) {
    throw new Error(response.error);
  }
  return response.data;
};

export const syncGoogleAdsAccount = async (accountId: string) => {
  const response = await googleAdsApi.syncAccount(accountId);
  if (!response.success) {
    throw new Error(response.error);
  }
  return response.data;
};

export const fetchAccountDetails = async (accountId: string) => {
  const response = await googleAdsApi.getAccounts();
  if (!response.success) {
    throw new Error(response.error);
  }
  return response.data.find((acc
  ) => acc.id === accountId);
};