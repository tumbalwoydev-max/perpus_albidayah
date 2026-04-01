const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');

// Multer storage configuration
// Multer storage configuration - Memory based for Vercel support
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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
        const { name, nisn, student_class } = req.body;
        
        // Check if NISN exists
        const exists = await Student.findOne({ where: { nisn } });
        if (exists) {
            return res.render('students/create', { title: 'Tambah Data Siswa', error: 'NISN sudah terdaftar!' });
        }

        // Process image with sharp if exists
        let photoBase64 = null;
        if (req.file) {
            const buffer = await sharp(req.file.buffer)
                .resize({ width: 500 })
                .jpeg({ quality: 70 })
                .toBuffer();
            
            photoBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        }

        // Generate QR Code as Data URL (Base64)
        const qrBase64 = await QRCode.toDataURL(nisn, {
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        // Insert to DB
        await Student.create({
            name,
            nisn,
            class: student_class,
            qr_code_path: qrBase64,
            photo_path: photoBase64
        });

        res.redirect('/admin/students');
    } catch (err) {
        console.error('Student Create Error:', err);
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
        const { name, nisn, student_class } = req.body;
        const studentId = req.params.id;

        const student = await Student.findByPk(studentId);
        if (!student) return res.redirect('/admin/students');

        // Process image with sharp if exists
        if (req.file) {
            const buffer = await sharp(req.file.buffer)
                .resize({ width: 500 })
                .jpeg({ quality: 70 })
                .toBuffer();
            
            student.photo_path = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        }

        // Check if changing NISN to one that already exists
        if (student.nisn !== nisn) {
            const exists = await Student.findOne({ where: { nisn } });
            if (exists) {
                return res.render('students/edit', { title: 'Edit Data Siswa', student, error: 'NISN sudah digunakan siswa lain!' });
            }
            
            // Generate new QR as Data URL if NISN changes
            student.qr_code_path = await QRCode.toDataURL(nisn);
            student.nisn = nisn;
        }

        student.name = name;
        student.class = student_class;
        await student.save();

        res.redirect('/admin/students');
    } catch (err) {
        console.error('Student Edit Error:', err);
        res.redirect('/admin/students');
    }
});

// POST: Delete student
router.post('/delete/:id', checkAuth, async (req, res) => {
    try {
        const student = await Student.findByPk(req.params.id);
        if (student) {
            await student.destroy();
        }
        res.redirect('/admin/students');
    } catch (err) {
        console.error('Student Delete Error:', err);
        res.redirect('/admin/students');
    }
});

module.exports = router;
