import { GoogleAdsApi } from "google-ads-api";
import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";
dotenv.config();

// Google OAuth Client
export const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Google Ads API Client
export const googleAdsClient = new GoogleAdsApi({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    developer_token: process.env.GOOGLE_DEVELOPER_TOKEN,
    use_rest: true,
});

export const googleAdsConfig = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    developerToken: process.env.GOOGLE_DEVELOPER_TOKEN,
};
