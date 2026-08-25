const express = require('express');
const router = express.Router();
const { getVideoInfo, streamMedia } = require('../controllers/downloadLogic');

// POST রিকোয়েস্ট: ভিডিওর ইনফরমেশন আনার জন্য
router.post('/info', getVideoInfo);

// GET রিকোয়েস্ট: ফাইল ডাউনলোডের জন্য (যেহেতু ব্রাউজার সরাসরি ডাউনলোড করবে)
router.get('/download', streamMedia);

module.exports = router;