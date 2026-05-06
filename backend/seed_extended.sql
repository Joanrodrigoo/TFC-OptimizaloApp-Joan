-- ============================================================
-- OPTIMIZALO.APP - SEED EXTENDED (8 CUENTAS ADICIONALES)
-- ============================================================
-- Ejecutar: mysql -u root -p mi_saas < seed_extended.sql

DROP PROCEDURE IF EXISTS GenerateExtendedDemoData;
DELIMITER //

CREATE PROCEDURE GenerateExtendedDemoData()
BEGIN
    DECLARE i INT DEFAULT 0;
    DECLARE d DATE;
    DECLARE is_wknd INT;

    -- ==========================================
    -- 1. LIMPIEZA INICIAL
    -- ==========================================
    DELETE FROM campaign_metrics_history WHERE customer_id IN ('2000000000','2111111111','2222222222','2333333333','2444444444','2555555555','2666666666','2777777777');
    DELETE FROM ad_groups WHERE customer_id IN ('2000000000','2111111111','2222222222','2333333333','2444444444','2555555555','2666666666','2777777777');
    DELETE FROM keywords WHERE customer_id IN ('2000000000','2111111111','2222222222','2333333333','2444444444','2555555555','2666666666','2777777777');
    DELETE FROM search_terms WHERE customer_id IN ('2000000000','2111111111','2222222222','2333333333','2444444444','2555555555','2666666666','2777777777');
    DELETE FROM recomendaciones WHERE customer_id IN ('2000000000','2111111111','2222222222','2333333333','2444444444','2555555555','2666666666','2777777777');
    DELETE FROM asset_groups WHERE customer_id IN ('2000000000','2111111111','2222222222','2333333333','2444444444','2555555555','2666666666','2777777777');
    DELETE FROM asset_group_assets WHERE customer_id IN ('2000000000','2111111111','2222222222','2333333333','2444444444','2555555555','2666666666','2777777777');
    DELETE FROM audience_segments WHERE customer_id IN ('2000000000','2111111111','2222222222','2333333333','2444444444','2555555555','2666666666','2777777777');

    -- ==========================================
    -- 2. USUARIOS, SUSCRIPCIONES Y CUENTAS
    -- ==========================================
    INSERT INTO users (id, email, name, password, is_active, role, created_at) VALUES 
    (100, 'moda@demo.com', 'E-commerce Moda', '$2b$10$YKN4QgK5J7w1dPJxuN6hWuZe4j8k2mXqR3sL9vA0cF1gH7iT8nO2e', 1, 'user', NOW()),
    (101, 'viajes@demo.com', 'Turismo Viajes', '$2b$10$YKN4QgK5J7w1dPJxuN6hWuZe4j8k2mXqR3sL9vA0cF1gH7iT8nO2e', 1, 'user', NOW()),
    (102, 'saas@demo.com', 'SaaS Software', '$2b$10$YKN4QgK5J7w1dPJxuN6hWuZe4j8k2mXqR3sL9vA0cF1gH7iT8nO2e', 1, 'user', NOW()),
    (103, 'inmo@demo.com', 'Inmobiliaria Premium', '$2b$10$YKN4QgK5J7w1dPJxuN6hWuZe4j8k2mXqR3sL9vA0cF1gH7iT8nO2e', 1, 'user', NOW()),
    (104, 'auto@demo.com', 'Concesionario Auto', '$2b$10$YKN4QgK5J7w1dPJxuN6hWuZe4j8k2mXqR3sL9vA0cF1gH7iT8nO2e', 1, 'user', NOW()),
    (105, 'salud@demo.com', 'Clínica Salud', '$2b$10$YKN4QgK5J7w1dPJxuN6hWuZe4j8k2mXqR3sL9vA0cF1gH7iT8nO2e', 1, 'user', NOW()),
    (106, 'food@demo.com', 'Grupo Restauración', '$2b$10$YKN4QgK5J7w1dPJxuN6hWuZe4j8k2mXqR3sL9vA0cF1gH7iT8nO2e', 1, 'user', NOW()),
    (107, 'finanzas@demo.com', 'Fintech Inversiones', '$2b$10$YKN4QgK5J7w1dPJxuN6hWuZe4j8k2mXqR3sL9vA0cF1gH7iT8nO2e', 1, 'user', NOW())
    ON DUPLICATE KEY UPDATE is_active=1;

    INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, plan, plan_name, status, current_period_start, current_period_end) VALUES 
    (100, 'sub_100', 'cus_100', 'pro', 'Pro Monthly', 'active', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY)),
    (101, 'sub_101', 'cus_101', 'pro', 'Pro Monthly', 'active', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY)),
    (102, 'sub_102', 'cus_102', 'pro', 'Pro Monthly', 'active', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY)),
    (103, 'sub_103', 'cus_103', 'pro', 'Pro Monthly', 'active', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY)),
    (104, 'sub_104', 'cus_104', 'pro', 'Pro Monthly', 'active', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY)),
    (105, 'sub_105', 'cus_105', 'pro', 'Pro Monthly', 'active', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY)),
    (106, 'sub_106', 'cus_106', 'pro', 'Pro Monthly', 'active', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY)),
    (107, 'sub_107', 'cus_107', 'pro', 'Pro Monthly', 'active', DATE_SUB(NOW(), INTERVAL 15 DAY), DATE_ADD(NOW(), INTERVAL 15 DAY))
    ON DUPLICATE KEY UPDATE status='active';

    INSERT INTO accounts (customer_id, name, is_mcc, parent_account_id) VALUES 
    ('2000000000', 'E-commerce Moda', 0, NULL),
    ('2111111111', 'Turismo / Viajes', 0, NULL),
    ('2222222222', 'SaaS / Software', 0, NULL),
    ('2333333333', 'Inmobiliaria Premium', 0, NULL),
    ('2444444444', 'Concesionario Auto', 0, NULL),
    ('2555555555', 'Clínica Salud Farma', 0, NULL),
    ('2666666666', 'Grupo Restauración', 0, NULL),
    ('2777777777', 'Fintech Inversiones', 0, NULL)
    ON DUPLICATE KEY UPDATE name=VALUES(name);

    INSERT INTO tokens (user_id, customer_id, refresh_token, access_token, access_token_expiry, token_status, is_mcc) VALUES 
    (100, '2000000000', 'rt_100', 'at_100', DATE_ADD(NOW(), INTERVAL 1 HOUR), 'valid', 0),
    (101, '2111111111', 'rt_101', 'at_101', DATE_ADD(NOW(), INTERVAL 1 HOUR), 'valid', 0),
    (102, '2222222222', 'rt_102', 'at_102', DATE_ADD(NOW(), INTERVAL 1 HOUR), 'valid', 0),
    (103, '2333333333', 'rt_103', 'at_103', DATE_ADD(NOW(), INTERVAL 1 HOUR), 'valid', 0),
    (104, '2444444444', 'rt_104', 'at_104', DATE_ADD(NOW(), INTERVAL 1 HOUR), 'valid', 0),
    (105, '2555555555', 'rt_105', 'at_105', DATE_ADD(NOW(), INTERVAL 1 HOUR), 'valid', 0),
    (106, '2666666666', 'rt_106', 'at_106', DATE_ADD(NOW(), INTERVAL 1 HOUR), 'valid', 0),
    (107, '2777777777', 'rt_107', 'at_107', DATE_ADD(NOW(), INTERVAL 1 HOUR), 'valid', 0)
    ON DUPLICATE KEY UPDATE token_status='valid';

    -- ==========================================
    -- 3. TABLA TEMPORAL PARA SIMULADOR DE CAMPAÑAS
    -- ==========================================
    DROP TEMPORARY TABLE IF EXISTS temp_camps;
    CREATE TEMPORARY TABLE temp_camps (
        cid VARCHAR(50), id VARCHAR(50), name VARCHAR(255), type INT, 
        base_impr INT, base_ctr DECIMAL(5,4), base_cvr DECIMAL(5,4), base_cpc INT, 
        budget INT, bid_strat VARCHAR(50), profile VARCHAR(20)
    );

    -- Códigos type: Search=2, Display=3, Shopping=6, Video=9, PMax=10, Smart=4
    INSERT INTO temp_camps VALUES
    -- Cuenta 1: Moda
    ('2000000000', 'c1_1', 'Search - Vestidos Fiesta (Estrella)', 2, 3000, 0.08, 0.06, 450000, 50000000, 'TARGET_ROAS', 'STAR'),
    ('2000000000', 'c1_2', 'Search - Rebajas Generales (Problema)', 2, 5000, 0.04, 0.01, 1200000, 80000000, 'TARGET_CPA', 'PROBLEM'),
    ('2000000000', 'c1_3', 'PMax - Catálogo Completo', 10, 15000, 0.03, 0.05, 300000, 60000000, 'MAXIMIZE_CONVERSION_VALUE', 'B2C'),
    ('2000000000', 'c1_4', 'Shopping - Zapatos Temporada', 6, 8000, 0.02, 0.03, 250000, 40000000, 'TARGET_ROAS', 'B2C'),
    ('2000000000', 'c1_5', 'Display - Remarketing 30d', 3, 60000, 0.005, 0.005, 100000, 20000000, 'TARGET_CPA', 'B2C'),
    ('2000000000', 'c1_6', 'Search - Tallas Grandes (Sin Convs)', 2, 2000, 0.05, 0.00, 800000, 30000000, 'MANUAL_CPC', 'NOCONV'),

    -- Cuenta 2: Viajes
    ('2111111111', 'c2_1', 'Search - Vuelos Caribe', 2, 4000, 0.06, 0.04, 1500000, 100000000, 'TARGET_ROAS', 'B2C'),
    ('2111111111', 'c2_2', 'PMax - Paquetes Europa', 10, 20000, 0.02, 0.03, 800000, 150000000, 'MAXIMIZE_CONVERSION_VALUE', 'STAR'),
    ('2111111111', 'c2_3', 'Search - Hoteles Baratos (CPA Alto)', 2, 6000, 0.05, 0.008, 2500000, 120000000, 'TARGET_CPA', 'PROBLEM'),
    ('2111111111', 'c2_4', 'Video - Branding Verano', 9, 80000, 0.002, 0.001, 50000, 30000000, 'MAXIMIZE_VIEWS', 'B2C'),
    ('2111111111', 'c2_5', 'Smart - Campaña Local Agencia', 4, 1000, 0.03, 0.02, 1000000, 20000000, 'MAXIMIZE_CLICKS', 'B2C'),
    ('2111111111', 'c2_6', 'Search - Cruceros (Sin Convs)', 2, 1500, 0.07, 0.00, 3000000, 50000000, 'MAXIMIZE_CLICKS', 'NOCONV'),

    -- Cuenta 3: SaaS
    ('2222222222', 'c3_1', 'Search - ERP Software (Estrella)', 2, 1000, 0.05, 0.03, 5000000, 200000000, 'TARGET_CPA', 'STAR_B2B'),
    ('2222222222', 'c3_2', 'Search - CRM Competencia (Problema)', 2, 2500, 0.06, 0.005, 8000000, 300000000, 'TARGET_CPA', 'PROBLEM_B2B'),
    ('2222222222', 'c3_3', 'PMax - Leads Generales', 10, 8000, 0.02, 0.02, 3500000, 250000000, 'MAXIMIZE_CONVERSIONS', 'B2B'),
    ('2222222222', 'c3_4', 'Display - Retargeting Blog', 3, 40000, 0.004, 0.002, 800000, 50000000, 'TARGET_CPA', 'B2B'),
    ('2222222222', 'c3_5', 'Search - Términos Genéricos (Sin Convs)', 2, 3000, 0.04, 0.00, 4000000, 100000000, 'MANUAL_CPC', 'NOCONV'),
    ('2222222222', 'c3_6', 'Video - Demo Producto', 9, 30000, 0.003, 0.005, 300000, 40000000, 'MAXIMIZE_VIEWS', 'B2B'),

    -- Cuenta 4: Inmobiliaria
    ('2333333333', 'c4_1', 'Search - Pisos Centro (CPA Alto)', 2, 2000, 0.05, 0.01, 2000000, 80000000, 'TARGET_CPA', 'PROBLEM'),
    ('2333333333', 'c4_2', 'Search - Chalets Lujo', 2, 800, 0.07, 0.04, 3500000, 100000000, 'TARGET_CPA', 'STAR'),
    ('2333333333', 'c4_3', 'PMax - Promociones Obra Nueva', 10, 10000, 0.02, 0.02, 1500000, 150000000, 'MAXIMIZE_CONVERSIONS', 'B2C'),
    ('2333333333', 'c4_4', 'Smart - Oficina Local', 4, 500, 0.04, 0.03, 1000000, 20000000, 'MAXIMIZE_CLICKS', 'B2C'),
    ('2333333333', 'c4_5', 'Display - Remarketing Visitas', 3, 20000, 0.006, 0.005, 500000, 30000000, 'TARGET_CPA', 'B2C'),
    ('2333333333', 'c4_6', 'Search - Alquiler Barato (Sin Convs)', 2, 5000, 0.08, 0.00, 800000, 40000000, 'MANUAL_CPC', 'NOCONV'),

    -- Cuenta 5: Automoción
    ('2444444444', 'c5_1', 'Search - Coches SUV', 2, 3000, 0.06, 0.02, 1800000, 150000000, 'TARGET_CPA', 'B2C'),
    ('2444444444', 'c5_2', 'PMax - Vehículos Ocasión', 10, 15000, 0.03, 0.04, 1200000, 200000000, 'MAXIMIZE_CONVERSIONS', 'STAR'),
    ('2444444444', 'c5_3', 'Search - Taller Mecánico (Problema)', 2, 1000, 0.04, 0.008, 3000000, 80000000, 'TARGET_CPA', 'PROBLEM'),
    ('2444444444', 'c5_4', 'Shopping - Repuestos', 6, 5000, 0.02, 0.015, 600000, 50000000, 'TARGET_ROAS', 'B2C'),
    ('2444444444', 'c5_5', 'Video - Presentación Modelo X', 9, 50000, 0.002, 0.00, 80000, 30000000, 'MAXIMIZE_VIEWS', 'NOCONV'),
    ('2444444444', 'c5_6', 'Smart - Visitas Concesionario', 4, 800, 0.05, 0.05, 1500000, 40000000, 'MAXIMIZE_CLICKS', 'B2C'),

    -- Cuenta 6: Salud / Farma
    ('2555555555', 'c6_1', 'Search - Implantes Dentales', 2, 1500, 0.07, 0.03, 4000000, 200000000, 'TARGET_CPA', 'STAR'),
    ('2555555555', 'c6_2', 'Search - Ortodoncia Invisible (Problema)', 2, 2000, 0.05, 0.005, 5000000, 150000000, 'TARGET_CPA', 'PROBLEM'),
    ('2555555555', 'c6_3', 'PMax - Estética', 10, 8000, 0.02, 0.02, 2500000, 100000000, 'MAXIMIZE_CONVERSIONS', 'B2C'),
    ('2555555555', 'c6_4', 'Shopping - Parafarmacia', 6, 12000, 0.025, 0.03, 300000, 80000000, 'TARGET_ROAS', 'B2C'),
    ('2555555555', 'c6_5', 'Display - Branding Clínica', 3, 30000, 0.004, 0.001, 400000, 40000000, 'TARGET_CPA', 'B2C'),
    ('2555555555', 'c6_6', 'Search - Urgencias 24h (Sin Convs)', 2, 500, 0.10, 0.00, 8000000, 50000000, 'MANUAL_CPC', 'NOCONV'),

    -- Cuenta 7: Restauración
    ('2666666666', 'c7_1', 'Search - Restaurante Romántico', 2, 800, 0.08, 0.05, 800000, 30000000, 'TARGET_CPA', 'STAR'),
    ('2666666666', 'c7_2', 'Smart - Reservas Local', 4, 1500, 0.05, 0.06, 600000, 40000000, 'MAXIMIZE_CLICKS', 'B2C'),
    ('2666666666', 'c7_3', 'PMax - Menú Grupos', 10, 5000, 0.03, 0.02, 1000000, 50000000, 'MAXIMIZE_CONVERSIONS', 'B2B'),
    ('2666666666', 'c7_4', 'Search - Comida a Domicilio (CPA Alto)', 2, 3000, 0.06, 0.01, 1500000, 60000000, 'TARGET_CPA', 'PROBLEM'),
    ('2666666666', 'c7_5', 'Display - Oferta Mediodía', 3, 15000, 0.005, 0.01, 200000, 20000000, 'TARGET_CPA', 'B2C'),
    ('2666666666', 'c7_6', 'Search - Desayunos (Sin Convs)', 2, 1000, 0.04, 0.00, 500000, 15000000, 'MANUAL_CPC', 'NOCONV'),

    -- Cuenta 8: Finanzas
    ('2777777777', 'c8_1', 'Search - Hipotecas Fijas (Estrella)', 2, 2000, 0.05, 0.02, 6000000, 250000000, 'TARGET_CPA', 'STAR'),
    ('2777777777', 'c8_2', 'Search - Préstamos Rápidos (Problema)', 2, 5000, 0.06, 0.004, 4000000, 150000000, 'TARGET_CPA', 'PROBLEM'),
    ('2777777777', 'c8_3', 'PMax - Fondos de Inversión', 10, 10000, 0.02, 0.015, 3000000, 200000000, 'MAXIMIZE_CONVERSIONS', 'B2B'),
    ('2777777777', 'c8_4', 'Display - Retargeting Seguros', 3, 50000, 0.003, 0.002, 500000, 60000000, 'TARGET_CPA', 'B2C'),
    ('2777777777', 'c8_5', 'Video - Educación Financiera', 9, 60000, 0.001, 0.00, 100000, 30000000, 'MAXIMIZE_VIEWS', 'NOCONV'),
    ('2777777777', 'c8_6', 'Search - Criptomonedas (Sin Convs)', 2, 4000, 0.04, 0.00, 8000000, 100000000, 'MANUAL_CPC', 'NOCONV');

    -- ==========================================
    -- 4. BUCLE DE 84 DÍAS PARA GENERAR MÉTRICAS HISTÓRICAS
    -- ==========================================
    SET i = 0;
    WHILE i < 84 DO
        SET d = DATE_SUB(CURDATE(), INTERVAL i DAY);
        SET is_wknd = DAYOFWEEK(d);

        INSERT INTO campaign_metrics_history (
            customer_id, campaign_id, campaign_name, campaign_status, campaign_type, date, 
            impressions, clicks, ctr, average_cpc_micros, cost_micros, conversions, 
            conversion_rate, cost_per_conversion_micros, all_conversions, value_per_all_conversions, 
            budget_micros, bidding_strategy, search_impression_share, search_rank_lost_impression_share, search_budget_lost_impression_share
        )
        SELECT 
            cid, id, name, 'ENABLED', type, d,
            @impr := CAST(base_impr * (0.85 + (RAND() * 0.3)) * IF(profile LIKE '%B2B%' AND is_wknd IN (1,7), 0.7, 1.0) AS UNSIGNED),
            @clks := CAST(@impr * base_ctr * (0.9 + (RAND() * 0.2)) AS UNSIGNED),
            IF(@impr>0, @clks / @impr, 0),
            @cpc := CAST(base_cpc * (0.9 + (RAND() * 0.2)) AS UNSIGNED),
            @cost := CAST(@clks * @cpc AS UNSIGNED),
            @convs := IF(profile='NOCONV', 0, CAST(@clks * base_cvr * (0.8 + (RAND() * 0.4)) * IF(profile LIKE 'STAR%', 1.5, 1.0) AS UNSIGNED)),
            IF(@clks>0, @convs / @clks, 0),
            IF(@convs>0, @cost / @convs, 0),
            @convs,
            @convs * IF(profile LIKE 'STAR%', 250, 80), 
            budget, bid_strat,
            IF(type=2, 0.40 + (RAND() * 0.45), NULL), 
            IF(type=2, 0.05 + (RAND() * 0.20), NULL), 
            IF(type=2, 0.05 + (RAND() * 0.15), NULL)
        FROM temp_camps;

        SET i = i + 1;
    END WHILE;

    -- ==========================================
    -- 5. ENTIDADES RELACIONALES (AD GROUPS, KEYWORDS, SEARCH TERMS)
    -- ==========================================
    
    -- AD GROUPS
    INSERT INTO ad_groups (customer_id, ad_group_id, campaign_id, name, status, date, impressions, clicks, cost_micros, conversions, ctr, average_cpc_micros)
    SELECT cid, CONCAT('ag_', id), id, CONCAT('AdGroup - ', name), 'ENABLED', CURDATE(), base_impr*30, CAST(base_impr*30*base_ctr AS UNSIGNED), CAST(base_impr*30*base_ctr*base_cpc AS UNSIGNED), CAST(base_impr*30*base_ctr*base_cvr AS UNSIGNED), base_ctr, base_cpc
    FROM temp_camps;

    -- KEYWORDS TRAMPA (Gastando sin convertir)
    INSERT INTO keywords (customer_id, date, keyword_text, match_type, ad_group_id, campaign_id, status, is_negative, impressions, clicks, cost_micros, conversions) VALUES
    ('2000000000', CURDATE(), 'ropa online barata china', 'BROAD', 'ag_c1_2', 'c1_2', 'ENABLED', 0, 1500, 120, 144000000, 0),
    ('2111111111', CURDATE(), 'hoteles gratis', 'BROAD', 'ag_c2_3', 'c2_3', 'ENABLED', 0, 2000, 150, 375000000, 0),
    ('2222222222', CURDATE(), 'descargar crm gratis', 'BROAD', 'ag_c3_2', 'c3_2', 'ENABLED', 0, 800, 60, 480000000, 0),
    ('2333333333', CURDATE(), 'pisos embargados bancos', 'BROAD', 'ag_c4_1', 'c4_1', 'ENABLED', 0, 1200, 90, 180000000, 0),
    ('2444444444', CURDATE(), 'como arreglar motor', 'BROAD', 'ag_c5_3', 'c5_3', 'ENABLED', 0, 1000, 80, 240000000, 0),
    ('2555555555', CURDATE(), 'brackets caseros', 'BROAD', 'ag_c6_2', 'c6_2', 'ENABLED', 0, 900, 70, 350000000, 0),
    ('2666666666', CURDATE(), 'recetas comida', 'BROAD', 'ag_c7_4', 'c7_4', 'ENABLED', 0, 1500, 110, 165000000, 0),
    ('2777777777', CURDATE(), 'prestamos sin nomina', 'BROAD', 'ag_c8_2', 'c8_2', 'ENABLED', 0, 2000, 160, 640000000, 0);

    -- KEYWORDS NEGATIVAS
    INSERT INTO keywords (customer_id, date, keyword_text, match_type, ad_group_id, campaign_id, status, is_negative, impressions, clicks, cost_micros, conversions) VALUES
    ('2000000000', CURDATE(), 'gratis', 'EXACT', 'ag_c1_1', 'c1_1', 'ENABLED', 1, 0, 0, 0, 0),
    ('2222222222', CURDATE(), 'open source', 'PHRASE', 'ag_c3_1', 'c3_1', 'ENABLED', 1, 0, 0, 0, 0);

    -- SEARCH TERMS
    INSERT INTO search_terms (customer_id, date, search_term, campaign_id, ad_group_id, impressions, clicks, cost_micros, conversions) VALUES
    ('2000000000', CURDATE(), 'vestidos de fiesta rojos largos', 'c1_1', 'ag_c1_1', 300, 25, 11250000, 3),
    ('2000000000', CURDATE(), 'ropa barata online china', 'c1_2', 'ag_c1_2', 400, 40, 48000000, 0),
    ('2222222222', CURDATE(), 'mejor erp para pymes', 'c3_1', 'ag_c3_1', 150, 10, 50000000, 1),
    ('2222222222', CURDATE(), 'descargar crm gratis', 'c3_2', 'ag_c3_2', 200, 15, 120000000, 0);

    -- ASSET GROUPS (Para PMax)
    INSERT INTO asset_groups (customer_id, asset_group_id, campaign_id, name, status, performance_label) VALUES
    ('2000000000', 'agrp_c1_3', 'c1_3', 'Colección Verano', 'ENABLED', 'BEST'),
    ('2111111111', 'agrp_c2_2', 'c2_2', 'Ofertas Europa', 'ENABLED', 'GOOD'),
    ('2222222222', 'agrp_c3_3', 'c3_3', 'B2B Leads', 'ENABLED', 'LOW');

    INSERT INTO asset_group_assets (customer_id, asset_group_id, asset_id, field_type, performance_label) VALUES
    ('2000000000', 'agrp_c1_3', 'ast_1', 'HEADLINE', 'BEST'),
    ('2000000000', 'agrp_c1_3', 'ast_2', 'IMAGE', 'GOOD'),
    ('2222222222', 'agrp_c3_3', 'ast_3', 'DESCRIPTION', 'LOW');

    -- AUDIENCE SEGMENTS
    INSERT INTO audience_segments (customer_id, campaign_id, ad_group_id, criterion_id, type, name, impressions, clicks, cost_micros, conversions) VALUES
    ('2000000000', 'c1_1', 'ag_c1_1', 'aud_1', 'AGE_RANGE', '18-24', 5000, 400, 180000000, 20),
    ('2000000000', 'c1_1', 'ag_c1_1', 'aud_2', 'GENDER', 'Female', 8000, 700, 315000000, 45),
    ('2222222222', 'c3_1', 'ag_c3_1', 'aud_3', 'AGE_RANGE', '35-44', 2000, 100, 500000000, 5);

    -- ==========================================
    -- 6. RECOMENDACIONES PRE-GENERADAS
    -- ==========================================
    INSERT INTO recomendaciones (customer_id, titulo, descripcion, categoria, prioridad, impacto_estimado, tipo_objeto, objeto_id, estado, fecha_creacion) VALUES
    ('2000000000', 'Pausar keyword sin rendimiento', 'La keyword "ropa online barata china" ha gastado más de 140€ sin conversiones.', 'keywords', 'alta', 'Ahorro de 140€', 'keyword', 'ag_c1_2', 'pending', NOW()),
    ('2000000000', 'Reducir CPA Objetivo', 'La campaña "Rebajas Generales" tiene un CPA alto.', 'bidding', 'media', 'Reducción CPA 15%', 'campaign', 'c1_2', 'approved', DATE_SUB(NOW(), INTERVAL 2 DAY)),
    
    ('2222222222', 'Añadir palabra clave negativa', 'Usuarios buscan "descargar crm gratis", sin generar conversiones B2B.', 'keywords', 'alta', 'Ahorro de 480€', 'campaign', 'c3_2', 'pending', NOW()),
    ('2222222222', 'Mejorar creatividades PMax', 'El asset group "B2B Leads" tiene bajo rendimiento.', 'creative', 'media', '+5% CTR', 'asset_group', 'agrp_c3_3', 'pending', NOW()),
    
    ('2777777777', 'Pausar keyword irrelevante', 'La búsqueda "prestamos sin nomina" atrae clics de baja calidad.', 'keywords', 'alta', 'Mejora del ROAS', 'keyword', 'ag_c8_2', 'pending', NOW()),
    ('2444444444', 'Redistribuir presupuesto', 'La campaña "Coches SUV" está limitada por presupuesto con buen ROAS.', 'budget', 'alta', '+10 conversiones', 'campaign', 'c5_1', 'pending', NOW());

END //
DELIMITER ;

CALL GenerateExtendedDemoData();

-- Limpieza
DROP PROCEDURE IF EXISTS GenerateExtendedDemoData;

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
-- SELECT customer_id, COUNT(*) FROM campaign_metrics_history GROUP BY customer_id;
-- SELECT customer_id, campaign_id, campaign_type, COUNT(*) dias FROM campaign_metrics_history GROUP BY 1,2,3;
