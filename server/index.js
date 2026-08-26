require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
// Hugging Face ডিফল্টভাবে 7860 পোর্ট ব্যবহার করে
const PORT = process.env.PORT || 7860; 

// ==========================================
// Google Drive OAuth2 Setup
// ==========================================
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

// ডিপ্লয়মেন্টের পর .env ফাইলে আসল লিংক বসাতে হবে, আপাতত লোকাল লিংক থাকছে
const REDIRECT_URI = process.env.REDIRECT_URI || "http://localhost:7860/auth/google/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5000";

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);


// ==========================================
// Middleware
// ==========================================
// Vercel (Frontend) থেকে Hugging Face (Backend)-এ রিকোয়েস্ট অ্যালাউ করার জন্য CORS
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'OPTIONS']
}));
app.use(express.json());

// Serve Static Files (Frontend PWA)
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));


// ==========================================
// Google Auth Routes
// ==========================================
// ১. গুগল লগইন পেজে পাঠানোর রাউট
app.get('/auth/google', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive.file'] // শুধু আপলোড করার পারমিশন
    });
    res.redirect(url);
});

// ২. লগইন শেষে টোকেন নিয়ে ফ্রন্টএন্ডে ফেরার রাউট
app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        // টোকেনটি নিয়ে সরাসরি Vercel-এর ফ্রন্টএন্ড লিংকে রিডাইরেক্ট করে দেওয়া হলো
        res.redirect(`${FRONTEND_URL}/?token=${tokens.access_token}`);
    } catch (e) {
        console.error('Google Auth Error:', e);
        res.send("গুগল অথেনটিকেশন ফেইল করেছে! দয়া করে আবার চেষ্টা করুন।");
    }
});


// ==========================================
// App API Routes
// ==========================================
// কন্ট্রোলার ইমপোর্ট
const { getVideoInfo, streamMedia, progressStream, getPlaylistInfo } = require('./controllers/downloadLogic');

app.get('/api/progress', progressStream);

// নতুন প্লেলিস্ট API রাউট
app.post('/api/playlist', getPlaylistInfo);

// Basic API Route Test (Hugging Face এ সার্ভার ঠিক আছে কিনা চেক করার জন্য)
app.get('/api/test', (req, res) => {
    res.json({ message: "আহরণী Z ব্যাকএন্ড Hugging Face-এ সফলভাবে রান করছে! 🚀" });
});

// API Routes (External)
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);


// ==========================================
// PWA Fallback Route (SPA Behavior)
// ==========================================
// এই রাউটটি সবার শেষে থাকতে হবে
app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});


// ==========================================
// Start Server
// ==========================================
app.listen(PORT, () => {
    console.log(`🚀 আহরণী Z সার্ভার রান করছে: http://localhost:${PORT}`);
});