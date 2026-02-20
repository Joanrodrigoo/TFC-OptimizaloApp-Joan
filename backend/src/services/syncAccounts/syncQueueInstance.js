import AccountSyncQueueConcurrent from "./AccountSyncQueueConcurrent.js";
import pool from "../../config/db.js";
import dotenv from "dotenv";
dotenv.config();

const syncQueue = new AccountSyncQueueConcurrent(pool, {
    maxConcurrent: 3,
    retryDelay: 2000,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    developerToken: process.env.GOOGLE_DEVELOPER_TOKEN,
});

export default syncQueue;
