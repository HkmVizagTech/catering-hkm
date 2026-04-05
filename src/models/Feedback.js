const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true
  },
  customerId: {
    type: String,
  },
  customerName: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  comment: {
    type: String
  },
  tags: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['New', 'Reviewed'],
    default: 'New'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
