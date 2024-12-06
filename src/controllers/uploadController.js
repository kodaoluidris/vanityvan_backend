const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../config/database');
const sharp = require('sharp');
const { User } = require('../models');

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

        // Delete the original file
        await fs.unlink(req.file.path);

        // Get host from request object
        const host = `${req.protocol}://${req.get('host')}`;
        console.log(host, "host")
        const photoUrl = `${host}/api/uploads/profile-photos/${processedFileName}`;

        // Update user's photo in database
        await User.update(
            { photo: photoUrl },
            { 
                where: { id: req.userData.userId },
                individualHooks: false
            }
        );

        res.json({
            status: 'success',
            data: {
                photoUrl: photoUrl
            }
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error uploading photo'
        });
    }
};