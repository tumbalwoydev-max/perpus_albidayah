const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '../public/uploads/students/');
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Middleware for authentication
const checkAuth = (req, res, next) => {
    if (!req.session.admin) return res.redirect('/login');
    next();
};

// GET: List all students
router.get('/', checkAuth, async (req, res) => {
    try {
        const students = await Student.findAll();
        res.render('students/index', { title: 'Master Data Siswa', students });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// GET: Create form
router.get('/create', checkAuth, (req, res) => {
    res.render('students/create', { title: 'Tambah Data Siswa', error: null });
});

// POST: Create student and generate QR code
router.post('/create', checkAuth, upload.single('photo'), async (req, res) => {
    try {
        console.log('Upload check - Photo file:', req.file);
        const { name, nisn, student_class } = req.body;
        
        // Check if NISN exists
        const exists = await Student.findOne({ where: { nisn } });
        if (exists) {
            if (req.file) fs.unlinkSync(req.file.path); // Delete uploaded file
            return res.render('students/create', { title: 'Tambah Data Siswa', error: 'NISN sudah terdaftar!' });
        }

        // Process image with sharp if exists
        let photoPath = null;
        if (req.file) {
            const originalPath = req.file.path;
            const compressedFilename = `compressed-${req.file.filename}`;
            const compressedPath = path.join(__dirname, '../public/uploads/students/', compressedFilename);
            
            await sharp(originalPath)
                .resize({ width: 500 })
                .jpeg({ quality: 70 })
                .toFile(compressedPath);
            
            // Delete original file
            fs.unlinkSync(originalPath);
            photoPath = `/uploads/students/${compressedFilename}`;
        }

        // Generate QR Code with only NISN text (to scale well with scanners)
        const qrFilename = `qr_${nisn}.png`;
        const qrPath = path.join(__dirname, '../public/images/qrcodes', qrFilename);
        
        await QRCode.toFile(qrPath, nisn, {
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        // Insert to DB
        await Student.create({
            name,
            nisn,
            class: student_class, // mapped because class is a JS keyword sometimes used differently but attribute is class
            qr_code_path: `/images/qrcodes/${qrFilename}`,
            photo_path: photoPath
        });

        res.redirect('/admin/students');
    } catch (err) {
        console.error(err);
        if (req.file) fs.unlinkSync(req.file.path);
        res.render('students/create', { title: 'Tambah Data Siswa', error: 'Gagal menyimpan data.' });
    }
});

// GET: Edit form
router.get('/edit/:id', checkAuth, async (req, res) => {
    try {
        const student = await Student.findByPk(req.params.id);
        if (!student) return res.redirect('/admin/students');
        res.render('students/edit', { title: 'Edit Data Siswa', student, error: null });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/students');
    }
});

// POST: Edit student
router.post('/edit/:id', checkAuth, upload.single('photo'), async (req, res) => {
    try {
        console.log('Upload check - Photo file:', req.file);
        const { name, nisn, student_class } = req.body;
        const studentId = req.params.id;

        const student = await Student.findByPk(studentId);
        if (!student) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.redirect('/admin/students');
        }

        // Process image with sharp if exists
        if (req.file) {
            // Delete old photo if exists
            if (student.photo_path) {
                const oldPhotoPath = path.join(__dirname, '../public', student.photo_path);
                if (fs.existsSync(oldPhotoPath)) fs.unlinkSync(oldPhotoPath);
            }

            const originalPath = req.file.path;
            const compressedFilename = `compressed-${req.file.filename}`;
            const compressedPath = path.join(__dirname, '../public/uploads/students/', compressedFilename);
            
            await sharp(originalPath)
                .resize({ width: 500 })
                .jpeg({ quality: 70 })
                .toFile(compressedPath);
            
            // Delete original file
            fs.unlinkSync(originalPath);
            student.photo_path = `/uploads/students/${compressedFilename}`;
        }

        // Check if changing NISN to one that already exists
        if (student.nisn !== nisn) {
            const exists = await Student.findOne({ where: { nisn } });
            if (exists) {
                return res.render('students/edit', { title: 'Edit Data Siswa', student, error: 'NISN sudah digunakan siswa lain!' });
            }
            
            // Generate new QR if NISN changes
            const oldQrPath = path.join(__dirname, '../public', student.qr_code_path);
            if (fs.existsSync(oldQrPath)) fs.unlinkSync(oldQrPath); // remove old

            const newQrFilename = `qr_${nisn}.png`;
            const newQrPath = path.join(__dirname, '../public/images/qrcodes', newQrFilename);
            await QRCode.toFile(newQrPath, nisn);
            
            student.qr_code_path = `/images/qrcodes/${newQrFilename}`;
            student.nisn = nisn;
        }

        student.name = name;
        student.class = student_class;
        await student.save();

        res.redirect('/admin/students');
    } catch (err) {
        console.error(err);
        if (req.file) fs.unlinkSync(req.file.path);
        res.redirect('/admin/students');
    }
});

// POST: Delete student
router.post('/delete/:id', checkAuth, async (req, res) => {
    try {
        const student = await Student.findByPk(req.params.id);
        if (student) {
            // Delete QR Image
            const qrPath = path.join(__dirname, '../public', student.qr_code_path);
            if (fs.existsSync(qrPath)) fs.unlinkSync(qrPath);

            // Delete Photo
            if (student.photo_path) {
                const photoPath = path.join(__dirname, '../public', student.photo_path);
                if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
            }

            await student.destroy();
        }
        res.redirect('/admin/students');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/students');
    }
});

module.exports = router;
