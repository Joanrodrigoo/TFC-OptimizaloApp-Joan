import AnalysisQueueManager from "./AnalysisQueueManager.js";
import pool from "../../config/db.js";

const analysisQueue = new AnalysisQueueManager(pool, {
    maxConcurrent: 1,
    apiBase: "http://localhost:3000",
});

export default analysisQueue;
