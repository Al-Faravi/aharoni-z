const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve Static Files (Frontend PWA)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// ইমপোর্টে progressStream যুক্ত করুন
const { getVideoInfo, streamMedia, progressStream } = require('./controllers/downloadLogic');

// আপনার রাউটগুলোর সাথে এটি যুক্ত করে দিন:
app.get('/api/progress', progressStream);

// Basic API Route Test
app.get('/api/test', (req, res) => {
    res.json({ message: "আহরণী Z ব্যাকএন্ড সফলভাবে রান করছে!" });
});


// API Routes
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// PWA Fallback Route (SPA Behavior)
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 আহরণী Z সার্ভার রান করছে: http://localhost:${PORT}`);
});