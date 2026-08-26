const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis'); // ☁️ Google API

const tempDir = path.join(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// সেকেন্ড থেকে HH:MM:SS ফরম্যাটে রূপান্তর করার হেল্পার ফাংশন
const secondsToHMS = (totalSeconds) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return [hours, minutes, seconds]
        .map(v => v < 10 ? "0" + v : v)
        .join(":");
};

// লাইভ প্রোগ্রেস ট্র্যাক করার জন্য ক্লায়েন্টদের স্টোর করার অবজেক্ট
const progressClients = {};

const cleanUrl = (rawUrl) => {
    try {
        const parsed = new URL(rawUrl);
        if (parsed.hostname.includes('youtube.com')) {
            parsed.searchParams.delete('list');
            parsed.searchParams.delete('index');
        }
        return parsed.toString();
    } catch (e) {
        return rawUrl;
    }
};

const getVideoInfo = async (req, res) => {
    const { url, cookies } = req.body; // কুকি রিসিভ করা হলো
    if (!url) return res.status(400).json({ error: 'URL দেওয়া হয়নি!' });

    const safeUrl = cleanUrl(url);
    console.log(`\n🔍 ভিডিওর তথ্য খোঁজা হচ্ছে: ${safeUrl}`);

    // কুকি ফাইল ম্যানেজমেন্ট
    let cookiePath = null;
    let cookieId = null;

    let ytDlpArgs = [
        '--no-warnings', 
        '--no-playlist', 
        '--force-ipv4',            
        '--no-check-certificates', 
        '--no-write-comments',
        '-j', 
        safeUrl
    ];

    // যদি ইউজার কুকি দিয়ে থাকে
    if (cookies) {
        cookieId = `cookie_${Date.now()}`;
        cookiePath = path.join(tempDir, `${cookieId}.txt`);
        fs.writeFileSync(cookiePath, cookies); // কুকি ফাইলে লেখা হলো
        ytDlpArgs.push('--cookies', cookiePath); // yt-dlp কে কুকি ফাইল ধরিয়ে দেওয়া হলো
        console.log(`🔐 প্রাইভেট সেশন কুকি ব্যবহার করা হচ্ছে...`);
    }

    const ytDlp = spawn('yt-dlp', ytDlpArgs);
    
    let output = '';
    let errorOutput = '';

    ytDlp.stdout.on('data', (data) => { output += data.toString(); });
    ytDlp.stderr.on('data', (data) => { errorOutput += data.toString(); });

    ytDlp.on('close', (code) => {
        if (code !== 0) {
            console.log("❌ [Info Fetch Error]:", errorOutput);
            return res.status(500).json({ error: 'ভিডিওর তথ্য পাওয়া যায়নি। প্রাইভেট ভিডিও হলে সঠিক কুকি দিন।' });
        }
        try {
            console.log(`✅ তথ্য সফলভাবে পাওয়া গেছে!`);
            const jsonString = output.trim().split('\n')[0];
            const info = JSON.parse(jsonString);
            
            const formats = [];
            const seenHeights = new Set();

            info.formats.forEach(f => {
                if (f.vcodec !== 'none' && f.height) {
                    if (!seenHeights.has(f.height)) {
                        seenHeights.add(f.height);
                        formats.push({
                            type: 'video',
                            format_id: `bestvideo[height<=${f.height}]+bestaudio/best[height<=${f.height}]`,
                            resolution: `${f.height}p Video`,
                            ext: 'mp4'
                        });
                    }
                }
            });

            if (formats.length === 0) {
                formats.push({ type: 'video', format_id: 'best', resolution: 'Best Quality', ext: 'mp4' });
            } else {
                formats.sort((a, b) => parseInt(b.resolution) - parseInt(a.resolution));
            }
            formats.push({ type: 'audio', format_id: 'bestaudio', resolution: 'High Quality Audio', ext: 'mp3' });

            res.json({ 
                title: info.title || 'Aharoni_Z_Video', 
                thumbnail: info.thumbnail, 
                duration: info.duration_string || 'Unknown', 
                formats: formats,
                cookieId: cookieId // ফ্রন্টএন্ডে cookieId পাঠানো হলো
            });
        } catch (e) {
            res.status(500).json({ error: 'ডেটা পার্স করতে সমস্যা হয়েছে।' });
        }
    });
};

// ফ্রন্টএন্ডে লাইভ প্রোগ্রেস পাঠানোর জন্য (SSE)
const progressStream = (req, res) => {
    const clientId = req.query.id;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    progressClients[clientId] = res;

    req.on('close', () => {
        delete progressClients[clientId];
    });
};

const streamMedia = (req, res) => {
    req.setTimeout(0); 

    // প্যারামিটারসমূহ গ্রহণ করা হলো
    const { url, format, ext, title, clientId, startTime, endTime, cookieId, driveToken, saveToDrive, isDriveSave } = req.query;
    if (!url || !format) return res.status(400).send('URL এবং Format ID প্রয়োজন!');

    const safeUrl = cleanUrl(url);
    const safeTitle = (title || 'Aharoni_Z').replace(/[<>:"/\\|?*]+/g, '').trim();
    const tempFileName = `aharoni_${Date.now()}.${ext}`;
    const filePath = path.join(tempDir, tempFileName);

    let ytDlpArgs = ['--newline', '--no-playlist'];

    // কুকি ফাইল ব্যবহার
    let cookiePath = null;
    if (cookieId) {
        cookiePath = path.join(tempDir, `${cookieId}.txt`);
        if (fs.existsSync(cookiePath)) {
            ytDlpArgs.push('--cookies', cookiePath);
            console.log(`🔐 ডাউনলোডের জন্য কুকি ব্যবহার করা হচ্ছে...`);
        }
    }

    // ট্রিম করার লজিক চেক
    if (startTime !== undefined && endTime !== undefined && startTime !== '' && endTime !== '') {
        const startHMS = secondsToHMS(parseInt(startTime));
        const endHMS = secondsToHMS(parseInt(endTime));
        ytDlpArgs.push('--download-sections', `*${startHMS}-${endHMS}`);
        
        console.log(`\n✂️ ট্রিমসহ ডাউনলোড শুরু হচ্ছে: ${safeTitle} (${startHMS} থেকে ${endHMS})`);
    } else {
        console.log(`\n⬇️ সম্পূর্ণ ডাউনলোড শুরু হচ্ছে: ${safeTitle}`);
    }

    if (ext === 'mp3') {
        ytDlpArgs.push('-f', format, '--extract-audio', '--audio-format', 'mp3', '-o', filePath, safeUrl);
    } else {
        ytDlpArgs.push('-f', format, '--merge-output-format', 'mp4', '-o', filePath, safeUrl);
    }

    const ytDlp = spawn('yt-dlp', ytDlpArgs);

    ytDlp.stdout.on('data', (data) => {
        const text = data.toString();
        const match = text.match(/\[download\]\s+([\d\.]+)%/);
        if (match && clientId && progressClients[clientId]) {
            progressClients[clientId].write(`data: ${match[1]}\n\n`);
        }
    });

    ytDlp.stderr.on('data', (data) => {
        const text = data.toString();
        const match = text.match(/\[download\]\s+([\d\.]+)%/);
        if (match && clientId && progressClients[clientId]) {
            progressClients[clientId].write(`data: ${match[1]}\n\n`);
        }
    });

    // 🔴 ytDlp ক্লোজ ইভেন্ট আপডেট করা হলো
    ytDlp.on('close', async (code) => {
        // ডাউনলোড শেষে অস্থায়ী কুকি ফাইল মুছে ফেলা
        if (cookiePath && fs.existsSync(cookiePath)) {
            try {
                fs.unlinkSync(cookiePath);
                console.log(`🗑️ কুকি ফাইল মুছে ফেলা হয়েছে।`);
            } catch (err) {
                console.error('কুকি ফাইল মুছতে সমস্যা:', err);
            }
        }

        const isCloudSave = saveToDrive === 'true' || isDriveSave === 'true'; // ড্রাইভে সেভ করার ফ্ল্যাগ
        const userToken = driveToken || req.query.driveToken;

        if (code === 0 && fs.existsSync(filePath)) {
            console.log(`✅ প্রসেসিং সফল!`);

            const finalName = (startTime !== undefined && endTime !== undefined && startTime !== '' && endTime !== '') 
                              ? `${safeTitle}_trimmed.${ext}` 
                              : `${safeTitle}.${ext}`;

            if (isCloudSave && userToken) {
                // ☁️ ইউজারের গুগল ড্রাইভে আপলোড
                console.log(`☁️ ইউজারের ড্রাইভে ফাইল আপলোড হচ্ছে...`);
                if (clientId && progressClients[clientId]) {
                    progressClients[clientId].write(`data: ☁️ ফাইল গুগল ড্রাইভে আপলোড হচ্ছে, অপেক্ষা করুন...\n\n`);
                }

                // ==========================================
                // 🪄 ম্যাজিক ট্রাই-ক্যাচ ব্লক (নতুন আপডেটেড)
                // ==========================================
                try {
                    const oauth2Client = new google.auth.OAuth2();
                    oauth2Client.setCredentials({ access_token: userToken });
                    
                    const drive = google.drive({ version: 'v3', auth: oauth2Client });
                    
                    const folderName = 'Aharoni Z';
                    let folderId = null;

                    // ১. ফোল্ডার খোঁজা (Aharoni Z নামে ফোল্ডার আছে কি না)
                    const resFolder = await drive.files.list({
                        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
                        fields: 'files(id, name)',
                        spaces: 'drive'
                    });

                    if (resFolder.data.files.length > 0) {
                        // ফোল্ডার পাওয়া গেছে
                        folderId = resFolder.data.files[0].id;
                        console.log(`📂 '${folderName}' ফোল্ডার পাওয়া গেছে (ID: ${folderId})`);
                    } else {
                        // ২. ফোল্ডার না পেলে নতুন তৈরি করা
                        console.log(`📁 '${folderName}' ফোল্ডার নেই, নতুন তৈরি করা হচ্ছে...`);
                        const folderMetadata = {
                            name: folderName,
                            mimeType: 'application/vnd.google-apps.folder'
                        };
                        const folder = await drive.files.create({
                            resource: folderMetadata,
                            fields: 'id'
                        });
                        folderId = folder.data.id;
                    }
                    
                    // ৩. নির্দিষ্ট ফোল্ডারের ভেতর ফাইল আপলোড করা
                    const fileMetadata = { 
                        name: finalName, // finalName ব্যবহার করা হলো যাতে ট্রিম করা ফাইলের নামও ঠিক থাকে
                        parents: [folderId] // ম্যাজিক! ফাইলটি সরাসরি এই ফোল্ডারে যাবে
                    };
                    const media = {
                        mimeType: 'application/octet-stream',
                        body: fs.createReadStream(filePath)
                    };
                    
                    await drive.files.create({
                        resource: fileMetadata,
                        media: media,
                        fields: 'id'
                    });

                    console.log(`✅ ইউজারের '${folderName}' ফোল্ডারে আপলোড সফল!`);
                    if (clientId && progressClients[clientId]) progressClients[clientId].write(`data: DONE\n\n`);
                    
                    // ব্রাউজারকে রেসপন্স পাঠানো
                    if (!res.headersSent) res.status(200).send('Google Drive-এ আপলোড সফল হয়েছে!');
                    
                    // লোকাল পিসি/সার্ভার থেকে ডিলিট
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

                } catch (error) {
                    console.log('❌ ড্রাইভ আপলোড এরর:', error.message);
                    if (!res.headersSent) res.status(500).send('Google Drive-এ আপলোড ব্যর্থ হয়েছে।');
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
                // ==========================================

            } else {
                // 📥 সরাসরি ব্রাউজার ডাউনলোড
                if (clientId && progressClients[clientId]) {
                    progressClients[clientId].write(`data: DONE\n\n`);
                }
                console.log(`✅ প্রসেসিং সফল! ব্রাউজারে ফাইল পাঠানো হচ্ছে...`);
                
                res.download(filePath, finalName, (err) => {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                });
            }
        } else {
            console.log(`❌ প্রসেসিং ব্যর্থ হয়েছে! Exit Code: ${code}`);
            if (clientId && progressClients[clientId]) {
                progressClients[clientId].write(`data: DONE\n\n`);
            }
            if (!res.headersSent) res.status(500).send('সার্ভারে ফাইল প্রসেস করতে সমস্যা হয়েছে।');
        }
    });
};

const getPlaylistInfo = (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL দেওয়া হয়নি!' });

    console.log(`\n📑 প্লেলিস্টের তথ্য খোঁজা হচ্ছে: ${url}`);

    const ytDlp = spawn('yt-dlp', ['--flat-playlist', '-J', url]);
    
    let output = '';
    ytDlp.stdout.on('data', (data) => { output += data.toString(); });

    ytDlp.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).json({ error: 'প্লেলিস্টের তথ্য পাওয়া যায়নি।' });
        }
        try {
            const info = JSON.parse(output);
            if (!info.entries || info.entries.length === 0) {
                return res.status(404).json({ error: 'প্লেলিস্টে কোনো ভিডিও পাওয়া যায়নি।' });
            }

            const videos = info.entries.map((entry, index) => ({
                index: index + 1,
                title: entry.title,
                url: entry.url,
                duration: entry.duration ? (entry.duration / 60).toFixed(2) + ' Min' : 'N/A'
            }));

            res.json({
                playlistTitle: info.title || 'Unknown Playlist',
                totalVideos: videos.length,
                videos: videos
            });
        } catch (e) {
            res.status(500).json({ error: 'ডেটা পার্স করতে সমস্যা হয়েছে।' });
        }
    });
};

module.exports = { getVideoInfo, streamMedia, progressStream, getPlaylistInfo };