-- create outer_orders table to store outer orders
CREATE TABLE IF NOT EXISTS `outer_orders` (
	`id` int(11) NOT NULL DEFAULT '0',
	`exchange_code` int(11) DEFAULT NULL,
	`market` int(11) DEFAULT NULL,
	`price` decimal (32, 16) DEFAULT NULL,
	`volume` decimal (32, 16) DEFAULT NULL,
	`average_filled_price` decimal (32, 16) DEFAULT NULL,
	`accumulate_filled_volume` decimal (32, 16) DEFAULT NULL,
	`state` varchar(255) DEFAULT NULL,
	`created_at` datetime DEFAULT NULL,
	`updated_at` datetime DEFAULT NULL,
	`data` text,
	UNIQUE KEY `index_outer_orders_on_id_and_exchange_code` (`id`, `exchange_code`) USING BTREE
) ENGINE = InnoDB DEFAULT CHARSET = latin1;
-- add outer_order_id, outer_exchange_code column to orders table
ALTER TABLE `orders`
ADD COLUMN (
	`outer_order_id` int(11) DEFAULT NULL,
	`outer_exchange_code` int(11) DEFAULT NULL,
	);