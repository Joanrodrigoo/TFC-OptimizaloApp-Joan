import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

// Routes
import webhookRoutes from "./routes/webhook.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import activateSubscriptionRouter from "./routes/activateSubscription.js";
import testPayment from "./services/stripe/stripe_payments_gateway.js";
import checkoutRoutes from "./services/stripe/createCheckoutSession.js";
import logsRouter from "./routes/logs.js";
import campaignsRouter from "./routes/campaigns.js";
import adGroupsRouter from "./routes/adGroups.js";
import assetsRouter from "./routes/assets.js";
import googleAdsDebugRouter from "./routes/googleAdsDebug.js";
import metadataRouter from "./routes/metadata.js";
import analysisRoutes from "./routes/analysis.js";
import syncRoutes from "./routes/sync.js";
import pmaxRoutes from "./routes/pmaxRoutes.js";
import metricsRoutes from "./routes/metrics.js";
import googleAdsAuthRoutes from "./routes/googleAdsAuth.js";



// Middleware
import { authenticateUser } from "./middleware/authenticateUser.js";

const app = express();

// Middlewares
app.use(
    cors({
        origin: "https://optimizalo.app",
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
        exposedHeaders: ["Set-Cookie"],
    })
);

app.use("/webhook", webhookRoutes);

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set("trust proxy", 1);

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: true, // HTTPS
            sameSite: "none", // ✅ CAMBIO CLAVE: 'none' en lugar de 'lax'
            httpOnly: true, // Seguridad extra
            maxAge: 24 * 60 * 60 * 1000, // 24 horas
        },
    })
);

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", activateSubscriptionRouter);
app.use("/api/stripe", testPayment);
app.use("/api/stripe", authenticateUser, checkoutRoutes);
app.use("/api/logs", logsRouter);
app.use("/api", campaignsRouter);
app.use("/api", adGroupsRouter);
app.use("/api", assetsRouter);
app.use("/api", googleAdsDebugRouter);
app.use("/api", metadataRouter);
app.use("/api", analysisRoutes);
app.use("/api", syncRoutes);
app.use("/api", metricsRoutes);
app.use(pmaxRoutes);
app.use(googleAdsAuthRoutes);

app.get("/api/health", (req, res) => {
    res.send("✅ Backend activo");
});

export default app;
