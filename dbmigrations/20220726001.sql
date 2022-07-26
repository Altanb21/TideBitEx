-- create outer_trades table to store outer trades
CREATE TABLE IF NOT EXISTS `outer_trades` (
	`id` int(11) NOT NULL DEFAULT '0',
	`exchange_code` int(11) DEFAULT NULL,
	`update_at` datetime DEFAULT NULL,
	`status` tinyint (4) DEFAULT NULL,
`data` text,
UNIQUE KEY `index_outer_trades_on_id_and_exchange_code` (`id`, `exchange_code`)
USING BTREE) ENGINE = InnoDB DEFAULT CHARSET = latin1;

-- add trade_fk column to trades table
ALTER TABLE `trades` ADD `trade_fk` int(11) DEFAULT NULL;