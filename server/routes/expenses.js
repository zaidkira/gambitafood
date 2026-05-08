const express = require('express');
const router = express.Router();
const Expense = require('../models/Expense');
const { syncExpenseToSheet } = require('../config/sheets');

router.get('/', async (req, res) => {
    try {
        const expenses = await Expense.find({ branchId: req.query.branchId }).sort({ timestamp: -1 });
        res.json(expenses);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', async (req, res) => {
    const expense = new Expense({ ...req.body, branchId: req.query.branchId });
    try {
        const newExpense = await expense.save();
        syncExpenseToSheet(newExpense).catch(err => console.error('Expense sheet sync failed:', err)); // Background sync
        res.status(201).json(newExpense);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
