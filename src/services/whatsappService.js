const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const Settings = require('../models/Settings');

const sendReceiptWhatsapp = async (phone, filePath, donorName, amount, paymentType = "normal") => {
    try {
        const form = new FormData();

        form.append("token", process.env.FLAXXA_TOKEN);
        form.append("phone", phone);

        let templateName = "annadana_acknowledgement_receipt";
        if (paymentType === "subscription") {
            templateName = "andseva_monthly_success_reciept";
        }
        form.append("template_name", templateName);
        form.append("template_language", "en");

        form.append(
            "components",
            JSON.stringify([
                {
                    type: "body",
                    parameters: [
                        {
                            type: "text",
                            text: donorName
                        },
                        {
                            type: "text",
                            text: String(amount)
                        }
                    ]
                }
            ])
        );

        if (fs.existsSync(filePath)) {
            form.append(
                "header_attachment",
                fs.createReadStream(filePath),
                {
                    filename: "Donation_Acknowledgment_Receipt.pdf",
                    contentType: "application/pdf"
                }
            );
        } else {
            console.warn(`⚠️ PDF file not found at ${filePath}. Sending message without attachment.`);
        }

        const response = await axios.post(
            "https://wapi.flaxxa.com/api/v1/sendtemplatemessage_withattachment",
            form,
            {
                headers: form.getHeaders()
            }
        );

        console.log(`💬 WhatsApp Receipt sent successfully to ${phone}`);
        return response.data;
    } catch (error) {
        console.error('❌ Error sending WhatsApp receipt via Flaxxa:', error?.response?.data || error.message);
        return { status: 'failed', success: false, error: error.message };
    }
};

module.exports = {
    sendReceiptWhatsapp,
};
