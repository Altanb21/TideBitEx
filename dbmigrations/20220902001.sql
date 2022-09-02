ALTER TABLE `outer_trades`
ADD COLUMN (
        `trade_id` int(11) DEFAULT NULL,
        `voucher_id` int(11) DEFAULT NULL,
        `create_at` datetime DEFAULT NULL
    );