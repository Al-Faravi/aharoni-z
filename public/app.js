// LocalStorage থেকে হিস্ট্রি লোড করা
const loadHistory = () => {
    const historyList = document.getElementById('historyList');
    let history = JSON.parse(localStorage.getItem('az_history')) || [];
    
    if (history.length === 0) {
        historyList.innerHTML = '<li style="color: #9496a8; text-align:center; padding: 10px;">কোনো ডাউনলোড হিস্ট্রি নেই</li>';
        return;
    }

    historyList.innerHTML = '';
    // সর্বশেষ ৫টি হিস্ট্রি দেখাবে
    history.slice(0, 5).forEach(item => {
        const li = document.createElement('li');
        li.className = 'history-item';
        // হিস্ট্রিতে ক্লিক করলে লিংকটি ইনপুটে বসে যাবে
        li.innerHTML = `
            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%;">${item.title}</span>
            <span class="badge">${item.format}</span>
        `;
        li.style.cursor = 'pointer';
        li.onclick = () => { document.getElementById('urlInput').value = item.url; };
        historyList.appendChild(li);
    });
};

// অ্যাপ চালুর সাথে সাথে হিস্ট্রি লোড হবে
loadHistory();

document.getElementById('downloadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const url = document.getElementById('urlInput').value;
    const loader = document.getElementById('loader');
    const resultContainer = document.getElementById('resultContainer');
    const fetchBtn = document.getElementById('fetchBtn');
    
    loader.classList.remove('hidden');
    resultContainer.classList.add('hidden');
    fetchBtn.disabled = true;
    
    try {
        const response = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // UI আপডেট
            document.getElementById('vidThumb').src = data.thumbnail;
            document.getElementById('vidTitle').innerText = data.title;
            document.getElementById('vidDuration').innerText = `সময়কাল: ${data.duration}`;
            
            // --- ভিডিও ট্রিমার ইনিশিয়ালাইজেশন ---
            const trimSection = document.getElementById('trimSection');
            trimSection.classList.remove('hidden'); // ট্রিম বক্স দেখাবে
            
            const enableTrimCheckbox = document.getElementById('enableTrim');
            const trimControls = document.getElementById('trimControls');
            const rangeStart = document.getElementById('rangeStart');
            const rangeEnd = document.getElementById('rangeEnd');
            const startTimeDisplay = document.getElementById('startTimeDisplay');
            const endTimeDisplay = document.getElementById('endTimeDisplay');
            const clipDurationDisplay = document.getElementById('clipDurationDisplay');

            // ভিডিওর ডুরেশন স্ট্রিং (যেমন: "3:45" বা "1:05:20") কে মোট সেকেন্ডে রূপান্তর করা
            const parseDurationToSeconds = (durStr) => {
                if (!durStr) return 0;
                const parts = durStr.split(':').map(Number);
                if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
                if (parts.length === 2) return parts[0] * 60 + parts[1];
                return parts[0] || 60; // ডিফল্ট ৬০ সেকেন্ড যদি না মিলে
            };

            const totalSeconds = parseDurationToSeconds(data.duration);
            
            rangeStart.min = 0;
            rangeStart.max = totalSeconds;
            rangeStart.value = 0;

            rangeEnd.min = 0;
            rangeEnd.max = totalSeconds;
            rangeEnd.value = totalSeconds;

            // সেকেন্ডকে প্রিটি টাইম ফরম্যাটে (HH:MM:SS) দেখানোর ফাংশন
            const formatTime = (sec) => {
                const h = Math.floor(sec / 3600);
                const m = Math.floor((sec % 3600) / 60);
                const s = Math.floor(sec % 60);
                return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
            };

            // স্লাইডার টগল করা
            enableTrimCheckbox.onchange = () => {
                if (enableTrimCheckbox.checked) {
                    trimControls.style.opacity = '1';
                    trimControls.style.pointerEvents = 'auto';
                } else {
                    trimControls.style.opacity = '0.4';
                    trimControls.style.pointerEvents = 'none';
                }
            };

            // স্লাইডার টানলে লাইভ টাইম আপডেট হওয়া
            const updateSliderUI = () => {
                let startVal = parseInt(rangeStart.value);
                let endVal = parseInt(rangeEnd.value);

                if (startVal >= endVal) {
                    rangeStart.value = endVal - 1 > 0 ? endVal - 1 : 0;
                    startVal = parseInt(rangeStart.value);
                }

                startTimeDisplay.innerText = `শুরু: ${formatTime(startVal)}`;
                endTimeDisplay.innerText = `শেষ: ${formatTime(endVal)}`;
                
                const clipLen = endVal - startVal;
                clipDurationDisplay.innerText = `নির্বাচিত অংশ: ${formatTime(clipLen)}`;
            };

            rangeStart.oninput = updateSliderUI;
            rangeEnd.oninput = updateSliderUI;
            updateSliderUI();
            // --- ট্রিমার ইনিশিয়ালাইজেশন শেষ ---

            // HD থাম্বনেইল ডাউনলোড বাটন লজিক
            document.getElementById('downloadThumbBtn').onclick = () => {
                window.open(data.thumbnail, '_blank');
            };

            // ফরম্যাট ড্রপডাউন তৈরি
            let selectHTML = `<select id="formatSelect">`;
            
            data.formats.forEach(format => {
                if(format.type === 'video') {
                    selectHTML += `<option value="${format.format_id}" data-ext="${format.ext}" data-name="${format.resolution}">🎬 ${format.resolution} (.${format.ext})</option>`;
                }
            });

            // অ্যাডভান্সড অডিও অপশন (Audiophile Mode)
            selectHTML += `
                <option value="bestaudio" data-ext="mp3" data-name="MP3 (320kbps)">🎵 MP3 - Premium (320kbps)</option>
                <option value="bestaudio" data-ext="m4a" data-name="M4A (128kbps)">🎵 M4A - Standard (128kbps)</option>
                <option value="bestaudio" data-ext="wav" data-name="WAV (Lossless)">🎼 WAV - Lossless (Studio)</option>
            `;
            selectHTML += `</select>`;
            
            const downloadBtn = document.createElement('button');
            downloadBtn.style.width = '100%';
            downloadBtn.innerHTML = '⬇ ডাউনলোড করুন';
            
            const optionsContainer = document.getElementById('downloadOptions');
            optionsContainer.innerHTML = selectHTML;
            optionsContainer.appendChild(downloadBtn);
            
            // ডাউনলোড ক্লিক ইভেন্ট (Live Progress যুক্ত)
            downloadBtn.onclick = () => {
                const selectBox = document.getElementById('formatSelect');
                const selectedFormat = selectBox.value;
                const selectedExt = selectBox.options[selectBox.selectedIndex].getAttribute('data-ext');
                const selectedName = selectBox.options[selectBox.selectedIndex].getAttribute('data-name');
                
                // হিস্ট্রিতে সেভ করা
                let history = JSON.parse(localStorage.getItem('az_history')) || [];
                history.unshift({ title: data.title, url: url, format: selectedName });
                localStorage.setItem('az_history', JSON.stringify(history));
                loadHistory();

                // UI লক করা
                downloadBtn.innerHTML = '⏳ ডাউনলোডিং...';
                downloadBtn.style.backgroundColor = '#e6a800';
                downloadBtn.disabled = true;
                
                // প্রোগ্রেস বার রেডি করা
                const progressArea = document.getElementById('progressArea');
                const progressBar = document.getElementById('progressBar');
                const progressText = document.getElementById('progressText');
                
                progressArea.classList.remove('hidden');
                progressBar.style.width = '0%';
                progressText.innerText = 'সার্ভারে কানেক্ট করা হচ্ছে...';
                
                // ১. ইউনিক ক্লায়েন্ট আইডি তৈরি
                const clientId = Date.now();
                
                // ২. SSE (Server-Sent Events) কানেকশন তৈরি
                const eventSource = new EventSource(`/api/progress?id=${clientId}`);
                
                eventSource.onmessage = (event) => {
                    const data = event.data;
                    
                    if (data === 'DONE') {
                        progressText.innerText = '✅ প্রসেসিং শেষ! আপনার ব্রাউজারে সেভ হচ্ছে...';
                        progressBar.style.width = '100%';
                        progressBar.style.backgroundColor = '#00b894'; // সাকসেস কালার (Green)
                        eventSource.close(); // কানেকশন বন্ধ
                        
                        // কিছু সেকেন্ড পর বাটন রিসেট
                        setTimeout(() => {
                            downloadBtn.innerHTML = '⬇ আবার ডাউনলোড করুন';
                            downloadBtn.style.backgroundColor = 'var(--primary)';
                            downloadBtn.disabled = false;
                        }, 5000);
                    } else {
                        // পার্সেন্টেজ আপডেট
                        progressBar.style.width = `${data}%`;
                        progressText.innerText = `সার্ভারে প্রসেস হচ্ছে: ${data}%`;
                    }
                };

                eventSource.onerror = () => {
                    progressText.innerText = 'অপেক্ষা করুন... (মার্জিং চলছে)';
                    eventSource.close();
                };

                // ৩. ডাউনলোড রিকোয়েস্ট পাঠানো
                
                // হিডেন আইফ্রেম দিয়ে ডাউনলোড কল করা (যাতে পেজ রিলোড না নেয়)
                let iframe = document.getElementById('downloadIframe');
                if (!iframe) {
                    iframe = document.createElement('iframe');
                    iframe.id = 'downloadIframe';
                    iframe.style.display = 'none';
                    document.body.appendChild(iframe);
                }

                // ডাউনলোড URL তৈরি
                let downloadUrl = `/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(selectedFormat)}&ext=${selectedExt}&title=${encodeURIComponent(data.title)}&clientId=${clientId}`;
                
                // ট্রিম ডেটা যুক্ত করা
                const isTrimEnabled = document.getElementById('enableTrim').checked;
                if (isTrimEnabled) {
                    const startTimeSec = document.getElementById('rangeStart').value;
                    const endTimeSec = document.getElementById('rangeEnd').value;
                    downloadUrl += `&startTime=${startTimeSec}&endTime=${endTimeSec}`;
                }

                iframe.src = downloadUrl;
            };
            
            loader.classList.add('hidden');
            resultContainer.classList.remove('hidden');
        } else {
            alert(data.error || 'তথ্য পাওয়া যাচ্ছে না।');
            loader.classList.add('hidden');
        }
    } catch (error) {
        alert('সার্ভারের সাথে কানেক্ট করা যাচ্ছে না!');
        loader.classList.add('hidden');
    } finally {
        fetchBtn.disabled = false;
    }
});