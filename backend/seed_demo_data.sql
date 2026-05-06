-- ============================================================
-- OPTIMIZALO.APP - SEED DEMO DATA
-- Empresa ficticia: TechStore Pro (e-commerce electrónica)
-- Customer ID: 1234567890
-- Ejecutar: mysql -u root -p mi_saas < seed_demo_data.sql
-- ============================================================

SET @cid = '1234567890';

-- 1. USUARIO DEMO
INSERT INTO users (id, email, name, password, is_active, role, created_at)
VALUES (99, 'demo@techstorepro.com', 'TechStore Pro',
        '$2b$10$YKN4QgK5J7w1dPJxuN6hWuZe4j8k2mXqR3sL9vA0cF1gH7iT8nO2e',
        1, 'user', NOW())
ON DUPLICATE KEY UPDATE is_active=1, name='TechStore Pro';

-- 2. SUSCRIPCIÓN ACTIVA
INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, plan, plan_name, status, current_period_start, current_period_end)
VALUES (99, 'sub_demo_001', 'cus_demo_001', 'pro', 'Pro Monthly', 'active',
        DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY))
ON DUPLICATE KEY UPDATE status='active', current_period_end=DATE_ADD(NOW(), INTERVAL 15 DAY);

-- 3. CUENTA DE GOOGLE ADS (ficticia)
INSERT INTO accounts (customer_id, name, is_mcc, parent_account_id)
VALUES (@cid, 'TechStore Pro', 0, NULL)
ON DUPLICATE KEY UPDATE name='TechStore Pro';

-- 4. TOKEN (ficticio pero válido para que el sistema lo reconozca)
INSERT INTO tokens (user_id, customer_id, refresh_token, access_token, access_token_expiry, token_status, is_mcc)
VALUES (99, @cid, 'demo_refresh_token', 'demo_access_token',
        DATE_ADD(NOW(), INTERVAL 1 HOUR), 'valid', 0)
ON DUPLICATE KEY UPDATE token_status='valid', access_token_expiry=DATE_ADD(NOW(), INTERVAL 1 HOUR);

-- ============================================================
-- 5. CAMPAIGN METRICS HISTORY (4 campañas x 14 días)
-- camp_001: Portátiles Gaming (alto ROAS)
-- camp_002: Accesorios Móvil (medio)
-- camp_003: Auriculares BT (bajo, CPA alto → para que la IA detecte)
-- camp_004: PMax General (Performance Max)
-- ============================================================

-- Limpiar datos anteriores si existen para el customer demo
DELETE FROM campaign_metrics_history WHERE customer_id = @cid;

INSERT INTO campaign_metrics_history
(customer_id, campaign_id, campaign_name, campaign_status, campaign_type, date,
 impressions, clicks, ctr, average_cpc_micros, cost_micros, conversions,
 conversion_rate, cost_per_conversion_micros, all_conversions,
 value_per_all_conversions, budget_micros, bidding_strategy,
 search_impression_share, search_rank_lost_impression_share,
 search_budget_lost_impression_share)
VALUES
-- camp_001 Portátiles Gaming (SEARCH, type=2) — 14 días de datos
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 13 DAY), 4200,210,0.050,850000,178500000,7,0.033,25500000,7.5,320,15000000,'TARGET_ROAS',0.72,0.10,0.05),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 12 DAY), 4350,230,0.053,860000,197800000,9,0.039,21977000,9.2,310,15000000,'TARGET_ROAS',0.74,0.09,0.04),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 11 DAY), 3900,195,0.050,840000,163800000,6,0.031,27300000,6.5,315,15000000,'TARGET_ROAS',0.70,0.12,0.06),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 10 DAY), 4100,205,0.050,855000,175275000,8,0.039,21909000,8.3,318,15000000,'TARGET_ROAS',0.73,0.11,0.04),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 9 DAY),  4500,250,0.056,870000,217500000,11,0.044,19772000,11.5,325,15000000,'TARGET_ROAS',0.76,0.08,0.03),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 8 DAY),  5100,285,0.056,875000,249375000,14,0.049,17812000,14.2,330,15000000,'TARGET_ROAS',0.79,0.07,0.03),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 7 DAY),  4800,260,0.054,865000,224900000,12,0.046,18741000,12.5,322,15000000,'TARGET_ROAS',0.77,0.08,0.04),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 6 DAY),  4650,245,0.053,858000,210210000,10,0.041,21021000,10.3,319,15000000,'TARGET_ROAS',0.75,0.09,0.04),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 5 DAY),  4400,232,0.053,852000,197664000,9,0.039,21962000,9.5,317,15000000,'TARGET_ROAS',0.74,0.10,0.05),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 4 DAY),  4750,258,0.054,862000,222396000,12,0.047,18533000,12.2,321,15000000,'TARGET_ROAS',0.76,0.09,0.04),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 3 DAY),  5200,295,0.057,878000,259010000,15,0.051,17267000,15.5,335,15000000,'TARGET_ROAS',0.80,0.06,0.02),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 2 DAY),  4950,270,0.055,868000,234360000,13,0.048,18027000,13.3,328,15000000,'TARGET_ROAS',0.78,0.07,0.03),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 1 DAY),  5050,278,0.055,872000,242416000,14,0.050,17315000,14.2,332,15000000,'TARGET_ROAS',0.79,0.07,0.03),
(@cid,'camp_001','Portátiles Gaming','ENABLED',2, CURDATE(),                            3800,190,0.050,848000,161120000,6,0.032,26853000,6.2,305,15000000,'TARGET_ROAS',0.71,0.11,0.05),

-- camp_002 Accesorios Móvil (SEARCH, rendimiento medio)
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 13 DAY), 2800,140,0.050,420000,58800000,4,0.029,14700000,4.2,85,8000000,'MAXIMIZE_CONVERSIONS',0.55,0.20,0.12),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 12 DAY), 2950,155,0.053,425000,65875000,5,0.032,13175000,5.1,87,8000000,'MAXIMIZE_CONVERSIONS',0.57,0.19,0.11),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 11 DAY), 2700,130,0.048,418000,54340000,3,0.023,18113000,3.3,83,8000000,'MAXIMIZE_CONVERSIONS',0.53,0.22,0.13),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 10 DAY), 2850,145,0.051,422000,61190000,4,0.028,15297000,4.3,86,8000000,'MAXIMIZE_CONVERSIONS',0.56,0.20,0.12),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 9 DAY),  3100,170,0.055,430000,73100000,6,0.035,12183000,6.2,90,8000000,'MAXIMIZE_CONVERSIONS',0.60,0.17,0.09),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 8 DAY),  3400,195,0.057,435000,84825000,7,0.036,12117000,7.3,93,8000000,'MAXIMIZE_CONVERSIONS',0.63,0.15,0.08),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 7 DAY),  3200,175,0.055,428000,74900000,5,0.029,14980000,5.5,89,8000000,'MAXIMIZE_CONVERSIONS',0.61,0.16,0.09),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 6 DAY),  2900,150,0.052,423000,63450000,4,0.027,15862000,4.4,87,8000000,'MAXIMIZE_CONVERSIONS',0.57,0.19,0.11),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 5 DAY),  2800,138,0.049,420000,57960000,3,0.022,19320000,3.3,84,8000000,'MAXIMIZE_CONVERSIONS',0.54,0.21,0.12),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 4 DAY),  3050,162,0.053,427000,69174000,5,0.031,13834000,5.2,88,8000000,'MAXIMIZE_CONVERSIONS',0.59,0.18,0.10),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 3 DAY),  3300,180,0.055,433000,77940000,6,0.033,12990000,6.3,91,8000000,'MAXIMIZE_CONVERSIONS',0.62,0.16,0.09),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 2 DAY),  3150,168,0.053,429000,72072000,5,0.030,14414000,5.4,89,8000000,'MAXIMIZE_CONVERSIONS',0.60,0.17,0.09),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 1 DAY),  3050,158,0.052,426000,67308000,5,0.032,13461000,5.2,88,8000000,'MAXIMIZE_CONVERSIONS',0.59,0.18,0.10),
(@cid,'camp_002','Accesorios Móvil','ENABLED',2, CURDATE(),                            2600,125,0.048,415000,51875000,3,0.024,17291000,3.2,82,8000000,'MAXIMIZE_CONVERSIONS',0.52,0.23,0.13),

-- camp_003 Auriculares BT (SEARCH, CPA muy alto → la IA lo detectará)
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 13 DAY), 1800,90,0.050,650000,58500000,1,0.011,58500000,1.1,60,6000000,'MANUAL_CPC',0.40,0.30,0.18),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 12 DAY), 1750,85,0.049,648000,55080000,0,0.000,0,0.5,0,6000000,'MANUAL_CPC',0.39,0.31,0.19),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 11 DAY), 1900,95,0.050,652000,61940000,1,0.011,61940000,1.2,62,6000000,'MANUAL_CPC',0.41,0.29,0.18),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 10 DAY), 1820,88,0.048,649000,57112000,0,0.000,0,0.4,0,6000000,'MANUAL_CPC',0.40,0.30,0.18),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 9 DAY),  1950,100,0.051,655000,65500000,2,0.020,32750000,2.1,65,6000000,'MANUAL_CPC',0.42,0.28,0.17),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 8 DAY),  2100,110,0.052,658000,72380000,1,0.009,72380000,1.3,68,6000000,'MANUAL_CPC',0.44,0.27,0.16),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 7 DAY),  1980,98,0.049,653000,63994000,0,0.000,0,0.5,0,6000000,'MANUAL_CPC',0.41,0.29,0.17),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 6 DAY),  1850,92,0.050,650000,59800000,1,0.011,59800000,1.1,61,6000000,'MANUAL_CPC',0.40,0.30,0.18),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 5 DAY),  1780,87,0.049,647000,56289000,0,0.000,0,0.3,0,6000000,'MANUAL_CPC',0.39,0.31,0.19),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 4 DAY),  1920,96,0.050,652000,62592000,1,0.010,62592000,1.2,63,6000000,'MANUAL_CPC',0.41,0.29,0.18),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 3 DAY),  2000,105,0.053,656000,68880000,1,0.010,68880000,1.3,67,6000000,'MANUAL_CPC',0.43,0.28,0.17),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 2 DAY),  1900,93,0.049,651000,60543000,0,0.000,0,0.4,0,6000000,'MANUAL_CPC',0.40,0.30,0.18),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, DATE_SUB(CURDATE(),INTERVAL 1 DAY),  1870,91,0.049,650000,59150000,1,0.011,59150000,1.1,60,6000000,'MANUAL_CPC',0.40,0.30,0.18),
(@cid,'camp_003','Auriculares Bluetooth','ENABLED',2, CURDATE(),                            1700,82,0.048,645000,52890000,0,0.000,0,0.2,0,6000000,'MANUAL_CPC',0.38,0.32,0.19),

-- camp_004 PMax General (Performance Max, type=10)
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 13 DAY), 8500,320,0.038,950000,304000000,18,0.056,16888000,19.2,380,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 12 DAY), 9100,360,0.040,960000,345600000,22,0.061,15709000,23.1,395,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 11 DAY), 8200,300,0.037,945000,283500000,15,0.050,18900000,15.8,370,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 10 DAY), 8800,335,0.038,955000,319925000,20,0.060,15996000,21.0,385,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 9 DAY),  9500,380,0.040,965000,366700000,25,0.066,14668000,26.3,410,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 8 DAY),  10200,420,0.041,970000,407400000,30,0.071,13580000,31.5,430,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 7 DAY),  9800,395,0.040,962000,380090000,27,0.068,14077000,28.3,418,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 6 DAY),  9300,370,0.040,958000,354460000,23,0.062,15411000,24.2,405,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 5 DAY),  8900,342,0.038,952000,325584000,20,0.058,16279000,21.0,390,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 4 DAY),  9400,375,0.040,960000,360000000,24,0.064,15000000,25.2,408,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 3 DAY),  10500,430,0.041,972000,417960000,32,0.074,13061000,33.6,440,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 2 DAY),  10000,405,0.041,966000,391230000,29,0.072,13491000,30.4,425,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, DATE_SUB(CURDATE(),INTERVAL 1 DAY),  9700,390,0.040,963000,375570000,27,0.069,13910000,28.3,415,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0),
(@cid,'camp_004','PMax — TechStore General','ENABLED',10, CURDATE(),                            7800,295,0.038,940000,277300000,14,0.047,19807000,14.7,355,20000000,'MAXIMIZE_CONVERSION_VALUE',0,0,0);

-- ============================================================
-- 6. AD GROUPS (3 por campaña Search, usando una fecha representativa)
-- ============================================================
DELETE FROM ad_groups WHERE customer_id = @cid;

INSERT INTO ad_groups (customer_id, ad_group_id, campaign_id, ad_group_name, status, date,
  impressions, clicks, cost_micros, conversions, ctr, average_cpc_micros)
VALUES
-- camp_001 ad groups
(@cid,'ag_001_a','camp_001','Gaming Portátiles - Marca','ENABLED', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 2100,120,104400000,7,0.057,870000),
(@cid,'ag_001_b','camp_001','Gaming Portátiles - Genérico','ENABLED', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 1800,95, 81225000,5,0.053,855000),
(@cid,'ag_001_c','camp_001','Gaming Portátiles - Competencia','ENABLED', DATE_SUB(CURDATE(),INTERVAL 1 DAY),  950,63, 57960000,2,0.066,920000),
-- camp_002 ad groups
(@cid,'ag_002_a','camp_002','Fundas Móvil','ENABLED', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 1400,72, 30672000,3,0.051,426000),
(@cid,'ag_002_b','camp_002','Cargadores Rápidos','ENABLED', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 1100,58, 24998000,2,0.053,431000),
(@cid,'ag_002_c','camp_002','Auriculares USB-C','ENABLED', DATE_SUB(CURDATE(),INTERVAL 1 DAY),  550,28, 11480000,0,0.051,410000),
-- camp_003 ad groups (bajo rendimiento)
(@cid,'ag_003_a','camp_003','Auriculares Premium','ENABLED', DATE_SUB(CURDATE(),INTERVAL 1 DAY),  980,50, 32500000,1,0.051,650000),
(@cid,'ag_003_b','camp_003','Auriculares Gaming','ENABLED', DATE_SUB(CURDATE(),INTERVAL 1 DAY),  890,41, 26650000,0,0.046,650000);

-- ============================================================
-- 7. ADS (2 por ad group, con métricas 14 días en created_at)
-- ============================================================
DELETE FROM ads WHERE customer_id = @cid;

INSERT INTO ads (customer_id, ad_id, ad_group_id, campaign_id, status, date,
  impressions, clicks, cost_micros, conversions, ctr,
  ad_headline, ad_description, final_url)
VALUES
(@cid,'ad_001','ag_001_a','camp_001','ENABLED', DATE(DATE_SUB(NOW(),INTERVAL 1 DAY)), 1050,62,53940000,4,0.059,'Portátil Gaming RTX 4070 | Envío Gratis 24h','Los mejores portátiles gaming al mejor precio. ¡Configura el tuyo!','https://techstorepro.com/portatiles-gaming'),
(@cid,'ad_002','ag_001_a','camp_001','ENABLED', DATE(DATE_SUB(NOW(),INTERVAL 1 DAY)),  980,55,47850000,3,0.056,'Gaming Laptop Outlet | Hasta -30% Esta Semana','Portátiles gaming reacondicionados con garantía. Stock limitado.','https://techstorepro.com/outlet'),
(@cid,'ad_003','ag_001_b','camp_001','ENABLED', DATE(DATE_SUB(NOW(),INTERVAL 1 DAY)),  920,48,41040000,2,0.052,'Portátil Gamer Barato | Cuotas Sin Interés','Financia tu portátil gaming en 12 meses sin intereses.','https://techstorepro.com/financiacion'),
(@cid,'ad_004','ag_002_a','camp_002','ENABLED', DATE(DATE_SUB(NOW(),INTERVAL 1 DAY)),  700,36,15300000,2,0.051,'Fundas iPhone 15 | Protección Premium','Fundas originales para todos los modelos. Envío en 24h.','https://techstorepro.com/fundas'),
(@cid,'ad_005','ag_002_b','camp_002','ENABLED', DATE(DATE_SUB(NOW(),INTERVAL 1 DAY)),  550,28,11900000,1,0.051,'Cargador Rápido 65W | Compatible Todos Móviles','Carga tu móvil en 30 minutos. Tecnología GaN avanzada.','https://techstorepro.com/cargadores'),
(@cid,'ad_006','ag_003_a','camp_003','ENABLED', DATE(DATE_SUB(NOW(),INTERVAL 1 DAY)),  490,25,16250000,0,0.051,'Auriculares Sony WH-1000 | Cancelación de Ruido','Sonido premium con hasta 30h de batería. Compra ahora.','https://techstorepro.com/auriculares'),
(@cid,'ad_007','ag_003_b','camp_003','ENABLED', DATE(DATE_SUB(NOW(),INTERVAL 1 DAY)),  445,20,13000000,0,0.045,'Auriculares Gaming Pro | 7.1 Surround Virtual','Domina el juego con audio posicional. Micrófono retráctil.','https://techstorepro.com/gaming-audio');

-- ============================================================
-- 8. KEYWORDS (14 días, incluyendo problemáticas para que IA actúe)
-- ============================================================
DELETE FROM keywords WHERE customer_id = @cid;

-- Procedimiento para insertar keywords en bucle de 14 días
DROP PROCEDURE IF EXISTS InsertKeywords;
DELIMITER //
CREATE PROCEDURE InsertKeywords()
BEGIN
  DECLARE i INT DEFAULT 0;
  WHILE i < 14 DO
    SET @d = DATE_SUB(CURDATE(), INTERVAL i DAY);

    -- kw_001: "portátil gaming" EXACT → buen rendimiento
    INSERT IGNORE INTO keywords (customer_id, date, keyword_text, match_type, ad_group_id, campaign_id, status, is_negative, impressions, clicks, cost_micros, conversions)
    VALUES (@cid, @d, 'portátil gaming', 'EXACT', 'ag_001_a', 'camp_001', 'ENABLED', 0, 850+(i*10), 45+(i*1), 39150000+(i*900000), 3-(i%3=0));

    -- kw_002: "laptop gaming barato" BROAD
    INSERT IGNORE INTO keywords (customer_id, date, keyword_text, match_type, ad_group_id, campaign_id, status, is_negative, impressions, clicks, cost_micros, conversions)
    VALUES (@cid, @d, 'laptop gaming barato', 'BROAD', 'ag_001_b', 'camp_001', 'ENABLED', 0, 620+(i*8), 32+(i*1), 27360000+(i*800000), 2-(i%4=0));

    -- kw_003: "portátil rtx 4070" PHRASE → muy bueno
    INSERT IGNORE INTO keywords (customer_id, date, keyword_text, match_type, ad_group_id, campaign_id, status, is_negative, impressions, clicks, cost_micros, conversions)
    VALUES (@cid, @d, 'portátil rtx 4070', 'PHRASE', 'ag_001_a', 'camp_001', 'ENABLED', 0, 310+(i*5), 20+(i*1), 18000000+(i*700000), 2-(i%5=0));

    -- kw_004: funda iphone → medio
    INSERT IGNORE INTO keywords (customer_id, date, keyword_text, match_type, ad_group_id, campaign_id, status, is_negative, impressions, clicks, cost_micros, conversions)
    VALUES (@cid, @d, 'funda iphone 15', 'EXACT', 'ag_002_a', 'camp_002', 'ENABLED', 0, 480+(i*5), 24+(i*0), 10200000+(i*400000), 1-(i%5=0));

    -- kw_005: cargador rápido → medio
    INSERT IGNORE INTO keywords (customer_id, date, keyword_text, match_type, ad_group_id, campaign_id, status, is_negative, impressions, clicks, cost_micros, conversions)
    VALUES (@cid, @d, 'cargador inalámbrico rápido', 'BROAD', 'ag_002_b', 'camp_002', 'ENABLED', 0, 360+(i*4), 18+(i*0), 7740000+(i*300000), 1-(i%6=0));

    -- kw_006: auriculares sony → PROBLEMÁTICA: gasto alto, 0 conversiones últimos días
    INSERT IGNORE INTO keywords (customer_id, date, keyword_text, match_type, ad_group_id, campaign_id, status, is_negative, impressions, clicks, cost_micros, conversions)
    VALUES (@cid, @d, 'auriculares sony wh1000xm5', 'EXACT', 'ag_003_a', 'camp_003', 'ENABLED', 0, 280+(i*3), 14+(i*1), 9100000+(i*500000), IF(i>6,0,1));

    -- kw_007: auriculares gaming → PROBLEMÁTICA: clics sin conversión
    INSERT IGNORE INTO keywords (customer_id, date, keyword_text, match_type, ad_group_id, campaign_id, status, is_negative, impressions, clicks, cost_micros, conversions)
    VALUES (@cid, @d, 'auriculares gaming pc', 'BROAD', 'ag_003_b', 'camp_003', 'ENABLED', 0, 240+(i*2), 12+(i*1), 7800000+(i*400000), IF(i>8,0,1));

    SET i = i + 1;
  END WHILE;
END //
DELIMITER ;
CALL InsertKeywords();
DROP PROCEDURE IF EXISTS InsertKeywords;

-- ============================================================
-- 9. SEARCH TERMS (muestra representativa)
-- ============================================================
DELETE FROM search_terms WHERE customer_id = @cid;

INSERT INTO search_terms (customer_id, search_term, match_type, ad_group_id, campaign_id, date, impressions, clicks, cost_micros, conversions)
VALUES
(@cid,'portátil gaming rtx 4070 barato','BROAD','ag_001_a','camp_001', DATE_SUB(CURDATE(),INTERVAL 3 DAY), 120,8,6960000,1),
(@cid,'mejor portátil gaming 2024','BROAD','ag_001_b','camp_001', DATE_SUB(CURDATE(),INTERVAL 3 DAY), 95,5,4275000,0),
(@cid,'comprar laptop gaming','BROAD','ag_001_b','camp_001', DATE_SUB(CURDATE(),INTERVAL 2 DAY), 210,12,10260000,2),
(@cid,'funda silicona iphone 15 pro','BROAD','ag_002_a','camp_002', DATE_SUB(CURDATE(),INTERVAL 3 DAY), 88,4,1700000,1),
(@cid,'cargador rapido samsung 65w','BROAD','ag_002_b','camp_002', DATE_SUB(CURDATE(),INTERVAL 2 DAY), 75,3,1290000,0),
(@cid,'auriculares cancelacion ruido sony','BROAD','ag_003_a','camp_003', DATE_SUB(CURDATE(),INTERVAL 3 DAY), 65,4,2600000,0),
(@cid,'auriculares gaming rgb baratos','BROAD','ag_003_b','camp_003', DATE_SUB(CURDATE(),INTERVAL 2 DAY), 55,3,1950000,0),
(@cid,'portatil gaming segunda mano','BROAD','ag_001_b','camp_001', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 45,2,1710000,0);

-- ============================================================
-- 10. AUDIENCE SEGMENTS (7 días)
-- ============================================================
DELETE FROM audience_segments WHERE customer_id = @cid;

INSERT INTO audience_segments (customer_id, campaign_id, segment_type, segment_value, date, impressions, clicks, cost_micros, conversions)
VALUES
(@cid,'camp_001','AGE_RANGE','18-24', DATE_SUB(CURDATE(),INTERVAL 3 DAY), 820,45,39150000,3),
(@cid,'camp_001','AGE_RANGE','25-34', DATE_SUB(CURDATE(),INTERVAL 3 DAY), 1250,72,62640000,5),
(@cid,'camp_001','AGE_RANGE','35-44', DATE_SUB(CURDATE(),INTERVAL 3 DAY), 680,35,30450000,2),
(@cid,'camp_001','GENDER','MALE',   DATE_SUB(CURDATE(),INTERVAL 3 DAY), 1900,110,95700000,8),
(@cid,'camp_001','GENDER','FEMALE', DATE_SUB(CURDATE(),INTERVAL 3 DAY),  850,42,36540000,2),
(@cid,'camp_002','AGE_RANGE','18-24', DATE_SUB(CURDATE(),INTERVAL 3 DAY), 550,28,11900000,2),
(@cid,'camp_002','AGE_RANGE','25-34', DATE_SUB(CURDATE(),INTERVAL 3 DAY), 720,36,15300000,2),
(@cid,'camp_003','AGE_RANGE','25-34', DATE_SUB(CURDATE(),INTERVAL 3 DAY), 310,16,10400000,0),
(@cid,'camp_003','GENDER','MALE',   DATE_SUB(CURDATE(),INTERVAL 3 DAY),  490,26,16900000,1);

-- ============================================================
-- 11. ASSET GROUPS (PMax camp_004)
-- ============================================================
DELETE FROM asset_groups WHERE customer_id = @cid;

INSERT INTO asset_groups (customer_id, asset_group_id, campaign_id, asset_group_name, status, date, impressions, clicks, cost_micros, conversions)
VALUES
(@cid,'ag_pmax_1','camp_004','TechStore — Portátiles','ENABLED', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 5800,235,226350000,18),
(@cid,'ag_pmax_2','camp_004','TechStore — Accesorios','ENABLED', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 3900,155,149220000, 9);

-- ============================================================
-- 12. ASSET GROUP ASSETS (textos e imágenes para PMax)
-- ============================================================
DELETE FROM asset_group_assets WHERE customer_id = @cid;

INSERT INTO asset_group_assets (customer_id, asset_group_id, asset_id, field_type, text_value, performance_label, date, impressions, clicks)
VALUES
(@cid,'ag_pmax_1','asset_001','HEADLINE','Portátiles Gaming al Mejor Precio','BEST', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 2100,88),
(@cid,'ag_pmax_1','asset_002','HEADLINE','RTX 4070 | Envío Gratis 24h','GOOD', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 1850,75),
(@cid,'ag_pmax_1','asset_003','HEADLINE','Financia en 12 Meses sin Interés','LOW', DATE_SUB(CURDATE(),INTERVAL 1 DAY),  640,20),
(@cid,'ag_pmax_1','asset_004','DESCRIPTION','Descubre nuestra selección de portátiles gaming con las últimas GPUs NVIDIA. Stock actualizado diariamente.','GOOD', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 3200,130),
(@cid,'ag_pmax_1','asset_005','DESCRIPTION','Compra online con garantía de 2 años y devolución gratuita en 30 días.','BEST', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 2600,105),
(@cid,'ag_pmax_2','asset_006','HEADLINE','Accesorios Móvil Premium','GOOD', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 1600,65),
(@cid,'ag_pmax_2','asset_007','HEADLINE','Fundas y Cargadores iPhone','GOOD', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 1300,52),
(@cid,'ag_pmax_2','asset_008','HEADLINE','Envío Express — Pide Hoy','LOW', DATE_SUB(CURDATE(),INTERVAL 1 DAY),  420,14),
(@cid,'ag_pmax_2','asset_009','DESCRIPTION','Toda la tecnología que necesitas para tu móvil, tablet o PC. Marcas originales al mejor precio.','BEST', DATE_SUB(CURDATE(),INTERVAL 1 DAY), 1900,78),
(@cid,'ag_pmax_2','asset_010','DESCRIPTION','Compatible con iPhone, Samsung, Xiaomi y más. Garantía oficial 12 meses.','PENDING', DATE_SUB(CURDATE(),INTERVAL 1 DAY),  280, 9);

-- ============================================================
-- 13. LANGUAGES & LOCATIONS para campañas Search
-- ============================================================
INSERT IGNORE INTO campaign_languages (customer_id, campaign_id, code, name)
VALUES
(@cid,'camp_001','es','Spanish'), (@cid,'camp_001','ca','Catalan'),
(@cid,'camp_002','es','Spanish'), (@cid,'camp_003','es','Spanish');

INSERT IGNORE INTO campaign_locations (customer_id, campaign_id, geo_target_constant, name, target_type)
VALUES
(@cid,'camp_001',2724,'Spain','COUNTRY'), (@cid,'camp_001',20291,'Catalonia','REGION'),
(@cid,'camp_002',2724,'Spain','COUNTRY'), (@cid,'camp_003',2724,'Spain','COUNTRY');

-- ============================================================
-- FIN DEL SEED — Verificación rápida:
-- SELECT campaign_id, COUNT(*) dias FROM campaign_metrics_history
-- WHERE customer_id='1234567890' GROUP BY campaign_id;
-- ============================================================
