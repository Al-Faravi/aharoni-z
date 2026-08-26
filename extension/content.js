// ভিডিও ট্যাগ খোঁজা এবং তার ভেতরে লোগো বসানোর ফাংশন
function injectAharoniLogo() {
    const videos = document.querySelectorAll('video');

    videos.forEach(video => {
        // ভিডিওর আসল কন্টেইনার (YouTube/FB এর জন্য)
        const container = video.closest('.html5-video-player') || video.parentElement;
        
        // কন্টেইনার না পেলে বা আগে থেকেই লোগো থাকলে বাদ দাও
        if (!container || container.querySelector('.aharoni-z-video-btn')) return;

        // ভিডিওর প্যারেন্টকে relative পজিশন দেওয়া, যাতে লোগোটি ফ্রেমের বাইরে না যায়
        if (window.getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        // বাটন তৈরি
        const aharoniBtn = document.createElement("button");
        aharoniBtn.className = "aharoni-z-video-btn";
        aharoniBtn.title = "Aharoni Z দিয়ে এই ভিডিওটি ডাউনলোড করুন";

        // লোগো ইমেজ তৈরি
        const logoImg = document.createElement("img");
        logoImg.src = chrome.runtime.getURL("logo.png"); // এক্সটেনশন থেকে লোগো লোড
        
        aharoniBtn.appendChild(logoImg);

        // ক্লিক ইভেন্ট
        aharoniBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation(); // ক্লিক করলে যেন ভিডিও পজ (Pause) না হয়

            const videoUrl = window.location.href; 
            const aharoniUrl = `https://aharoni-z.vercel.app/?videoUrl=${encodeURIComponent(videoUrl)}`;
            window.open(aharoniUrl, "_blank");
        });

        // ভিডিও ফ্রেমের ভেতরে লোগো বাটনটি বসানো
        container.appendChild(aharoniBtn);
    });
}

// প্রতি ২ সেকেন্ড পর পর চেক করবে (কারন ইউটিউব/ফেসবুকে স্ক্রল করলে নতুন ভিডিও লোড হয়)
setInterval(injectAharoniLogo, 2000);