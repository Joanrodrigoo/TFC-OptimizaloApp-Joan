# Optimizalo.app - Entorn de Demo

## Credencials d'Accés

Per provar l'aplicació, **has d'iniciar sessió exclusivament amb aquest usuari**, ja que la base de dades s'ha netejat per deixar només les seves dades de prova.
- **Email**: `demo@techstorepro.com`
- **Contrasenya**: `password`
- **Empresa**: TechStore Pro
- **Customer ID Simulat**: `1234567890`

## Com Iniciar el Projecte

El projecte requereix executar el backend i el frontend de forma simultània.

### 1. Iniciar el Backend (API)
Obre una terminal, entra a la carpeta `backend` i executa:
```bash
cd backend
npm run dev
# (O alternativament: node index.js)
```
El servidor backend s'executarà a `http://localhost:3000`.

### 2. Iniciar el Frontend (Interfície)
Obre una altra terminal, entra a la carpeta `frontendLogica` i executa:
```bash
cd frontendLogica
npm run dev
```
El frontend s'obrirà a `http://localhost:8080`. Obre aquesta adreça al teu navegador web.

## Ús de la IA (Generació de Recomanacions)

El mòdul d'Intel·ligència Artificial per a l'anàlisi de mètriques i la generació de recomanacions està actiu. 

**Important sobre la IA:**
- El backend està configurat per utilitzar el model **`gemini-2.5-flash-lite`** a través de l'API gratuïta de Google AI Studio. 
- S'ha triat específicament aquest model lleuger perquè els models superiors (`2.0-flash` o `2.5-flash`) esgoten la quota gratuïta gairebé immediatament i retornen un error 429 (Too Many Requests).
- Per provar-ho, simplement navega al tauler (Dashboard), assegura't que el compte seleccionat siga `1234567890`, i fes clic a **"Analizar con IA"**. Les recomanacions apareixeran al cap d'uns segons a la pestanya de recomanacions.

## Estructura de l'Entorn

- **Base de Dades (`mi_saas`)**: Totes les dades estan carregades en local mitjançant MySQL. L'estructura es basa en `estructura.sql` i les dades principals en `backend/seed_demo_data.sql`.
- **Mode Demo**: Les variables d'entorn (`DEMO_MODE=true` a l'`.env` del backend) asseguren que no es facin crides de cobrament a Stripe ni se sincronitzin comptes reals de Google Ads per error.

## Restablir les Dades
Si en algun moment necessites tornar a l'estat inicial exacte de demostració, pots netejar la base de dades important els següents fitxers des del teu gestor de MySQL:
1. Importa `estructura.sql` per esborrar i recrear les taules.
2. Importa `backend/seed_demo_data.sql` per carregar l'usuari `TechStore Pro` i el seu historial de mètriques.
