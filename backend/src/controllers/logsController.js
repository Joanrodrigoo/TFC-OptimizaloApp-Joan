import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ajustar ruta de logs: subimos desde src/controllers hasta logs
const logsDir = path.join(__dirname, "../../logs");

export const listLogs = (req, res) => {
    try {
        if (!fs.existsSync(logsDir)) {
            return res.json({ files: [] });
        }
        const files = fs
            .readdirSync(logsDir)
            .filter((file) => file.endsWith(".log"))
            .map((file) => ({
                name: file,
                size: fs.statSync(path.join(logsDir, file)).size,
                modified: fs.statSync(path.join(logsDir, file)).mtime,
            }))
            .sort((a, b) => b.modified - a.modified);

        res.json({ files });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getLogFile = (req, res) => {
    try {
        const { filename } = req.params;
        const { lines = 100 } = req.query; // Por defecto últimas 100 líneas

        const filePath = path.join(logsDir, filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Archivo no encontrado" });
        }

        const content = fs.readFileSync(filePath, "utf8");
        const allLines = content.split("\n");
        const lastLines = allLines.slice(-parseInt(lines));

        res.json({
            filename,
            totalLines: allLines.length,
            displayedLines: lastLines.length,
            content: lastLines.join("\n"),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const cleanupLogs = (req, res) => {
    try {
        if (!fs.existsSync(logsDir)) {
            return res.json({ message: "No logs directory found", deleted: 0 });
        }
        const now = Date.now();
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

        const files = fs.readdirSync(logsDir);
        let deleted = 0;

        files.forEach((file) => {
            const filePath = path.join(logsDir, file);
            const stats = fs.statSync(filePath);

            if (stats.mtime.getTime() < thirtyDaysAgo) {
                fs.unlinkSync(filePath);
                deleted++;
            }
        });

        res.json({
            message: `${deleted} archivos eliminados`,
            deleted,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
