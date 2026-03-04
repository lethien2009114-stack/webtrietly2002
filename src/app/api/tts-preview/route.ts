import { NextResponse } from 'next/server';
import { withKeyRotation } from '../utils';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16): Buffer {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBuffer.length;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;
    const header = Buffer.alloc(headerSize);

    header.write('RIFF', 0);
    header.writeUInt32LE(totalSize - 8, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
}

export async function POST(req: Request) {
    try {
        const { voice, voiceDescription, apiKey } = await req.json();

        if (!voice || !apiKey) {
            return NextResponse.json({ error: 'Missing voice or apiKey' }, { status: 400 });
        }

        const publicDir = path.join(process.cwd(), 'public', 'voice-samples');
        const filePath = path.join(publicDir, `${voice}.wav`);

        // If the sample already exists locally, we don't need to generate it, 
        // but the frontend shouldn't even call this API if it can just load the URL directly.
        // This is a safety fallback just in case.
        if (fs.existsSync(filePath)) {
            return NextResponse.json({ audioUrl: `/voice-samples/${voice}.wav`, cached: true });
        }

        return await withKeyRotation(apiKey, async (ai: GoogleGenAI) => {
            const shortText = `Xin chào, đây là giọng mẫu ${voiceDescription.split(',')[0]}`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: `Read this text aloud: "${shortText}"`,
                config: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: voice }
                        }
                    }
                }
            });

            const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;

            if (inlineData?.data) {
                const mimeType = inlineData.mimeType || '';
                const rawBuffer = Buffer.from(inlineData.data, 'base64');

                let wavBuffer: any = rawBuffer;
                if (mimeType.includes('L16') || mimeType.includes('pcm') || mimeType === 'audio/raw' || !mimeType.includes('/')) {
                    let sampleRate = 24000;
                    const rateMatch = mimeType.match(/rate=(\d+)/);
                    if (rateMatch) sampleRate = parseInt(rateMatch[1]);
                    wavBuffer = pcmToWav(rawBuffer as any, sampleRate);
                }

                // Ensure directory exists
                if (!fs.existsSync(publicDir)) {
                    fs.mkdirSync(publicDir, { recursive: true });
                }

                // Save permanently for future free use
                fs.writeFileSync(filePath, wavBuffer);

                const wavBase64 = wavBuffer.toString('base64');
                return NextResponse.json({
                    audioUrl: `data:audio/wav;base64,${wavBase64}`,
                    cached: false
                });
            }

            throw new Error('Gemini TTS did not return audio data');
        });
    } catch (error: any) {
        console.error('Error generating TTS Preview:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
