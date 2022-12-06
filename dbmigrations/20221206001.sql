CREATE TABLE `fixed_account_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) DEFAULT NULL,
  `member_id` int(11) DEFAULT NULL,
  `currency` int(11) DEFAULT NULL,
  `audit_account_records_id` int(11) DEFAULT NULL,
  `origin_balance` decimal(32,16) DEFAULT NULL,
  `balance` decimal(32,16) DEFAULT NULL,
  `origin_locked` decimal(32,16) DEFAULT NULL,
  `locked` decimal(32,16) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `issued_by` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=latin1;