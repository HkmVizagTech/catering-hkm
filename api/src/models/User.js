const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            maxlength: [100, 'Name cannot exceed 100 characters'],
        },
        email: {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
        },
        password: {
            type: String,
            required: [true, 'Password is required'],
            minlength: [5, 'Password must be at least 5 characters'],
            select: false, // Never return password in queries by default
        },
        role: {
            type: String,
            enum: ['admin', 'staff', 'viewer'],
            default: 'staff',
        },
        phone: {
            type: String,
            trim: true,
            required: false,
            validate: {
                validator: function(v) {
                    // Only validate if phone has a length after cleaning
                    if (!v) return true;
                    const clean = String(v).replace(/[\s\-\(\)\+]/g, '');
                    return clean.length >= 10 && clean.length <= 15 && /^[0-9]+$/.test(clean);
                },
                message: 'Please enter a valid phone number (10-15 digits)'
            }
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        resetPasswordToken: {
            type: String,
            select: false,
        },
        resetPasswordExpire: {
            type: Date,
            select: false,
        },
    },
    { timestamps: true }
);

// Hash password before saving (Mongoose v9: async hooks return a promise, no next())
UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

// Instance method: compare entered password with hashed password
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
