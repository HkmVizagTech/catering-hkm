const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Use /tmp for uploads on Vercel (read-only fs)
const uploadDir = process.env.VERCEL ? '/tmp/uploads/menu' : path.join(__dirname, '../../uploads/menu');

if (!fs.existsSync(uploadDir)) {
    try {
        fs.mkdirSync(uploadDir, { recursive: true });
    } catch (err) {
        console.warn(`Could not create upload directory: ${uploadDir}. Uploads may fail.`);
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        cb(null, uniqueSuffix + '-' + safeName);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

module.exports = { upload };
