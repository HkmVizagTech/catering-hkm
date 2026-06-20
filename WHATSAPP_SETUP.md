# WhatsApp Automation Setup Guide

This guide explains how to set up and configure the **FlaxxaWapi** WhatsApp automation service for the Catering Ops Hub.

## 1. Environment Setup

To begin, you need to configure your backend environment variables to connect to the FlaxxaWapi API.
Edit the `.env` file located in `api/.env` and ensure the following variables are present:

```env
# FlaxxaWapi Settings
WAPI_TOKEN=your_flaxxa_wapi_token_here
WAPI_BASE_URL=https://wapi.flaxxa.com/api/v1
WAPI_LANGUAGE=en_US
```

- **WAPI_TOKEN**: You will get this from your FlaxxaWapi dashboard.
- **WAPI_BASE_URL**: Usually `https://wapi.flaxxa.com/api/v1`.
- **WAPI_LANGUAGE**: Keep it as `en_US` so it matches the expected language for your approved templates.

## 2. Frontend Application Setup

You can also update or override the Token directly from the frontend React Application.

1. Navigate to the **Settings** page in your admin dashboard.
2. Under the **Integrations** section, locate the "FlaxxaWapi Automation" card.
3. Click **Configure**.
4. Inside the modal, enter your **WAPI Token**.
5. Provide the **Connected Number** and set the **Template Status** to "Approved".
6. Click **Save Configuration**.

*Note: Once this configuration is saved, the token specified in the frontend will take precedence over the token in your `.env` file.*

## 3. Approved Templates

Ensure that you have exactly these templates approved in your Meta / WhatsApp manager dashboard and correctly mapped in the FlaxxaWapi platform:

*   **order_confirmation**: Uses 6 variables (`customerName`, `orderId`, `eventDate`, `venue`, `guests`, `totalAmount`)
*   **payment_request**: Uses 4 variables (`customerName`, `orderId`, `amount`, `paymentURL`)
*   **payment_success**: Uses 4 variables (`customerName`, `orderId`, `amount`, `paymentDate`)
*   **order_dispatched**: Uses 5 variables (`customerName`, `orderId`, `items`, `deliveryTime`, `address`)
*   **order_delivered**: Uses 2 variables (`customerName`, `orderId`)
*   **quotation_inquiry**: Uses 4 variables (`customerName`, `serviceType`, `quoteNo`, `amount`)
*   **enquiry_quotation**: Uses 3 variables (`customerName`, `quoteNo`, `amount`)
*   **quotation_pdf** ⭐: Document template for sending PDF quotations. Requires:
    - **Header**: Document type (1 variable — the PDF file URL is injected automatically)
    - **Body**: 4 variables — `{{1}}` customerName, `{{2}}` eventName, `{{3}}` quoteNo, `{{4}}` amount

    Example body text:
    ```
    Hare Krishna *{{1}}* 🙏

    As requested, please find attached the quotation for *{{2}}*.

    Quote No: *{{3}}*
    Amount: *₹{{4}}/-*

    This is in reference to your recent request.
    ```
    Footer (optional): `Satvata Foods`

The variables must be passed as `body` components in string format, in exactly the expected order. The backend controllers seamlessly map application variables into this sequence.

## 4. Testing WhatsApp Triggers

**Manual Action testing:**
1. **Quotes Page**: Click the WhatsApp message icon next to any active quotation and click "Convert". Select "Send Quote via WhatsApp".
2. **Orders Page**: Click the dropdown WhatsApp menu next to a specific order to send Confirmation, Dispatch, or Payment Links.
3. **Payments Page**: Click the WhatsApp icon inside the transaction ledger to resend a payment link to a customer.

**Automated Action testing:**
1. Generate an invoice from an order, or click **"Pay Pending Balance Online"**.
2. When Razorpay confirms the transaction via the webhook, the application will automatically send the `payment_success` template to the customer's mobile number.
3. Keep an eye on system logs (Terminal) to see `[WAPI Service] Success` output.

## 5. Troubleshooting guide

**1. "WAPI_TOKEN is not configured" error**
Make sure the token exists in `api/.env` as `WAPI_TOKEN=xxx`. If you're using the frontend UI configurations, verify in MongoDB that the `Settings` collection has `flaxxaWapi: { enabled: true, token: "xxx" }`.

**2. "Invalid phone number provided"**
The `wapiService.js` automatically strips non-numeric characters and defaults Indian (10 digit) numbers to have a `91` prefix. Ensure your customer phone records are valid 10-12 digit strings.

**3. "Validation failed... type is required"**
If `WhatsappLog` creation fails in your backend logs, this has already been hotfixed by renaming `templateName` back to `type` and ensuring `status: 'success'` matches your Enum bounds. Check `WhatsappLog.js` in your model folder if further properties restrict schema.

**4. 403 Forbidden or "OAuthException" from FlaxxaWapi**
Your token may have expired or is disconnected. Double-check it inside the Flaxxa dashboard and update your token in `.env`/UI settings.

**5. Variables aren't mapping**
Make sure the template you're requesting has the exact number of indexed variables. For example, `order_delivered` only accepts exactly 2 placeholders. Overloading it causes the Meta API to reject the template request.
