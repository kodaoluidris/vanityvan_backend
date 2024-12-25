const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../config/database');
const sharp = require('sharp');
const { User } = require('../models');
const { v2: cloudinary } = require('cloudinary');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = `uploads/${req.userData.userId}`;
        fs.mkdir(dir, { recursive: true })
            .then(() => cb(null, dir))
            .catch(err => cb(err));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type'));
    }
});

exports.uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { type, description } = req.body;
        const filePath = req.file.path;

        // Save document reference to database
        const [result] = await db.execute(
            `INSERT INTO documents (
                user_id,
                type,
                description,
                file_path
            ) VALUES (?, ?, ?, ?)`,
            [req.userData.userId, type, description, filePath]
        );

        res.status(201).json({
            message: 'Document uploaded successfully',
            documentId: result.insertId,
            filePath
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

exports.uploadMiddleware = upload.single('file');

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'drzm0odun',
    api_key: process.env.CLOUDINARY_API_KEY || '437571938276392',
    api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.uploadProfilePhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                message: 'No file uploaded'
            });
        }

        // Process the image with sharp
        const processedFileName = `processed-${req.file.filename}`;
        const processedFilePath = path.join('uploads/profile-photos', processedFileName);

        await sharp(req.file.path)
            .resize(300, 300, {
                fit: 'cover',
                position: 'center'
            })
            .jpeg({ quality: 90 })
            .toFile(processedFilePath);

        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(processedFilePath, {
            folder: 'profile-photos',
            resource_type: 'image',
            transformation: [
                { width: 300, height: 300, crop: 'fill' },
                { fetch_format: 'auto', quality: 'auto' }
            ]
        });

        // Delete the local files after successful upload
        await fs.unlink(req.file.path);
        await fs.unlink(processedFilePath);

        // Update user's photo in database with Cloudinary URL
        await User.update(
            { photo: uploadResult.secure_url },
            { 
                where: { id: req.userData.userId },
                individualHooks: false
            }
        );

        res.json({
            status: 'success',
            data: {
                photoUrl: uploadResult.secure_url
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        // Try to clean up any files if they exist
        try {
            if (req.file?.path) await fs.unlink(req.file.path);
            if (processedFilePath) await fs.unlink(processedFilePath);
        } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
        }

        res.status(500).json({
            status: 'error',
            message: 'Error uploading photo',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};