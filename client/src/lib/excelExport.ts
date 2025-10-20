/**
 * Excel Export Utilities
 * 
 * Export data to Excel spreadsheets for reporting
 */

import * as XLSX from "xlsx";

interface Quote {
  quoteNumber: number;
  customerId: string;
  status: string;
  totalAmount: string | null;
  createdAt: Date | null;
  dueDate: Date | null;
}

interface Invoice {
  invoiceNumber: number;
  customerId: string;
  status: string;
  totalAmount: string | null;
  paidAmount: string | null;
  createdAt: Date | null;
  dueDate: Date | null;
}

interface Customer {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  createdAt: Date | null;
}

interface Product {
  itemNumber: string | null;
  description: string | null;
  category: string | null;
  unitPrice: string | null;
}

/**
 * Format date for Excel
 */
function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US");
}

/**
 * Format currency for Excel
 */
function formatCurrency(amount: string | null | undefined): string {
  if (!amount) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(parseFloat(amount));
}

/**
 * Export quotes to Excel
 */
export function exportQuotesToExcel(quotes: Quote[], customers: Map<string, Customer>) {
  const data = quotes.map((quote) => {
    const customer = customers.get(quote.customerId);
    return {
      "Quote #": quote.quoteNumber,
      "Customer": customer?.name || "Unknown",
      "Company": customer?.company || "",
      "Status": quote.status,
      "Total": formatCurrency(quote.totalAmount),
      "Created": formatDate(quote.createdAt),
      "Due Date": formatDate(quote.dueDate),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Quotes");

  // Auto-size columns
  const maxWidth = 20;
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.min(
      maxWidth,
      Math.max(
        key.length,
        ...data.map((row) => String(row[key as keyof typeof row]).length)
      )
    ),
  }));
  worksheet["!cols"] = colWidths;

  XLSX.writeFile(workbook, `Quotes_${new Date().toISOString().split("T")[0]}.xlsx`);
}

/**
 * Export invoices to Excel
 */
export function exportInvoicesToExcel(invoices: Invoice[], customers: Map<string, Customer>) {
  const data = invoices.map((invoice) => {
    const customer = customers.get(invoice.customerId);
    const total = parseFloat(invoice.totalAmount || "0");
    const paid = parseFloat(invoice.paidAmount || "0");
    const balance = total - paid;

    return {
      "Invoice #": invoice.invoiceNumber,
      "Customer": customer?.name || "Unknown",
      "Company": customer?.company || "",
      "Status": invoice.status,
      "Total": formatCurrency(invoice.totalAmount),
      "Paid": formatCurrency(invoice.paidAmount),
      "Balance": formatCurrency(balance.toString()),
      "Created": formatDate(invoice.createdAt),
      "Due Date": formatDate(invoice.dueDate),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Invoices");

  // Auto-size columns
  const maxWidth = 20;
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.min(
      maxWidth,
      Math.max(
        key.length,
        ...data.map((row) => String(row[key as keyof typeof row]).length)
      )
    ),
  }));
  worksheet["!cols"] = colWidths;

  XLSX.writeFile(workbook, `Invoices_${new Date().toISOString().split("T")[0]}.xlsx`);
}

/**
 * Export customers to Excel
 */
export function exportCustomersToExcel(customers: Customer[]) {
  const data = customers.map((customer) => ({
    "Name": customer.name,
    "Company": customer.company || "",
    "Email": customer.email || "",
    "Phone": customer.phone || "",
    "Created": formatDate(customer.createdAt),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

  // Auto-size columns
  const maxWidth = 30;
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.min(
      maxWidth,
      Math.max(
        key.length,
        ...data.map((row) => String(row[key as keyof typeof row]).length)
      )
    ),
  }));
  worksheet["!cols"] = colWidths;

  XLSX.writeFile(workbook, `Customers_${new Date().toISOString().split("T")[0]}.xlsx`);
}

/**
 * Export products to Excel
 */
export function exportProductsToExcel(products: Product[]) {
  const data = products.map((product) => ({
    "Item #": product.itemNumber || "",
    "Description": product.description || "",
    "Category": product.category || "",
    "Unit Price": formatCurrency(product.unitPrice),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Products");

  // Auto-size columns
  const maxWidth = 40;
  const colWidths = Object.keys(data[0] || {}).map((key) => ({
    wch: Math.min(
      maxWidth,
      Math.max(
        key.length,
        ...data.map((row) => String(row[key as keyof typeof row]).length)
      )
    ),
  }));
  worksheet["!cols"] = colWidths;

  XLSX.writeFile(workbook, `Products_${new Date().toISOString().split("T")[0]}.xlsx`);
}

/**
 * Export revenue report to Excel
 */
export function exportRevenueReportToExcel(data: {
  totalRevenue: number;
  totalOutstanding: number;
  paidInvoices: Invoice[];
  unpaidInvoices: Invoice[];
  customers: Map<string, Customer>;
}) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ["Revenue Report", ""],
    ["Generated", new Date().toLocaleDateString()],
    ["", ""],
    ["Total Revenue (Paid)", formatCurrency(data.totalRevenue.toString())],
    ["Total Outstanding", formatCurrency(data.totalOutstanding.toString())],
    ["Total Invoices", data.paidInvoices.length + data.unpaidInvoices.length],
    ["Paid Invoices", data.paidInvoices.length],
    ["Unpaid Invoices", data.unpaidInvoices.length],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Paid invoices sheet
  const paidData = data.paidInvoices.map((invoice) => {
    const customer = data.customers.get(invoice.customerId);
    return {
      "Invoice #": invoice.invoiceNumber,
      "Customer": customer?.name || "Unknown",
      "Amount": formatCurrency(invoice.totalAmount),
      "Paid": formatDate(invoice.createdAt),
    };
  });
  if (paidData.length > 0) {
    const paidSheet = XLSX.utils.json_to_sheet(paidData);
    XLSX.utils.book_append_sheet(workbook, paidSheet, "Paid Invoices");
  }

  // Unpaid invoices sheet
  const unpaidData = data.unpaidInvoices.map((invoice) => {
    const customer = data.customers.get(invoice.customerId);
    const total = parseFloat(invoice.totalAmount || "0");
    const paid = parseFloat(invoice.paidAmount || "0");
    const balance = total - paid;

    return {
      "Invoice #": invoice.invoiceNumber,
      "Customer": customer?.name || "Unknown",
      "Total": formatCurrency(invoice.totalAmount),
      "Paid": formatCurrency(invoice.paidAmount),
      "Balance": formatCurrency(balance.toString()),
      "Due Date": formatDate(invoice.dueDate),
    };
  });
  if (unpaidData.length > 0) {
    const unpaidSheet = XLSX.utils.json_to_sheet(unpaidData);
    XLSX.utils.book_append_sheet(workbook, unpaidSheet, "Unpaid Invoices");
  }

  XLSX.writeFile(workbook, `Revenue_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
}

