/**
 * generateNumber.js
 * Generates sequential, human-readable document numbers.
 * e.g. ORD-2026-001, QT-2026-042, INV-2026-007
 */

/**
 * @param {string} prefix     - e.g. 'ORD', 'QT', 'INV'
 * @param {Model}  Model      - Mongoose model to query for last document
 * @param {string} field      - Field name storing the number (default: matches prefix pattern)
 * @returns {Promise<string>} - e.g. 'ORD-2026-001'
 */
const generateNumber = async (prefix, Model, field = null) => {
    const year = new Date().getFullYear();
    const numberField = field || getFieldName(prefix);

    // Find the latest document for the current year with the same prefix
    const latest = await Model.findOne({
        [numberField]: new RegExp(`^${prefix}-${year}-`),
    })
        .sort({ [numberField]: -1 })
        .select(numberField)
        .lean();

    let nextNum = 1;

    if (latest && latest[numberField]) {
        // Extract the numeric part after the last dash: "ORD-2026-042" → 42
        const parts = latest[numberField].split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
            nextNum = lastNum + 1;
        }
    }

    // Zero-pad to 3 digits: 1 → "001", 42 → "042"
    const padded = String(nextNum).padStart(3, '0');
    return `${prefix}-${year}-${padded}`;
};

/**
 * Maps prefix to the model's field name
 */
const getFieldName = (prefix) => {
    const map = {
        ORD: 'orderNumber',
        QT: 'quoteNumber',
        INV: 'invoiceNumber',
        TXN: 'transactionId',
        EXP: 'expenseNumber',
    };
    return map[prefix] || 'number';
};

module.exports = generateNumber;
