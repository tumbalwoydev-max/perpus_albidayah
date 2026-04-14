const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Book = require('../models/Book');
const Transaction = require('../models/Transaction');
const Setting = require('../models/Setting');
const { Op } = require('sequelize');

// Utility to calculate days difference
const daysDiff = (date1, date2) => {
    const timeDiff = new Date(date2).getTime() - new Date(date1).getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

// Middleware for authentication
const checkAuth = (req, res, next) => {
    if (!req.session.admin) return res.redirect('/login');
    next();
};

// GET: List transactions (Active & Returned can be separated or mixed, we use a status filter potentially)
router.get('/', checkAuth, async (req, res) => {
    try {
        const transactions = await Transaction.findAll({
            include: [Student, Book],
            order: [['createdAt', 'DESC']]
        });
        res.render('transactions/index', { title: 'Peminjaman & Pengembalian', transactions });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// GET: Scan page using HTML5-QRCode
router.get('/scan', checkAuth, (req, res) => {
    res.render('transactions/scan', { title: 'Scan QR Siswa' });
});

// GET: Create borrowing form (triggered after scan)
router.get('/create', checkAuth, async (req, res) => {
    try {
        const nisn = req.query.nisn;
        if (!nisn) return res.redirect('/transactions/scan');

        const student = await Student.findOne({ where: { nisn } });
        if (!student) {
            return res.render('transactions/scan', { title: 'Scan QR Siswa', error: 'NISN tidak terdaftar di sistem.' });
        }

        const availableBooks = await Book.findAll({
            where: {
                stock: { [Op.gt]: 0 }
            }
        });

        // Get default borrowing days from Settings
        let maxBorrowDays = 7;
        const settingMax = await Setting.findOne({ where: { key: 'max_borrow_days' } });
        if (settingMax) maxBorrowDays = parseInt(settingMax.value);

        const defaultBorrowDate = new Date().toISOString().split('T')[0];
        const dateObj = new Date();
        dateObj.setDate(dateObj.getDate() + maxBorrowDays);
        const defaultExpectedDate = dateObj.toISOString().split('T')[0];

        res.render('transactions/create', { 
            title: 'Proses Peminjaman', 
            student, 
            books: availableBooks,
            defaultBorrowDate,
            defaultExpectedDate
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST: Process borrowing
router.post('/create', checkAuth, async (req, res) => {
    try {
        let { student_id, book_id, borrow_date, expected_return_date } = req.body;
        
        // Handle multiple book IDs if provided (as array)
        const bookIds = Array.isArray(book_id) ? book_id : [book_id];
        
        if (bookIds.length === 0) {
            return res.status(400).send('Harap pilih minimal satu buku.');
        }

        const batchId = `BATCH-${Date.now()}`;
        const createdTransactions = [];

        for (const id of bookIds) {
            const book = await Book.findByPk(id);
            if (!book || book.stock <= 0) {
                continue; // Skip if unavailable or not found
            }

            const transaction = await Transaction.create({
                student_id,
                book_id: id,
                borrow_date,
                expected_return_date,
                batch_id: batchId
            });

            book.stock -= 1;
            await book.save();
            createdTransactions.push(transaction);
        }

        if (createdTransactions.length === 0) {
            return res.status(400).send('Gagal memproses peminjaman. Stok mungkin habis.');
        }

        // Redirect to receipt of the first transaction, 
        // which will now fetch its siblings via batch_id
        res.redirect(`/transactions/receipt/${createdTransactions[0].id}`);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// GET: Receipt Print View
router.get('/receipt/:id', checkAuth, async (req, res) => {
    try {
        const singleTransaction = await Transaction.findByPk(req.params.id);
        if (!singleTransaction) return res.redirect('/transactions');

        let transactions = [];
        if (singleTransaction.batch_id) {
            // Fetch all transactions in the same batch
            transactions = await Transaction.findAll({
                where: { batch_id: singleTransaction.batch_id },
                include: [Student, Book]
            });
        } else {
            // Fallback for old transactions without batch_id
            const fullTransaction = await Transaction.findByPk(req.params.id, {
                include: [Student, Book]
            });
            transactions = [fullTransaction];
        }

        res.render('transactions/receipt', { 
            title: 'Cetak Struk', 
            transactions,
            transaction: transactions[0], // For legacy compatibility in some parts of view
            layout: false
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});


// GET: Return Confirmation Page with Fine calc
router.get('/return/:id', checkAuth, async (req, res) => {
    try {
        const transaction = await Transaction.findByPk(req.params.id, {
            include: [Student, Book]
        });

        if (!transaction || transaction.return_date) return res.redirect('/transactions');

        const today = new Date().toISOString().split('T')[0];
        const daysLate = daysDiff(transaction.expected_return_date, today);
        
        let fine = 0;
        if (daysLate > 0) {
            const fineSetting = await Setting.findOne({ where: { key: 'fine_per_day' } });
            const finePerDay = fineSetting ? parseInt(fineSetting.value) : 1000;
            fine = daysLate * finePerDay;
        }

        res.render('transactions/return', {
            title: 'Pengembalian Buku',
            transaction,
            today,
            daysLate: daysLate > 0 ? daysLate : 0,
            fine
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// POST: Execute Return
router.post('/return/:id', checkAuth, async (req, res) => {
    try {
        const transaction = await Transaction.findByPk(req.params.id);
        if (!transaction || transaction.return_date) return res.redirect('/transactions');

        const { return_date, fine } = req.body;

        transaction.return_date = return_date;
        transaction.fine = parseInt(fine) || 0;
        await transaction.save();

        // Increase book stock back
        const book = await Book.findByPk(transaction.book_id);
        if (book) {
            book.stock += 1;
            await book.save();
        }

        res.redirect('/transactions');
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
