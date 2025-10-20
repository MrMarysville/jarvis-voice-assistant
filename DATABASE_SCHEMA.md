# Jarvis Database Schema Design

## Overview

This document outlines the database schema for Jarvis, a comprehensive shop management system for screen printing and embroidery businesses. The schema is designed to support quoting, invoicing, production tracking, task management, customer relationship management, and financial reporting.

## Core Entities

### 1. Customers

Stores customer information and contact details.

| Field | Type | Description |
|-------|------|-------------|
| id | varchar(64) | Primary key |
| name | text | Customer full name |
| email | varchar(320) | Customer email address |
| phone | varchar(20) | Customer phone number |
| company | text | Company/organization name |
| billingAddress | text | Billing address (JSON) |
| shippingAddress | text | Shipping address (JSON) |
| notes | text | Internal notes about customer |
| createdAt | timestamp | Record creation timestamp |
| updatedAt | timestamp | Last update timestamp |

### 2. Quotes

Represents quote/estimate requests from customers.

| Field | Type | Description |
|-------|------|-------------|
| id | varchar(64) | Primary key |
| quoteNumber | int | Auto-incrementing quote number |
| customerId | varchar(64) | Foreign key to customers |
| status | enum | Quote status (quote, approved, rejected, converted) |
| totalAmount | decimal(10,2) | Total quote amount |
| taxAmount | decimal(10,2) | Tax amount |
| taxRate | decimal(5,2) | Tax rate percentage |
| deliveryMethod | varchar(100) | Delivery method (UPS, FedEx, Pickup, etc.) |
| poNumber | varchar(100) | Customer PO number |
| terms | varchar(100) | Payment terms |
| notes | text | Quote notes |
| createdAt | timestamp | Quote creation date |
| createdBy | varchar(64) | User who created quote |
| productionDueDate | timestamp | Production due date |
| customerDueDate | timestamp | Customer due date |
| updatedAt | timestamp | Last update timestamp |

### 3. Invoices

Represents approved quotes converted to invoices.

| Field | Type | Description |
|-------|------|-------------|
| id | varchar(64) | Primary key |
| invoiceNumber | int | Auto-incrementing invoice number |
| quoteId | varchar(64) | Foreign key to quotes (nullable) |
| customerId | varchar(64) | Foreign key to customers |
| status | enum | Invoice status (pending, paid, partial, overdue, completed) |
| totalAmount | decimal(10,2) | Total invoice amount |
| paidAmount | decimal(10,2) | Amount paid |
| taxAmount | decimal(10,2) | Tax amount |
| taxRate | decimal(5,2) | Tax rate percentage |
| deliveryMethod | varchar(100) | Delivery method |
| poNumber | varchar(100) | Customer PO number |
| terms | varchar(100) | Payment terms |
| paymentDueDate | timestamp | Payment due date |
| notes | text | Invoice notes |
| createdAt | timestamp | Invoice creation date |
| createdBy | varchar(64) | User who created invoice |
| productionDueDate | timestamp | Production due date |
| customerDueDate | timestamp | Customer due date |
| updatedAt | timestamp | Last update timestamp |

### 4. LineItems

Individual items on quotes/invoices.

| Field | Type | Description |
|-------|------|-------------|
| id | varchar(64) | Primary key |
| quoteId | varchar(64) | Foreign key to quotes (nullable) |
| invoiceId | varchar(64) | Foreign key to invoices (nullable) |
| category | varchar(50) | Category (Embroidery, Screen Print, Digital, etc.) |
| itemNumber | varchar(100) | Product item number |
| description | text | Item description |
| color | varchar(100) | Item color |
| quantity | int | Total quantity |
| unitPrice | decimal(10,2) | Price per unit |
| totalPrice | decimal(10,2) | Total line item price |
| sizes | text | Size breakdown (JSON: {S: 10, M: 20, L: 15, etc.}) |
| imprintLocation | varchar(100) | Imprint location (Front, Back, Left Chest, etc.) |
| artworkUrl | text | URL to artwork file |
| notes | text | Line item notes |
| createdAt | timestamp | Record creation timestamp |

### 5. Tasks

Production and administrative tasks.

| Field | Type | Description |
|-------|------|-------------|
| id | varchar(64) | Primary key |
| name | text | Task name/description |
| invoiceId | varchar(64) | Foreign key to invoices (nullable) |
| quoteId | varchar(64) | Foreign key to quotes (nullable) |
| assignedTo | varchar(64) | Foreign key to users (nullable) |
| dueDate | timestamp | Task due date |
| completed | boolean | Task completion status |
| completedAt | timestamp | Task completion timestamp |
| priority | enum | Priority (low, medium, high, urgent) |
| notes | text | Task notes |
| createdAt | timestamp | Task creation timestamp |
| createdBy | varchar(64) | User who created task |

### 6. Payments

Payment transactions for invoices.

| Field | Type | Description |
|-------|------|-------------|
| id | varchar(64) | Primary key |
| invoiceId | varchar(64) | Foreign key to invoices |
| amount | decimal(10,2) | Payment amount |
| paymentMethod | varchar(50) | Payment method (Cash, Check, Credit Card, ACH, etc.) |
| paymentDate | timestamp | Payment date |
| transactionId | varchar(255) | External transaction ID |
| notes | text | Payment notes |
| createdAt | timestamp | Record creation timestamp |
| createdBy | varchar(64) | User who recorded payment |

### 7. Expenses

Business expenses tracked per order or shop-wide.

| Field | Type | Description |
|-------|------|-------------|
| id | varchar(64) | Primary key |
| invoiceId | varchar(64) | Foreign key to invoices (nullable for shop expenses) |
| category | varchar(100) | Expense category |
| description | text | Expense description |
| amount | decimal(10,2) | Expense amount |
| expenseDate | timestamp | Expense date |
| vendor | varchar(255) | Vendor name |
| notes | text | Expense notes |
| createdAt | timestamp | Record creation timestamp |
| createdBy | varchar(64) | User who created expense |

### 8. Products

Product catalog for quick quote/invoice creation.

| Field | Type | Description |
|-------|------|-------------|
| id | varchar(64) | Primary key |
| itemNumber | varchar(100) | Product item number |
| name | text | Product name |
| brand | varchar(100) | Product brand |
| category | varchar(50) | Category (Embroidery, Screen Print, etc.) |
| description | text | Product description |
| basePrice | decimal(10,2) | Base price |
| colors | text | Available colors (JSON array) |
| sizes | text | Available sizes (JSON array) |
| imageUrl | text | Product image URL |
| active | boolean | Product active status |
| createdAt | timestamp | Record creation timestamp |

### 9. Messages

Internal messages and customer communications.

| Field | Type | Description |
|-------|------|-------------|
| id | varchar(64) | Primary key |
| invoiceId | varchar(64) | Foreign key to invoices (nullable) |
| quoteId | varchar(64) | Foreign key to quotes (nullable) |
| customerId | varchar(64) | Foreign key to customers (nullable) |
| fromUserId | varchar(64) | Foreign key to users (nullable) |
| toEmail | varchar(320) | Recipient email |
| subject | text | Message subject |
| body | text | Message body |
| messageType | enum | Type (internal, email, sms) |
| sentAt | timestamp | Message sent timestamp |
| createdAt | timestamp | Record creation timestamp |

### 10. ActivityLog

Audit trail for all changes.

| Field | Type | Description |
|-------|------|-------------|
| id | varchar(64) | Primary key |
| entityType | varchar(50) | Entity type (quote, invoice, customer, etc.) |
| entityId | varchar(64) | Entity ID |
| action | varchar(100) | Action performed |
| description | text | Human-readable description |
| userId | varchar(64) | User who performed action |
| metadata | text | Additional metadata (JSON) |
| createdAt | timestamp | Activity timestamp |

## Enumerations

### Quote/Invoice Status

**Quote Status:**
- `quote` - Initial quote state
- `approved` - Customer approved
- `rejected` - Customer rejected
- `converted` - Converted to invoice

**Invoice Status:**
- `quote` - Still in quote phase
- `pending` - Awaiting production/payment
- `in_production` - Currently in production
- `ready_to_print` - Ready for printing
- `ready_to_sew` - Ready for embroidery
- `production_finished` - Production complete
- `shipped` - Order shipped
- `completed` - Order completed
- `paid` - Fully paid
- `partial_paid` - Partially paid
- `overdue` - Payment overdue

### Task Priority
- `low` - Low priority
- `medium` - Medium priority
- `high` - High priority
- `urgent` - Urgent priority

### Message Type
- `internal` - Internal note
- `email` - Email to customer
- `sms` - SMS to customer

## Relationships

```
customers (1) ----< (many) quotes
customers (1) ----< (many) invoices
quotes (1) ----< (many) lineItems
invoices (1) ----< (many) lineItems
invoices (1) ----< (many) tasks
invoices (1) ----< (many) payments
invoices (1) ----< (many) expenses
invoices (1) ----< (many) messages
users (1) ----< (many) tasks (assignedTo)
users (1) ----< (many) quotes (createdBy)
users (1) ----< (many) invoices (createdBy)
```

## Indexes

For optimal query performance:

- `customers.email` - Unique index
- `quotes.quoteNumber` - Unique index
- `quotes.customerId` - Index
- `quotes.status` - Index
- `invoices.invoiceNumber` - Unique index
- `invoices.customerId` - Index
- `invoices.status` - Index
- `lineItems.quoteId` - Index
- `lineItems.invoiceId` - Index
- `tasks.assignedTo` - Index
- `tasks.invoiceId` - Index
- `tasks.completed` - Index
- `payments.invoiceId` - Index
- `expenses.invoiceId` - Index
- `products.itemNumber` - Index
- `activityLog.entityType, entityId` - Composite index

## Data Validation Rules

1. **Email addresses** must be valid format
2. **Phone numbers** should be normalized
3. **Amounts** must be non-negative
4. **Dates** must be valid timestamps
5. **Status transitions** must follow allowed workflows
6. **Quote/Invoice numbers** must be sequential and unique
7. **Line item totals** must match calculated values
8. **Invoice paid amount** cannot exceed total amount

## Future Enhancements

1. **Inventory Management** - Track stock levels for products
2. **Vendor Management** - Manage supplier relationships
3. **Purchase Orders** - Create POs for product ordering
4. **Storefronts** - Online ordering for customers
5. **Shipping Integration** - Track shipments with carriers
6. **Advanced Reporting** - Custom report builder
7. **Multi-location Support** - Support for multiple shop locations

