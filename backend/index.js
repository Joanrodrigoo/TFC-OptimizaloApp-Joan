import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";

const PORT = process.env.PORT || 3000;

// ==========================
// INICIAR SERVIDOR
// ==========================
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Visita http://localhost:${PORT}/auth para conectar Google Ads`);
});
