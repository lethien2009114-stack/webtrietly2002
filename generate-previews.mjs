import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // Next.js globally polyfills fetch, but node might need it or already have it natively in Node 18+

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const voices = [
    { name: "Aoede", desc: "Nữ trầm ấm" },
    { name: "Charon", desc: "Nam trầm thấp" },
    { name: "Fenrir", desc: "Nam mạnh mẽ" },
    { name: "Kore", desc: "Nữ nhẹ nhàng" },
    { name: "Puck", desc: "Nam vui vẻ" },
    { name: "Achernar", desc: "Nam chuẩn" },
    { name: "Achird", desc: "Nữ thanh lịch" },
    { name: "Algenib", desc: "Nam dứt khoát" },
    { name: "Algieba", desc: "Nữ điềm tĩnh" },
    { name: "Alnilam", desc: "Nam chậm rãi" },
    { name: "Autonoe", desc: "Nữ sôi nổi" },
    { name: "Callirrhoe", desc: "Nữ ấm áp" },
    { name: "Despina", desc: "Nữ dõng dạc" },
    { name: "Enceladus", desc: "Nam vang dội" },
    { name: "Erinome", desc: "Nữ truyền cảm" },
    { name: "Gacrux", desc: "Nam điềm đạm" },
    { name: "Iapetus", desc: "Nam mạnh mẽ" },
    { name: "Laomedeia", desc: "Nữ trong sáng" },
    { name: "Leda", desc: "Nữ linh hoạt" },
    { name: "Orus", desc: "Nam nghiêm trang" },
    { name: "Pulcherrima", desc: "Nữ uyển chuyển" },
    { name: "Rasalgethi", desc: "Nam vững vàng" },
    { name: "Sadachbia", desc: "Nam trưởng thành" },
    { name: "Sadaltager", desc: "Nam tự tin" },
    { name: "Schedar", desc: "Nữ tự nhiên" },
    { name: "Sulafat", desc: "Nam nhẹ nhàng" },
    { name: "Umbriel", desc: "Nam êm dịu" },
    { name: "Vindemiatrix", desc: "Nữ sắc sảo" },
    { name: "Zephyr", desc: "Nam bay bổng" },
    { name: "Zubenelgenubi", desc: "Nam rõ ràng" }
];

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("Missing GEMINI_API_KEY in environment");
    process.exit(1);
}

const NEXT_API_URL = 'http://localhost:3000/api/generate-tts';

async function generateAllVoices() {
    for (const voice of voices) {
        const filePath = path.join(__dirname, 'public', 'voice-samples', `${voice.name}.wav`);

        if (fs.existsSync(filePath)) {
            console.log(`[SKIP] ${voice.name}.wav already exists`);
            continue;
        }

        console.log(`Generating preview for ${voice.name}...`);

        try {
            // using global fetch, available in node 18+
            const res = await fetch(NEXT_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `Xin chào, đây là mẫu giọng ${voice.name}`,
                    voiceDescription: voice.desc,
                    apiKey: API_KEY,
                    voice: voice.name
                })
            });

            const data = await res.json();
            if (data.audioUrl) {
                const base64Data = data.audioUrl.split(',')[1];
                const buffer = Buffer.from(base64Data, 'base64');
                fs.writeFileSync(filePath, buffer);
                console.log(`[OK] Saved ${voice.name}.wav -> ${buffer.length} bytes`);
            } else {
                console.error(`[ERR] Failed to generate ${voice.name}:`, data.error || data);
            }
        } catch (err) {
            console.error(`[ERR] Fetch error for ${voice.name}:`, err.message);
        }

        await new Promise(r => setTimeout(r, 1000));
    }
}

generateAllVoices().then(() => console.log("Done generating all previews!"));
