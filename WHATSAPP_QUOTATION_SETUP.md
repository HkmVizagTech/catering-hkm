# WhatsApp Quotation Setup & Flow

This document outlines the workflow and setup for the Automated WhatsApp Quotation features for Satvata Foods.

## Overview
When a quotation is created, the system automatically:
1. Generates the Quotation PDF.
2. Sends a WhatsApp template (`quotation_inquiry`) to the customer.
3. Sends the Quotation PDF as a WhatsApp document attachment.
4. Marks the Quote as "Sent" and records delivery details.

## Step-by-Step Flow

### 1. Create Quote
- In the **Quotations** page, an admin clicks **New Quotation**.
- The admin fills in the customer details, event details, and line items.
- Upon clicking **Save**, the `POST /api/quotes` endpoint is called.

### 2. Generate PDF
- The `quoteController` dynamically triggers a PDF generation representing the order. 
- It uses the URL path `/api/quotes/download/{quoteId}` as a public endpoint that generates the PDF on the fly using `puppeteer`.

### 3. Send Template
- Immediately after creation or when manually triggered, the system calls `WapiService` to send a template message.
- Template name: `quotation_inquiry` (or `enquiry_quotation` if it's a marriage event).
- Variables populated:
  - `{{1}}`: Customer Name
  - `{{2}}`: Service Type / Event Name
  - `{{3}}`: Quote Number
  - `{{4}}`: Total Amount

### 4. Send PDF
- After sending the text template, `wapiService.sendQuotationPDF()` is triggered.
- It uses the `quotation_pdf` template which accepts a header parameter (the document link) and body parameters mapping exactly to the ones mentioned above.
- The WAPI Cloud server retrieves the PDF file from the `/download` public URL and sends it as an attachment to the user.

### 5. Verify Customer Receipt
- In the **Quote Details Page**, the admin can view the **WhatsApp Delivery** panel to see if Template Sent and PDF Sent are ✅ Yes.
- Ensure the user actually received a text quoting their details, immediately followed by the formatted PDF attachment.
- Logs are silently written via `WhatsappLog` for potential diagnostic inspection if the delivery fails.

## Troubleshooting 

- If **"Template Sent"** is failing: Make sure `WAPI_TOKEN` is set, and the target phone number is a valid 10-digit number.
- If **"PDF Sent"** is failing: Make sure your `API_URL` environment variable is fully accessible from the internet so the WhatsApp API can download the generated document.
