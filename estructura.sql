/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.4.5-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: mi_saas
-- ------------------------------------------------------
-- Server version	11.4.5-MariaDB-0ubuntu0.24.10.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `accounts`
--

DROP TABLE IF EXISTS `accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `accounts` (
  `customer_id` varchar(50) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `is_mcc` tinyint(1) DEFAULT 0,
  `parent_account_id` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`customer_id`),
  KEY `idx_accounts_is_mcc` (`is_mcc`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ad_assets_history`
--

DROP TABLE IF EXISTS `ad_assets_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ad_assets_history` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `ad_group_id` varchar(50) DEFAULT NULL,
  `ad_id` varchar(50) DEFAULT NULL,
  `ad_row_id` varchar(50) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `asset_type` varchar(100) DEFAULT NULL,
  `asset_value` text DEFAULT NULL,
  `date_recorded` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ad_groups`
--

DROP TABLE IF EXISTS `ad_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ad_groups` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `ad_group_id` varchar(50) DEFAULT NULL,
  `ad_group_name` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `bid_micros` bigint(20) DEFAULT 0,
  `impressions` bigint(20) DEFAULT 0,
  `clicks` bigint(20) DEFAULT 0,
  `ctr` float DEFAULT 0,
  `cost_micros` bigint(20) DEFAULT 0,
  `average_cpc_micros` bigint(20) DEFAULT 0,
  `conversions` float DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ads`
--

DROP TABLE IF EXISTS `ads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ads` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `ad_group_id` varchar(50) DEFAULT NULL,
  `ad_id` varchar(50) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `ad_headline` text DEFAULT NULL,
  `ad_description` text DEFAULT NULL,
  `ad_type` varchar(100) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `impressions` bigint(20) DEFAULT 0,
  `clicks` bigint(20) DEFAULT 0,
  `ctr` float DEFAULT 0,
  `average_cpc_micros` bigint(20) DEFAULT 0,
  `cost_micros` bigint(20) DEFAULT 0,
  `conversions` float DEFAULT 0,
  `final_url` text DEFAULT NULL,
  `final_urls` text DEFAULT NULL,
  `final_mobile_urls` text DEFAULT NULL,
  `display_url` text DEFAULT NULL,
  `path1` varchar(255) DEFAULT NULL,
  `path2` varchar(255) DEFAULT NULL,
  `callouts` text DEFAULT NULL,
  `sitelinks` text DEFAULT NULL,
  `images` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `analysis_queue`
--

DROP TABLE IF EXISTS `analysis_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `analysis_queue` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `status` enum('pending','processing','completed','failed') DEFAULT 'pending',
  `attempts` int(11) DEFAULT 0,
  `max_attempts` int(11) DEFAULT 3,
  `error_message` text DEFAULT NULL,
  `last_error_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `recommendations_count` int(11) DEFAULT 0,
  `processing_time_seconds` float DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `asset_group_assets`
--

DROP TABLE IF EXISTS `asset_group_assets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_group_assets` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `asset_group_id` varchar(50) DEFAULT NULL,
  `asset_id` varchar(50) DEFAULT NULL,
  `field_type` varchar(100) DEFAULT NULL,
  `text_value` text DEFAULT NULL,
  `image_url` text DEFAULT NULL,
  `youtube_video_id` varchar(100) DEFAULT NULL,
  `performance_label` varchar(50) DEFAULT NULL,
  `impressions` bigint(20) DEFAULT 0,
  `clicks` bigint(20) DEFAULT 0,
  `cost_micros` bigint(20) DEFAULT 0,
  `conversions` float DEFAULT 0,
  `date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_asset` (`customer_id`,`asset_id`,`date`)
) ENGINE=InnoDB AUTO_INCREMENT=601 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `asset_groups`
--

DROP TABLE IF EXISTS `asset_groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `asset_groups` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `asset_group_id` varchar(50) DEFAULT NULL,
  `asset_group_name` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `impressions` bigint(20) DEFAULT 0,
  `clicks` bigint(20) DEFAULT 0,
  `ctr` float DEFAULT 0,
  `cost_micros` bigint(20) DEFAULT 0,
  `conversions` float DEFAULT 0,
  `conversions_value` float DEFAULT 0,
  `video_views` bigint(20) DEFAULT 0,
  `engagement_rate` float DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_asset_group` (`customer_id`,`asset_group_id`,`date`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `audience_segments`
--

DROP TABLE IF EXISTS `audience_segments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audience_segments` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `ad_group_id` varchar(50) DEFAULT NULL,
  `segment_type` varchar(50) DEFAULT NULL,
  `segment_value` varchar(255) DEFAULT NULL,
  `impressions` bigint(20) DEFAULT 0,
  `clicks` bigint(20) DEFAULT 0,
  `ctr` float DEFAULT 0,
  `conversions` float DEFAULT 0,
  `cost_micros` bigint(20) DEFAULT 0,
  `bid_modifier` float DEFAULT 0,
  `conversions_value` float DEFAULT 0,
  `value_per_conversion` float DEFAULT 0,
  `conversions_value_per_cost` float DEFAULT 0,
  `all_conversions_value` float DEFAULT 0,
  `all_conversions_value_per_cost` float DEFAULT 0,
  `cost_per_all_conversions` float DEFAULT 0,
  `date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_segment` (`customer_id`,`campaign_id`,`ad_group_id`,`segment_type`,`segment_value`,`date`)
) ENGINE=InnoDB AUTO_INCREMENT=45 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `campaign_languages`
--

DROP TABLE IF EXISTS `campaign_languages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign_languages` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `language_constant` varchar(255) DEFAULT NULL,
  `code` varchar(10) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_language` (`customer_id`,`campaign_id`,`language_constant`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `campaign_locations`
--

DROP TABLE IF EXISTS `campaign_locations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign_locations` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `geo_target_constant` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `country_code` varchar(10) DEFAULT NULL,
  `target_type` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_location` (`customer_id`,`campaign_id`,`geo_target_constant`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `campaign_metrics_history`
--

DROP TABLE IF EXISTS `campaign_metrics_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign_metrics_history` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `campaign_name` varchar(255) DEFAULT NULL,
  `campaign_status` varchar(100) DEFAULT NULL,
  `campaign_type` int(11) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `impressions` bigint(20) DEFAULT 0,
  `clicks` bigint(20) DEFAULT 0,
  `ctr` float DEFAULT 0,
  `average_cpc_micros` bigint(20) DEFAULT 0,
  `cost_micros` bigint(20) DEFAULT 0,
  `conversions` float DEFAULT 0,
  `conversion_rate` float DEFAULT 0,
  `cost_per_conversion_micros` bigint(20) DEFAULT 0,
  `all_conversions` float DEFAULT 0,
  `value_per_all_conversions` float DEFAULT 0,
  `budget_micros` bigint(20) DEFAULT 0,
  `bidding_strategy` varchar(100) DEFAULT NULL,
  `location_option_setting` varchar(255) DEFAULT NULL,
  `search_impression_share` float DEFAULT 0,
  `search_rank_lost_impression_share` float DEFAULT 0,
  `search_budget_lost_impression_share` float DEFAULT 0,
  `video_views` bigint(20) DEFAULT 0,
  `video_view_rate` float DEFAULT 0,
  `engagements` bigint(20) DEFAULT 0,
  `engagement_rate` float DEFAULT 0,
  `phone_calls` bigint(20) DEFAULT 0,
  `phone_impressions` bigint(20) DEFAULT 0,
  `phone_through_rate` float DEFAULT 0,
  `view_through_conversions` float DEFAULT 0,
  `percent_new_visitors` float DEFAULT 0,
  `average_time_on_site` float DEFAULT 0,
  `extra_metrics` longtext DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_campaign_day` (`customer_id`,`campaign_id`,`date`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `campaign_segment_metrics`
--

DROP TABLE IF EXISTS `campaign_segment_metrics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `campaign_segment_metrics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `age_range` varchar(50) DEFAULT NULL,
  `gender` varchar(50) DEFAULT NULL,
  `device` varchar(50) DEFAULT NULL,
  `region_id` varchar(100) DEFAULT NULL,
  `impressions` bigint(20) DEFAULT 0,
  `clicks` bigint(20) DEFAULT 0,
  `conversions` float DEFAULT 0,
  `cost_micros` bigint(20) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_segment` (`customer_id`,`campaign_id`,`date`,`age_range`,`gender`,`device`,`region_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `keywords`
--

DROP TABLE IF EXISTS `keywords`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `keywords` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `ad_group_id` varchar(50) DEFAULT NULL,
  `criterion_id` varchar(50) DEFAULT NULL,
  `keyword_text` varchar(255) DEFAULT NULL,
  `match_type` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `is_negative` tinyint(1) DEFAULT 0,
  `impressions` bigint(20) DEFAULT 0,
  `clicks` bigint(20) DEFAULT 0,
  `cost_micros` bigint(20) DEFAULT 0,
  `conversions` float DEFAULT 0,
  `average_cpc_micros` bigint(20) DEFAULT 0,
  `quality_score` int(11) DEFAULT NULL,
  `date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_keyword_day` (`customer_id`,`campaign_id`,`ad_group_id`,`criterion_id`,`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `password_resets`
--

DROP TABLE IF EXISTS `password_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_resets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `email` (`email`),
  KEY `idx_password_resets_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pending_users`
--

DROP TABLE IF EXISTS `pending_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pending_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_email_token` (`email`,`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `pmax_resource_metrics_history`
--

DROP TABLE IF EXISTS `pmax_resource_metrics_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pmax_resource_metrics_history` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `asset_group_id` varchar(50) DEFAULT NULL,
  `resource_type` varchar(50) DEFAULT NULL,
  `impressions` bigint(20) DEFAULT 0,
  `clicks` bigint(20) DEFAULT 0,
  `ctr` float DEFAULT 0,
  `cost_micros` bigint(20) DEFAULT 0,
  `conversions` float DEFAULT 0,
  `date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recomendaciones`
--

DROP TABLE IF EXISTS `recomendaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `recomendaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) NOT NULL,
  `titulo` varchar(255) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `categoria` varchar(100) DEFAULT NULL,
  `prioridad` enum('alta','media','baja') DEFAULT 'media',
  `impacto_estimado` varchar(100) DEFAULT NULL,
  `tipo_objeto` varchar(100) DEFAULT NULL,
  `objeto_id` varchar(100) DEFAULT NULL,
  `estado` enum('activa','pendiente','resuelta','descartada') DEFAULT 'pendiente',
  `fecha_aplicacion` datetime DEFAULT NULL,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_recomendaciones_customer_estado` (`customer_id`,`estado`),
  KEY `idx_recomendaciones_prioridad` (`prioridad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `search_terms`
--

DROP TABLE IF EXISTS `search_terms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `search_terms` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `campaign_id` varchar(50) DEFAULT NULL,
  `ad_group_id` varchar(50) DEFAULT NULL,
  `search_term` varchar(255) DEFAULT NULL,
  `keyword_text` varchar(255) DEFAULT NULL,
  `match_type` varchar(50) DEFAULT NULL,
  `impressions` bigint(20) DEFAULT 0,
  `clicks` bigint(20) DEFAULT 0,
  `ctr` float DEFAULT 0,
  `average_cpc_micros` bigint(20) DEFAULT 0,
  `cost_micros` bigint(20) DEFAULT 0,
  `conversions` float DEFAULT 0,
  `date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_term` (`customer_id`,`campaign_id`,`ad_group_id`,`search_term`,`date`)
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `ended_at` datetime DEFAULT NULL,
  `duration` int(11) DEFAULT NULL,
  `data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`data`)),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `expires_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `subscriptions`
--

DROP TABLE IF EXISTS `subscriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `subscriptions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `stripe_subscription_id` varchar(100) DEFAULT NULL,
  `stripe_customer_id` varchar(100) DEFAULT NULL,
  `plan` varchar(100) DEFAULT NULL,
  `status` enum('active','canceled','past_due','trial') DEFAULT 'active',
  `plan_name` varchar(100) DEFAULT NULL,
  `price_id` varchar(100) DEFAULT NULL,
  `current_period_start` datetime DEFAULT NULL,
  `current_period_end` datetime DEFAULT NULL,
  `cancel_at_period_end` tinyint(1) DEFAULT 0,
  `canceled_at` datetime DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `renewal_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_stripe_customer` (`stripe_customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sync_queue`
--

DROP TABLE IF EXISTS `sync_queue`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sync_queue` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(50) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `week_number` int(11) DEFAULT NULL,
  `task_type` enum('weekly','daily') DEFAULT 'daily',
  `status` enum('pending','processing','completed','failed') DEFAULT 'pending',
  `attempts` int(11) DEFAULT 0,
  `max_attempts` int(11) DEFAULT 3,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_id` (`customer_id`,`start_date`,`end_date`),
  UNIQUE KEY `uq_sync_queue_customer_range` (`customer_id`,`start_date`,`end_date`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `token_notifications`
--

DROP TABLE IF EXISTS `token_notifications`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `token_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `token_id` int(11) DEFAULT NULL,
  `customer_id` varchar(50) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `notification_type` enum('token_expiring','token_revoked','token_invalid') NOT NULL,
  `message` text DEFAULT NULL,
  `sent_at` timestamp NULL DEFAULT current_timestamp(),
  `resolved` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_token_notifications_token` (`token_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tokens`
--

DROP TABLE IF EXISTS `tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `customer_id` varchar(50) NOT NULL,
  `refresh_token` text DEFAULT NULL,
  `access_token` text DEFAULT NULL,
  `access_token_expiry` datetime DEFAULT NULL,
  `token_status` enum('valid','revoked','active','expired','force_expired') NOT NULL DEFAULT 'valid',
  `is_mcc` tinyint(1) DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_id` (`customer_id`,`user_id`),
  UNIQUE KEY `uq_tokens_customer_user` (`customer_id`,`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('user','admin') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'user',
  `is_active` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2025-10-22 16:16:47
