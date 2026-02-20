import { TokenMonitoringService } from '../services/tokenMonitoringService.js';

async function main() {
  const tokenService = new TokenMonitoringService();
  
  try {
    await tokenService.checkExpiringTokens();
    process.exit(0);
  } catch (error) {
    console.error('Error ejecutando verificación de tokens:', error);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}