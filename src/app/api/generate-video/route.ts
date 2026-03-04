import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import installer from '@ffmpeg-installer/ffmpeg';
import ffprobeInstaller from '@ffprobe-installer/ffprobe';
import fs from 'fs';

// Set the paths to the ffmpeg binaries
ffmpeg.setFfmpegPath(installer.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

// Helper function to download a file
async function downloadFile(url: string, outputPath: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(outputPath, buffer);
}

// Helper to get video duration using ffprobe
const getVideoDuration = (filePath: string): Promise<number> => {
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
        const formData = await req.formData();
        const audioFile = formData.get('audio') as File;
        const mediaItemsStr = formData.get('mediaItems') as string;

        // Remove scriptTexts dependency since subtitles are no longer needed
        // const scriptTextsStr = formData.get('scriptTexts') as string;

        if (!audioFile || !mediaItemsStr) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const mediaItems: any[] = JSON.parse(mediaItemsStr);

        if (mediaItems.length === 0) {
            return NextResponse.json({ error: 'No media provided' }, { status: 400 });
        }

        // 1. Create temporary directory
        await mkdir(tempDir, { recursive: true });

        // 2. Save uploaded audio
        const audioPath = join(tempDir, 'audio.mp3');
        const audioArrayBuffer = await audioFile.arrayBuffer();
        await writeFile(audioPath, Buffer.from(audioArrayBuffer));

        // 3. Download, process, and normalize all media
        // The goal is to make every piece perfectly matching 1080x1920 at 30fps
        // so FFmpeg's concat demuxer does not fail or jitter.
        const videoPaths: string[] = [];

        const TARGET_TOTAL_DURATION = 150; // 2 minutes 30 seconds
        const durationPerItem = Number((TARGET_TOTAL_DURATION / mediaItems.length).toFixed(3));
        console.log(`Target total duration: ${TARGET_TOTAL_DURATION}s, Items: ${mediaItems.length}, Duration per item: ${durationPerItem}s`);

        for (let i = 0; i < mediaItems.length; i++) {
            const item = mediaItems[i];
            const rawPath = join(tempDir, `raw_${i}.${item.type === 'image' ? 'jpg' : 'mp4'}`);
            const normalizedPath = join(tempDir, `norm_${i}.mp4`);

            const url = item.type === 'video' ? item.videoUrl : item.imageUrl;
            console.log(`Downloading and normalizing media ${i + 1}/${mediaItems.length}...`);
            await downloadFile(url, rawPath);

            await new Promise((resolve, reject) => {
                let proc = ffmpeg().input(rawPath);

                if (item.type === 'image') {
                    proc = proc.inputOptions(['-loop 1']).outputOptions([`-t ${durationPerItem}`]);
                } else if (item.type === 'video') {
                    proc = proc.inputOptions(['-stream_loop', '-1']).outputOptions([`-t ${durationPerItem}`]);
                }

                // Add dummy silent audio using lavfi format
                proc.input('anullsrc=channel_layout=stereo:sample_rate=44100')
                    .inputFormat('lavfi');

                proc.outputOptions([
                    // Standardize resolution by scaling to fit, then cropping to exactly 1080x1920
                    '-vf scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',

                    // Standardize frame rate and codec
                    '-r 30',
                    '-c:v libx264',
                    '-preset fast',
                    '-crf 23',
                    '-pix_fmt yuv420p',

                    // Audio codec for dummy audio
                    '-c:a aac',
                    '-shortest' // Cut dummy audio when video stream ends
                ])
                    .save(normalizedPath)
                    .on('end', resolve)
                    .on('error', reject);
            });

            videoPaths.push(normalizedPath);
        }

        // 4. Create a text file listing all normalized videos for ffmpeg concat demuxer
        const listPath = join(tempDir, 'videos.txt');
        const listContent = videoPaths.map(p => `file '${p}'`).join('\n');
        await writeFile(listPath, listContent);

        // 5. Final FFmpeg pipeline: Concat -> Overlay Audio Loop
        const finalOutputPath = join(tempDir, 'output.mp4');
        console.log("Stitching videos and looping audio...");

        await new Promise((resolve, reject) => {
            ffmpeg()
                // Input 1: The concatenated video stream
                .input(listPath)
                .inputOptions(['-f concat', '-safe 0'])

                // Input 2: The audio file
                .input(audioPath)
                .inputOptions(['-stream_loop -1']) // Loop indefinitely

                // Removed complex filter for subtitles
                // Map the video [0:v] and the looped audio [1:a]
                .outputOptions([
                    '-map 0:v',
                    '-map 1:a',

                    // Take shortest stream (the concatenated video will determine the length)
                    '-shortest',

                    '-c:v libx264',
                    '-preset fast',
                    '-c:a aac',
                    '-b:a 128k',
                    '-movflags +faststart'
                ])
                .save(finalOutputPath)
                .on('end', () => {
                    console.log('Final FFmpeg processing finished successfully.');
                    resolve(true);
                })
                .on('error', (err, stdout, stderr) => {
                    console.error('Error during FFmpeg compilation:', err.message);
                    console.error('FFmpeg stderr:', stderr);
                    reject(new Error(`FFmpeg error: ${err.message}`));
                });
        });

        // 6. Read the generated file and return it
        const finalVideoBuffer = await fs.promises.readFile(finalOutputPath);

        // Asynchronously clean up the temp directory after reading (fire and forget)
        fs.promises.rm(tempDir, { recursive: true, force: true }).catch(err => console.error("Error cleaning up tmp dir:", err));

        // Return the video file directly
        const response = new NextResponse(finalVideoBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': 'attachment; filename="Tao_triet_ly_Extended.mp4"',
            },
        });

        return response;

    } catch (error: any) {
        console.error('Error in generate-video:', error);

        // Attempt cleanup on error
        fs.promises.rm(tempDir, { recursive: true, force: true }).catch(e => console.error("Cleanup error:", e));

        return NextResponse.json({ error: error.message || 'Lỗi hệ thống khi tạo video' }, { status: 500 });
    }
}
