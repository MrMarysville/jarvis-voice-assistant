CREATE TABLE `lineItemGroups` (
	`id` varchar(64) NOT NULL,
	`quoteId` varchar(64),
	`invoiceId` varchar(64),
	`name` varchar(255) NOT NULL,
	`category` varchar(50),
	`imprintLocation` varchar(100),
	`artworkUrl` text,
	`notes` text,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `lineItemGroups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lineItems` ADD `groupId` varchar(64);--> statement-breakpoint
ALTER TABLE `lineItems` ADD `productId` varchar(64);--> statement-breakpoint
ALTER TABLE `lineItems` ADD `sortOrder` int DEFAULT 0;--> statement-breakpoint
CREATE INDEX `lineitemgroup_quote_idx` ON `lineItemGroups` (`quoteId`);--> statement-breakpoint
CREATE INDEX `lineitemgroup_invoice_idx` ON `lineItemGroups` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `lineitem_group_idx` ON `lineItems` (`groupId`);--> statement-breakpoint
CREATE INDEX `lineitem_product_idx` ON `lineItems` (`productId`);--> statement-breakpoint
ALTER TABLE `lineItems` DROP COLUMN `category`;--> statement-breakpoint
ALTER TABLE `lineItems` DROP COLUMN `imprintLocation`;--> statement-breakpoint
ALTER TABLE `lineItems` DROP COLUMN `artworkUrl`;