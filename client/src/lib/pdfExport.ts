/**
 * PDF Export Utilities
 * 
 * Generate professional PDFs for quotes and invoices
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Company {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

interface Customer {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
}

interface LineItem {
  itemNumber?: string;
  description?: string;
  color?: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

interface LineItemGroup {
  name: string;
  items: LineItem[];
  imprints: Imprint[];
}

interface Imprint {
  location?: string;
  decorationMethod?: string;
  colors?: number;
  setupFee?: string;
  unitPrice?: string;
  quantity: number;
}

interface QuoteData {
  quoteNumber: number;
  date: Date;
  dueDate?: Date | null;
  customer: Customer;
  lineItemGroups: LineItemGroup[];
  subtotal: number;
  tax?: number;
  total: number;
  notes?: string;
}

interface InvoiceData extends QuoteData {
  invoiceNumber: number;
  status: string;
  paidAmount?: number;
}

const COMPANY: Company = {
  name: "Your Print Shop",
  address: "123 Main St, City, ST 12345",
  phone: "(555) 123-4567",
  email: "info@yourprintshop.com",
};

function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function addHeader(doc: jsPDF, title: string, number: number) {
  // Company name
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY.name, 20, 20);

  // Company details
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (COMPANY.address) doc.text(COMPANY.address, 20, 28);
  if (COMPANY.phone) doc.text(COMPANY.phone, 20, 34);
  if (COMPANY.email) doc.text(COMPANY.email, 20, 40);

  // Document title and number
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(`${title} #${number}`, 200, 20, { align: "right" });
}

function addCustomerInfo(doc: jsPDF, customer: Customer, y: number) {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 20, y);

  doc.setFont("helvetica", "normal");
  doc.text(customer.name, 20, y + 7);
  if (customer.company) doc.text(customer.company, 20, y + 14);
  if (customer.email) doc.text(customer.email, 20, y + 21);
  if (customer.phone) doc.text(customer.phone, 20, y + 28);

  return y + 35;
}

function addLineItemGroups(doc: jsPDF, groups: LineItemGroup[], startY: number): number {
  let currentY = startY;

  for (const group of groups) {
    // Group header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(group.name, 20, currentY);
    currentY += 7;

    // Products table
    if (group.items.length > 0) {
      const productRows = group.items.map((item) => [
        item.itemNumber || "-",
        item.description || "-",
        item.color || "-",
        item.quantity.toString(),
        formatCurrency(item.unitPrice),
        formatCurrency(item.totalPrice),
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Item #", "Description", "Color", "Qty", "Unit Price", "Total"]],
        body: productRows,
        theme: "striped",
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 20, right: 20 },
        styles: { fontSize: 9 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
    }

    // Imprints table
    if (group.imprints.length > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Imprints:", 20, currentY);
      currentY += 5;

      const imprintRows = group.imprints.map((imprint) => [
        imprint.location || "-",
        imprint.decorationMethod || "-",
        imprint.colors?.toString() || "-",
        formatCurrency(imprint.setupFee || "0"),
        formatCurrency(imprint.unitPrice || "0"),
        imprint.quantity.toString(),
        formatCurrency(
          parseFloat(imprint.setupFee || "0") +
            parseFloat(imprint.unitPrice || "0") * imprint.quantity
        ),
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Location", "Method", "Colors", "Setup Fee", "Per Item", "Qty", "Total"]],
        body: imprintRows,
        theme: "striped",
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 20, right: 20 },
        styles: { fontSize: 9 },
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    // Add spacing between groups
    currentY += 5;
  }

  return currentY;
}

function addTotals(doc: jsPDF, data: QuoteData | InvoiceData, y: number) {
  const rightX = 200;
  const labelX = rightX - 60;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  // Subtotal
  doc.text("Subtotal:", labelX, y, { align: "right" });
  doc.text(formatCurrency(data.subtotal), rightX, y, { align: "right" });
  y += 7;

  // Tax (if applicable)
  if (data.tax) {
    doc.text("Tax:", labelX, y, { align: "right" });
    doc.text(formatCurrency(data.tax), rightX, y, { align: "right" });
    y += 7;
  }

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Total:", labelX, y, { align: "right" });
  doc.text(formatCurrency(data.total), rightX, y, { align: "right" });

  // Paid amount (for invoices)
  if ("invoiceNumber" in data && data.paidAmount) {
    y += 10;
    doc.setFontSize(11);
    doc.text("Paid:", labelX, y, { align: "right" });
    doc.text(formatCurrency(data.paidAmount), rightX, y, { align: "right" });

    y += 7;
    doc.text("Balance Due:", labelX, y, { align: "right" });
    doc.text(formatCurrency(data.total - data.paidAmount), rightX, y, { align: "right" });
  }

  return y + 15;
}

function addNotes(doc: jsPDF, notes: string | undefined, y: number) {
  if (!notes) return y;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Notes:", 20, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  const splitNotes = doc.splitTextToSize(notes, 170);
  doc.text(splitNotes, 20, y);

  return y + splitNotes.length * 5 + 10;
}

export function exportQuoteToPDF(data: QuoteData) {
  const doc = new jsPDF();

  // Header
  addHeader(doc, "Quote", data.quoteNumber);

  // Date info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${formatDate(data.date)}`, 200, 30, { align: "right" });
  if (data.dueDate) {
    doc.text(`Due Date: ${formatDate(data.dueDate)}`, 200, 37, { align: "right" });
  }

  // Customer info
  let currentY = addCustomerInfo(doc, data.customer, 55);

  // Line item groups
  currentY = addLineItemGroups(doc, data.lineItemGroups, currentY);

  // Totals
  currentY = addTotals(doc, data, currentY);

  // Notes
  addNotes(doc, data.notes, currentY);

  // Save
  doc.save(`Quote_${data.quoteNumber}.pdf`);
}

export function exportInvoiceToPDF(data: InvoiceData) {
  const doc = new jsPDF();

  // Header
  addHeader(doc, "Invoice", data.invoiceNumber);

  // Date and status info
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Date: ${formatDate(data.date)}`, 200, 30, { align: "right" });
  if (data.dueDate) {
    doc.text(`Due Date: ${formatDate(data.dueDate)}`, 200, 37, { align: "right" });
  }
  
  // Status badge
  doc.setFont("helvetica", "bold");
  const statusText = data.status.toUpperCase();
  const statusColor = data.status === "paid" ? [34, 197, 94] : [239, 68, 68];
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(statusText, 200, 44, { align: "right" });
  doc.setTextColor(0, 0, 0);

  // Customer info
  let currentY = addCustomerInfo(doc, data.customer, 55);

  // Line item groups
  currentY = addLineItemGroups(doc, data.lineItemGroups, currentY);

  // Totals
  currentY = addTotals(doc, data, currentY);

  // Notes
  addNotes(doc, data.notes, currentY);

  // Save
  doc.save(`Invoice_${data.invoiceNumber}.pdf`);
}

