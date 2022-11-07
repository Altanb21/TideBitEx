ALTER TABLE `outer_trades`
ADD COLUMN (
        `currency` int(11) DEFAULT NULL,
        `kind` varchar(10) DEFAULT NULL,
        `voucher_price` decimal (32, 16) DEFAULT NULL,
        `voucher_volume` decimal (32, 16) DEFAULT NULL,
        `voucher_fee` decimal (32, 16) DEFAULT NULL,
        `voucher_fee_currency` varchar(255) DEFAULT NULL,
        `ask_account_version_id` int(11) DEFAULT NULL,
        `bid_account_version_id` int(11) DEFAULT NULL,
        `order_full_filled_account_version_id` int(11) DEFAULT NULL,
        `referral_commission_id` int(11) DEFAULT NULL,
        `referral` decimal (32, 16) DEFAULT NULL
    );