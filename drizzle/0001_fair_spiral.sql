CREATE TABLE `activityLog` (
	`id` varchar(64) NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` varchar(64) NOT NULL,
	`action` varchar(100) NOT NULL,
	`description` text,
	`userId` varchar(64),
	`metadata` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `activityLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`phone` varchar(20),
	`company` text,
	`billingAddress` text,
	`shippingAddress` text,
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_idx` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` varchar(64) NOT NULL,
	`invoiceId` varchar(64),
	`category` varchar(100),
	`description` text,
	`amount` decimal(10,2) NOT NULL,
	`expenseDate` timestamp DEFAULT (now()),
	`vendor` varchar(255),
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`createdBy` varchar(64),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` varchar(64) NOT NULL,
	`invoiceNumber` int NOT NULL,
	`quoteId` varchar(64),
	`customerId` varchar(64) NOT NULL,
	`status` enum('quote','pending','in_production','ready_to_print','ready_to_sew','production_finished','shipped','completed','paid','partial_paid','overdue') NOT NULL DEFAULT 'pending',
	`totalAmount` decimal(10,2) DEFAULT '0.00',
	`paidAmount` decimal(10,2) DEFAULT '0.00',
	`taxAmount` decimal(10,2) DEFAULT '0.00',
	`taxRate` decimal(5,2) DEFAULT '0.00',
	`deliveryMethod` varchar(100),
	`poNumber` varchar(100),
	`terms` varchar(100),
	`paymentDueDate` timestamp,
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`createdBy` varchar(64),
	`productionDueDate` timestamp,
	`customerDueDate` timestamp,
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoice_number_idx` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `lineItems` (
	`id` varchar(64) NOT NULL,
	`quoteId` varchar(64),
	`invoiceId` varchar(64),
	`category` varchar(50),
	`itemNumber` varchar(100),
	`description` text,
	`color` varchar(100),
	`quantity` int DEFAULT 0,
	`unitPrice` decimal(10,2) DEFAULT '0.00',
	`totalPrice` decimal(10,2) DEFAULT '0.00',
	`sizes` text,
	`imprintLocation` varchar(100),
	`artworkUrl` text,
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `lineItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` varchar(64) NOT NULL,
	`invoiceId` varchar(64),
	`quoteId` varchar(64),
	`customerId` varchar(64),
	`fromUserId` varchar(64),
	`toEmail` varchar(320),
	`subject` text,
	`body` text,
	`messageType` enum('internal','email','sms') DEFAULT 'internal',
	`sentAt` timestamp,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` varchar(64) NOT NULL,
	`invoiceId` varchar(64) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`paymentMethod` varchar(50),
	`paymentDate` timestamp DEFAULT (now()),
	`transactionId` varchar(255),
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`createdBy` varchar(64),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` varchar(64) NOT NULL,
	`itemNumber` varchar(100),
	`name` text NOT NULL,
	`brand` varchar(100),
	`category` varchar(50),
	`description` text,
	`basePrice` decimal(10,2) DEFAULT '0.00',
	`colors` text,
	`sizes` text,
	`imageUrl` text,
	`active` boolean DEFAULT true,
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` varchar(64) NOT NULL,
	`quoteNumber` int NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`status` enum('quote','approved','rejected','converted') NOT NULL DEFAULT 'quote',
	`totalAmount` decimal(10,2) DEFAULT '0.00',
	`taxAmount` decimal(10,2) DEFAULT '0.00',
	`taxRate` decimal(5,2) DEFAULT '0.00',
	`deliveryMethod` varchar(100),
	`poNumber` varchar(100),
	`terms` varchar(100),
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`createdBy` varchar(64),
	`productionDueDate` timestamp,
	`customerDueDate` timestamp,
	`updatedAt` timestamp DEFAULT (now()),
	CONSTRAINT `quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `quote_number_idx` UNIQUE(`quoteNumber`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` varchar(64) NOT NULL,
	`name` text NOT NULL,
	`invoiceId` varchar(64),
	`quoteId` varchar(64),
	`assignedTo` varchar(64),
	`dueDate` timestamp,
	`completed` boolean DEFAULT false,
	`completedAt` timestamp,
	`priority` enum('low','medium','high','urgent') DEFAULT 'medium',
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`createdBy` varchar(64),
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `activity_entity_idx` ON `activityLog` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `expense_invoice_idx` ON `expenses` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `invoice_customer_idx` ON `invoices` (`customerId`);--> statement-breakpoint
CREATE INDEX `invoice_status_idx` ON `invoices` (`status`);--> statement-breakpoint
CREATE INDEX `invoice_quote_idx` ON `invoices` (`quoteId`);--> statement-breakpoint
CREATE INDEX `lineitem_quote_idx` ON `lineItems` (`quoteId`);--> statement-breakpoint
CREATE INDEX `lineitem_invoice_idx` ON `lineItems` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `message_invoice_idx` ON `messages` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `message_quote_idx` ON `messages` (`quoteId`);--> statement-breakpoint
CREATE INDEX `message_customer_idx` ON `messages` (`customerId`);--> statement-breakpoint
CREATE INDEX `payment_invoice_idx` ON `payments` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `product_item_number_idx` ON `products` (`itemNumber`);--> statement-breakpoint
CREATE INDEX `quote_customer_idx` ON `quotes` (`customerId`);--> statement-breakpoint
CREATE INDEX `quote_status_idx` ON `quotes` (`status`);--> statement-breakpoint
CREATE INDEX `task_assigned_idx` ON `tasks` (`assignedTo`);--> statement-breakpoint
CREATE INDEX `task_invoice_idx` ON `tasks` (`invoiceId`);--> statement-breakpoint
CREATE INDEX `task_completed_idx` ON `tasks` (`completed`);