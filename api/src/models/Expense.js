const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
    expenseNumber: {
        type: String,
        required: true,
        unique: true
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    vendor: {
        type: String,
        required: [true, 'Vendor is required']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['Raw Materials', 'Groceries', 'Logistics', 'Utilities', 'Packaging', 'Staff Salary', 'Rent', 'Maintenance', 'Others']
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required'],
        min: [0, 'Amount cannot be negative']
    },
    status: {
        type: String,
        enum: ['Paid', 'Pending'],
        default: 'Pending'
    },
    reference: {
        type: String,
        default: ''
    },
    notes: {
        type: String,
        default: ''
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Expense', expenseSchema);
