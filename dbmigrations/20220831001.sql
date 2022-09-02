ALTER TABLE `outer_trades`
ADD COLUMN (
        `member_id` int(11) DEFAULT NULL,
        `email` varchar(255) DEFAULT NULL,
        `member_tag` int(11) DEFAULT NULL,
        `order_id` int(11) DEFAULT NULL,
        `order_price` decimal (32, 16) DEFAULT NULL,
        `order_origin_volume` decimal (32, 16) DEFAULT NULL
    );