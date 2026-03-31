const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, '../public/uploads/books/');
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

// GET: List all books
router.get('/', checkAuth, async (req, res) => {
    try {
        const books = await Book.findAll();
        res.render('books/index', { title: 'Master Data Buku', books });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// GET: Create form
router.get('/create', checkAuth, (req, res) => {
    res.render('books/create', { title: 'Tambah Data Buku' });
});

// POST: Create Book
router.post('/create', checkAuth, upload.single('cover'), async (req, res) => {
    try {
        console.log('Upload check - Cover file:', req.file);
        const { title, author, stock } = req.body;
        
        // Process image with sharp if exists
        let coverPath = null;
        if (req.file) {
            const originalPath = req.file.path;
            const compressedFilename = `compressed-${req.file.filename}`;
            const compressedPath = path.join(__dirname, '../public/uploads/books/', compressedFilename);
            
            await sharp(originalPath)
                .resize({ width: 500 })
                .jpeg({ quality: 70 })
                .toFile(compressedPath);
            
            // Delete original file
            fs.unlinkSync(originalPath);
            coverPath = `/uploads/books/${compressedFilename}`;
        }

        await Book.create({ 
            title, 
            author, 
            stock,
            cover_path: coverPath
        });
        res.redirect('/admin/books');
    } catch (err) {
        console.error(err);
        if (req.file) fs.unlinkSync(req.file.path);
        res.render('books/create', { title: 'Tambah Data Buku', error: 'Gagal menyimpan data buku.' });
    }
});

// GET: Edit form
router.get('/edit/:id', checkAuth, async (req, res) => {
    try {
        const book = await Book.findByPk(req.params.id);
        if (!book) return res.redirect('/admin/books');
        res.render('books/edit', { title: 'Edit Data Buku', book });
    } catch (err) {
        console.error(err);
        res.redirect('/admin/books');
    }
});

// POST: Edit Book
router.post('/edit/:id', checkAuth, upload.single('cover'), async (req, res) => {
    try {
        console.log('Upload check - Cover file:', req.file);
        const { title, author, stock } = req.body;
        const bookId = req.params.id;

        const book = await Book.findByPk(bookId);
        if (!book) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.redirect('/admin/books');
        }

        // Process image with sharp if exists
        if (req.file) {
            // Delete old cover if exists
            if (book.cover_path) {
                const oldCoverPath = path.join(__dirname, '../public', book.cover_path);
                if (fs.existsSync(oldCoverPath)) fs.unlinkSync(oldCoverPath);
            }

            const originalPath = req.file.path;
            const compressedFilename = `compressed-${req.file.filename}`;
            const compressedPath = path.join(__dirname, '../public/uploads/books/', compressedFilename);
            
            await sharp(originalPath)
                .resize({ width: 500 })
                .jpeg({ quality: 70 })
                .toFile(compressedPath);
            
            // Delete original file
            fs.unlinkSync(originalPath);
            book.cover_path = `/uploads/books/${compressedFilename}`;
        }

        book.title = title;
        book.author = author;
        book.stock = stock;
        await book.save();

        res.redirect('/admin/books');
    } catch (err) {
        console.error(err);
        if (req.file) fs.unlinkSync(req.file.path);
        res.redirect('/admin/books');
    }
});

// POST: Delete Book
router.post('/delete/:id', checkAuth, async (req, res) => {
    try {
        const book = await Book.findByPk(req.params.id);
        if (book) {
            // Delete Cover Photo
            if (book.cover_path) {
                const coverPath = path.join(__dirname, '../public', book.cover_path);
                if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
            }
            await book.destroy();
        }
        res.redirect('/admin/books');
    } catch (err) {
        console.error(err);
        res.redirect('/admin/books');
    }
});

module.exports = router;
