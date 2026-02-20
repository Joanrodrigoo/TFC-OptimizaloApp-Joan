import express from "express";
import { listLogs, getLogFile, cleanupLogs } from "../controllers/logsController.js";

const router = express.Router();

router.get("/list", listLogs);
router.get("/:filename", getLogFile);
router.delete("/cleanup", cleanupLogs);

export default router;
