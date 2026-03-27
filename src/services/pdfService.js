/**
 * pdfService.js
 * Generates Invoice PDFs using pdfkit and returns a Buffer.
 * The buffer can be piped directly to the HTTP response.
 */

const PDFDocument = require('pdfkit');

/**
 * Generate an invoice PDF buffer
 * @param {Object} invoice  - Populated invoice document
 * @param {Object} order    - Populated order document
 * @param {Object} customer - Customer document
 * @returns {Promise<Buffer>} PDF binary buffer
 */
const generateInvoicePDF = (invoice, customer) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50, size: 'A4' });
            const buffers = [];

            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            // ── Header ───────────────────────────────────────────────────
            doc.fontSize(22).font('Helvetica-Bold').text('INVOICE', 50, 50);
            doc.fontSize(10).font('Helvetica')
                .text(`Invoice #: ${invoice.invoiceNumber}`, 50, 80)
                .text(`Date: ${new Date(invoice.date).toLocaleDateString('en-IN')}`, 50, 95)
                .text(`Due Date: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : 'N/A'}`, 50, 110)
                .text(`Status: ${invoice.status}`, 50, 125);

            // ── Company Info (right side) ─────────────────────────────────
            doc.font('Helvetica-Bold').text('HKM Catering Services', 350, 50, { align: 'right' })
                .font('Helvetica')
                .text('Hyderabad, Telangana', 350, 65, { align: 'right' })
                .text('GSTIN: XXXXXXXXXXXXXXXXX', 350, 80, { align: 'right' })
                .text('Phone: +91 9876543210', 350, 95, { align: 'right' });

            // ── Divider ───────────────────────────────────────────────────
            doc.moveTo(50, 145).lineTo(545, 145).stroke();

            // ── Bill To ───────────────────────────────────────────────────
            doc.fontSize(11).font('Helvetica-Bold').text('Bill To:', 50, 160);
            doc.fontSize(10).font('Helvetica')
                .text(customer.name || '', 50, 175)
                .text(customer.company || '', 50, 190)
                .text(customer.phone || '', 50, 205)
                .text(customer.email || '', 50, 220)
                .text(customer.gstin ? `GSTIN: ${customer.gstin}` : '', 50, 235);

            // ── Order Ref ─────────────────────────────────────────────────
            doc.font('Helvetica-Bold').text('Order Ref:', 350, 160, { align: 'right' })
                .font('Helvetica').text(invoice.orderId?.orderNumber || 'N/A', 350, 175, { align: 'right' });

            // ── Line Items Table ──────────────────────────────────────────
            const tableTop = 270;
            doc.moveTo(50, tableTop - 5).lineTo(545, tableTop - 5).stroke();

            // Table headers
            doc.font('Helvetica-Bold').fontSize(10)
                .text('Item',       50,  tableTop)
                .text('Qty',        330, tableTop)
                .text('Unit Price', 380, tableTop)
                .text('Total',      470, tableTop);

            doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();

            // Table rows
            let y = tableTop + 25;
            (invoice.lineItems || []).forEach((item) => {
                doc.font('Helvetica').fontSize(9)
                    .text(item.name,                                        50,  y, { width: 270 })
                    .text(item.qty.toString(),                              330, y)
                    .text(`₹${item.unitPrice.toLocaleString('en-IN')}`,    380, y)
                    .text(`₹${item.total.toLocaleString('en-IN')}`,        470, y);
                y += 20;
                if (y > 680) { doc.addPage(); y = 50; }
            });

            doc.moveTo(50, y + 5).lineTo(545, y + 5).stroke();

            // ── Totals Section ────────────────────────────────────────────
            y += 20;
            const col1 = 380, col2 = 545;

            doc.font('Helvetica').fontSize(10)
                .text('Sub Total:',      col1, y, { width: 100, align: 'right' })
                .text(`₹${invoice.subTotal.toLocaleString('en-IN')}`,   col1, y, { width: 160, align: 'right' });
            y += 18;

            doc.text(`GST (${invoice.taxRate}%):`, col1, y, { width: 100, align: 'right' })
                .text(`₹${invoice.taxAmount.toLocaleString('en-IN')}`,  col1, y, { width: 160, align: 'right' });
            y += 18;

            if (invoice.discountAmount > 0) {
                doc.text('Discount:',   col1, y, { width: 100, align: 'right' })
                    .text(`-₹${invoice.discountAmount.toLocaleString('en-IN')}`, col1, y, { width: 160, align: 'right' });
                y += 18;
            }

            doc.moveTo(380, y).lineTo(545, y).stroke();
            y += 8;

            doc.font('Helvetica-Bold').fontSize(11)
                .text('Total Amount:', col1, y, { width: 100, align: 'right' })
                .text(`₹${invoice.totalAmount.toLocaleString('en-IN')}`, col1, y, { width: 160, align: 'right' });
            y += 20;

            doc.font('Helvetica').fontSize(10)
                .text('Amount Paid:', col1, y, { width: 100, align: 'right' })
                .text(`₹${invoice.amountPaid.toLocaleString('en-IN')}`, col1, y, { width: 160, align: 'right' });
            y += 18;

            doc.font('Helvetica-Bold').fillColor('red')
                .text('Balance Due:', col1, y, { width: 100, align: 'right' })
                .text(`₹${invoice.balance.toLocaleString('en-IN')}`, col1, y, { width: 160, align: 'right' });
            doc.fillColor('black');

            // ── Notes ─────────────────────────────────────────────────────
            if (invoice.notes) {
                y += 40;
                doc.font('Helvetica-Bold').fontSize(10).text('Notes:', 50, y);
                doc.font('Helvetica').fontSize(9).text(invoice.notes, 50, y + 15, { width: 495 });
            }

            // ── Footer ────────────────────────────────────────────────────
            doc.fontSize(8).fillColor('gray')
                .text('Thank you for your business!', 50, 760, { align: 'center', width: 495 });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
};

module.exports = { generateInvoicePDF };
