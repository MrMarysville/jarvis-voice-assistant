#!/usr/bin/env tsx

/**
 * Migration Script: Recalculate All Quote and Invoice Totals
 * 
 * This script recalculates the totalAmount for all quotes and invoices
 * based on their line items and imprints.
 * 
 * Run with: npx tsx scripts/migrate-recalculate-totals.ts
 */

import * as db from "../server/db";

async function main() {
  console.log("🔄 Starting total recalculation migration...\n");

  try {
    // Recalculate all quotes
    console.log("📋 Recalculating quote totals...");
    const quotes = await db.getAllQuotes();
    console.log(`   Found ${quotes.length} quotes`);

    let quotesUpdated = 0;
    for (const quote of quotes) {
      try {
        const oldTotal = parseFloat(quote.totalAmount || "0");
        await db.recalculateQuoteTotal(quote.id);
        
        // Get the updated quote to show the new total
        const updatedQuote = await db.getQuote(quote.id);
        const newTotal = parseFloat(updatedQuote?.totalAmount || "0");
        
        if (oldTotal !== newTotal) {
          console.log(`   ✓ Quote #${quote.quoteNumber}: $${oldTotal.toFixed(2)} → $${newTotal.toFixed(2)}`);
          quotesUpdated++;
        }
      } catch (error) {
        console.error(`   ✗ Error recalculating quote ${quote.id}:`, error);
      }
    }
    console.log(`   Updated ${quotesUpdated} quotes\n`);

    // Recalculate all invoices
    console.log("💰 Recalculating invoice totals...");
    const invoices = await db.getAllInvoices();
    console.log(`   Found ${invoices.length} invoices`);

    let invoicesUpdated = 0;
    for (const invoice of invoices) {
      try {
        const oldTotal = parseFloat(invoice.totalAmount || "0");
        await db.recalculateInvoiceTotal(invoice.id);
        
        // Get the updated invoice to show the new total
        const updatedInvoice = await db.getInvoice(invoice.id);
        const newTotal = parseFloat(updatedInvoice?.totalAmount || "0");
        
        if (oldTotal !== newTotal) {
          console.log(`   ✓ Invoice #${invoice.invoiceNumber}: $${oldTotal.toFixed(2)} → $${newTotal.toFixed(2)}`);
          invoicesUpdated++;
        }
      } catch (error) {
        console.error(`   ✗ Error recalculating invoice ${invoice.id}:`, error);
      }
    }
    console.log(`   Updated ${invoicesUpdated} invoices\n`);

    console.log("✅ Migration complete!");
    console.log(`   Quotes updated: ${quotesUpdated}/${quotes.length}`);
    console.log(`   Invoices updated: ${invoicesUpdated}/${invoices.length}`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

