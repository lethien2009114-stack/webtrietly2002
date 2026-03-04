import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import installer from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { withKeyRotation } from '../utils';

ffmpeg.setFfmpegPath(installer.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

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

async function downloadFile(url: string, outputPath: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(outputPath, buffer);
}

const getAudioDuration = (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            const duration = metadata.format.duration;
            resolve(duration || 0);
        });
    });
};

export async function POST(req: Request) {
    const jobId = uuidv4();
    const tempDir = join(process.cwd(), 'tmp', jobId);

    try {
        const body = await req.json();
        const { scriptTexts, mediaItems, voice, voiceDescription, apiKey } = body;

        if (!scriptTexts || !mediaItems || !apiKey) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (mediaItems.length === 0 || scriptTexts.length === 0 || mediaItems.length !== scriptTexts.length) {
            return NextResponse.json({ error: 'Invalid or mismatched media/script data' }, { status: 400 });
        }

        await mkdir(tempDir, { recursive: true });

        const videoPaths: string[] = [];

        for (let i = 0; i < mediaItems.length; i++) {
            const item = mediaItems[i];
            const text = scriptTexts[i];

            console.log(`Processing segment ${i + 1}/${mediaItems.length}...`);

            // 1. Generate TTS audio for this segment
            const audioPath = join(tempDir, `audio_${i}.wav`);
            await withKeyRotation(apiKey, async (ai: GoogleGenAI) => {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash-preview-tts',
                    contents: `You are a professional voiceover artist. Read the following text aloud with the exact voice and emotion described here: "${voiceDescription || 'calm vietnamese voice'}". Text: ${text}`,
                    config: {
                        responseModalities: ["AUDIO"],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: voice || 'Aoede'
                                }
                            }
                        }
                    }
                });

                const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
                if (!inlineData?.data) throw new Error(`TTS failed for segment ${i}`);

                const mimeType = inlineData.mimeType || '';
                const rawBuffer = Buffer.from(inlineData.data, 'base64');

                let fileBuffer: any = rawBuffer;
                if (mimeType.includes('L16') || mimeType.includes('pcm') || mimeType === 'audio/raw' || !mimeType.includes('/')) {
                    let sampleRate = 24000;
                    const rateMatch = mimeType.match(/rate=(\d+)/);
                    if (rateMatch) sampleRate = parseInt(rateMatch[1]);
                    fileBuffer = pcmToWav(rawBuffer, sampleRate);
                }

                await writeFile(audioPath, new Uint8Array(fileBuffer));
            });

            // 2. Get audio duration
            const duration = await getAudioDuration(audioPath);
            console.log(`Segment ${i} audio duration: ${duration}s`);

            // 3. Download visual media
            const rawPath = join(tempDir, `raw_${i}.${item.type === 'image' ? 'jpg' : 'mp4'}`);
            const normalizedPath = join(tempDir, `norm_${i}.mp4`);

            const url = item.type === 'video' ? item.videoUrl : item.imageUrl;
            await downloadFile(url, rawPath);

            // 4. Combine visual and audio to exactly match the audio duration
            await new Promise((resolve, reject) => {
                let proc = ffmpeg().input(rawPath);

                if (item.type === 'image') {
                    proc = proc.inputOptions(['-loop 1']).outputOptions([`-t ${duration}`]);
                } else if (item.type === 'video') {
                    proc = proc.inputOptions(['-stream_loop', '-1']).outputOptions([`-t ${duration}`]);
                }

                proc.input(audioPath);

                proc.outputOptions([
                    '-map 0:v',
                    '-map 1:a',
                    '-vf scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
                    '-r 30',
                    '-c:v libx264',
                    '-preset fast',
                    '-crf 23',
                    '-pix_fmt yuv420p',
                    '-c:a aac',
                    '-b:a 128k',
                    `-t ${Math.ceil(duration)}`, // strictly limit the total duration of the segment
                    '-shortest'
                ])
                    .save(normalizedPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            videoPaths.push(normalizedPath);
        }

        // 5. Concat all segments
        const listPath = join(tempDir, 'videos.txt');
        const listContent = videoPaths.map(p => `file '${p}'`).join('\n');
        await writeFile(listPath, listContent);

        const finalOutputPath = join(tempDir, 'output.mp4');
        console.log("Concatenating all synced segments...");

        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(listPath)
                .inputOptions(['-f concat', '-safe 0'])
                .outputOptions([
                    '-c copy',
                    '-movflags +faststart'
                ])
                .save(finalOutputPath)
                .on('end', () => resolve(true))
                .on('error', reject);
        });

        const finalVideoBuffer = await fs.promises.readFile(finalOutputPath);

        // Asynchronously clean up the temp directory
        fs.promises.rm(tempDir, { recursive: true, force: true }).catch(err => console.error("Error cleaning up tmp dir:", err));

        const response = new NextResponse(finalVideoBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': 'attachment; filename="Tao_triet_ly_Sync.mp4"',
            },
        });

        return response;

    } catch (error: any) {
        console.error('Error in generate-sync-video:', error);

        // Attempt cleanup on error
        fs.promises.rm(tempDir, { recursive: true, force: true }).catch(e => console.error("Cleanup error:", e));

        return NextResponse.json({ error: error.message || 'Lỗi hệ thống khi tạo video đồng bộ' }, { status: 500 });
    }
}
