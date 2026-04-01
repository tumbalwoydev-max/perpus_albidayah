const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

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
        const { title, author, stock } = req.body;
        
        let coverBase64 = null;
        if (req.file) {
            // Process image with sharp from buffer
            const buffer = await sharp(req.file.buffer)
                .resize({ width: 500 })
                .jpeg({ quality: 70 })
                .toBuffer();
            
            coverBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        }

        await Book.create({ 
            title, 
            author, 
            stock,
            cover_path: coverBase64
        });
        res.redirect('/admin/books');
    } catch (err) {
        console.error('Book Create Error:', err);
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
        const { title, author, stock } = req.body;
        const bookId = req.params.id;

        const book = await Book.findByPk(bookId);
        if (!book) return res.redirect('/admin/books');

        if (req.file) {
            // Process buffer with sharp
            const buffer = await sharp(req.file.buffer)
                .resize({ width: 500 })
                .jpeg({ quality: 70 })
                .toBuffer();
            
            book.cover_path = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        }

        book.title = title;
        book.author = author;
        book.stock = stock;
        await book.save();

        res.redirect('/admin/books');
    } catch (err) {
        console.error('Book Edit Error:', err);
        res.redirect('/admin/books');
    }
});

// POST: Delete Book
router.post('/delete/:id', checkAuth, async (req, res) => {
    try {
        const book = await Book.findByPk(req.params.id);
        if (book) {
            await book.destroy();
        }
        res.redirect('/admin/books');
    } catch (err) {
        console.error('Book Delete Error:', err);
        res.redirect('/admin/books');
    }
});

module.exports = router;
