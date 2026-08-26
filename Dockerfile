# Node.js ও Linux বেস ইমেজ
FROM node:18-bullseye

# FFMPEG এবং Python ইন্সটল করা (yt-dlp এর জন্য)
RUN apt-get update && apt-get install -y ffmpeg python3 python3-pip

# কাজের ডিরেক্টরি সেট করা
WORKDIR /app

# প্যাকেজ ফাইল কপি এবং ইন্সটল করা
COPY package*.json ./
RUN npm install

# বাকি সব কোড কপি করা
COPY . .

# পোর্ট 7860 এক্সপোজ করা (Hugging Face 7860 পোর্ট ব্যবহার করে)
EXPOSE 7860

# সার্ভার স্টার্ট করা
CMD ["node", "server/index.js"]