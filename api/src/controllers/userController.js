const User = require('../models/User');
const { createError } = require('../middleware/errorHandler');

/**
 * @desc    Get all users
 * @route   GET /api/users
 * @access  Private/Admin
 */
const getUsers = async (req, res, next) => {
    try {
        const users = await User.find({});
        res.status(200).json({ success: true, count: users.length, data: users });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Create a user
 * @route   POST /api/users
 * @access  Private/Admin
 */
const createUser = async (req, res, next) => {
    const { name, email, password, role, phone } = req.body;
    try {
        const existing = await User.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        
        const user = await User.create({
            name,
            email: email.toLowerCase(),
            password,
            role: role || 'staff',
            phone,
            isActive: true
        });

        res.status(201).json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        next(err);
    }
};

module.exports = { getUsers, createUser, deleteUser };
