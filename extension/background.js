chrome.action.onClicked.addListener((tab) => {
    // চেক করা হচ্ছে ট্যাবের কোনো URL আছে কি না
    if (tab.url) {
        // বর্তমান URL কপি করে আহরণী Z সার্ভারে একটি কুয়েরি প্যারামিটার (?videoUrl=...) হিসেবে যুক্ত করা হচ্ছে
        const aharoniUrl = `https://aharoni-z.vercel.app/?videoUrl=${encodeURIComponent(tab.url)}`;
        
        // নতুন একটি ট্যাবে আহরণী Z-এর ওয়েবসাইট ওপেন করা হচ্ছে
        chrome.tabs.create({ url: aharoniUrl });
    }
});