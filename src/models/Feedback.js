const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
    {
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order',
            required: true,
            unique: true, // Only 1 feedback allowed per order
        },
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Customer',
            required: true,
        },
        overallRating: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        foodQuality: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        timeliness: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        service: {
            type: Number,
            required: true,
            min: 1,
            max: 5,
        },
        comment: {
            type: String,
            trim: true,
        },
        tags: [
            {
                type: String,
                trim: true,
            },
        ],
        sentiment: {
            type: String,
            enum: ['Positive', 'Neutral', 'Negative'],
        },
    },
    { timestamps: true }
);

// Auto-calculate sentiment before saving based on overallRating
feedbackSchema.pre('save', function () {
    if (this.overallRating >= 4) {
        this.sentiment = 'Positive';
    } else if (this.overallRating === 3) {
        this.sentiment = 'Neutral';
    } else {
        this.sentiment = 'Negative';
    }
});

// Calculate average ratings for a specific customer or overall
feedbackSchema.statics.getAverageRatings = async function (matchStage = {}) {
    const defaultMatch = Object.keys(matchStage).length ? matchStage : undefined;
    
    const pipeline = [];
    if (defaultMatch) {
        pipeline.push({ $match: defaultMatch });
    }

    pipeline.push({
        $group: {
            _id: null,
            avgOverall:    { $avg: '$overallRating' },
            avgFood:       { $avg: '$foodQuality' },
            avgTimeliness: { $avg: '$timeliness' },
            avgService:    { $avg: '$service' },
            count:         { $sum: 1 },
        },
    });

    return this.aggregate(pipeline);
};

// ── Indexes ────────────────────────────────────────────────────────────────
feedbackSchema.index({ customerId: 1 });
feedbackSchema.index({ overallRating: 1 });
feedbackSchema.index({ sentiment: 1 });
feedbackSchema.index({ createdAt: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
