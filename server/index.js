require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 5000;

// ==========================================
// Google Drive OAuth2 Setup
// ==========================================
// TODO: আপনার Google Console থেকে পাওয়া ID ও Secret এখানে বসান

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:5000/auth/google/callback";

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);


// ==========================================
// Middleware
// ==========================================
app.use(cors());
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
        // টোকেনটি নিয়ে ফ্রন্টএন্ডে রিডাইরেক্ট করে দেওয়া হলো
        res.redirect(`/?token=${tokens.access_token}`);
    } catch (e) {
        console.error(e);
        res.send("গুগল অথেনটিকেশন ফেইল করেছে!");
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

// Basic API Route Test
app.get('/api/test', (req, res) => {
    res.json({ message: "আহরণী Z ব্যাকএন্ড সফলভাবে রান করছে!" });
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