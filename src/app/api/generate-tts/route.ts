import { NextResponse } from 'next/server';
import { withKeyRotation } from '../utils';
import { GoogleGenAI } from '@google/genai';

/**
 * Convert raw PCM audio data to WAV format by adding a proper WAV header.
 * Gemini TTS returns audio/L16 (raw 16-bit PCM at 24000Hz) which browsers can't play directly.
 */
function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16): Buffer {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBuffer.length;
    const headerSize = 44;
    const totalSize = headerSize + dataSize;

    const header = Buffer.alloc(headerSize);

    // RIFF header
    header.write('RIFF', 0);
    header.writeUInt32LE(totalSize - 8, 4);
    header.write('WAVE', 8);

    // fmt sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    header.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
}

export async function POST(req: Request) {
    try {
        const { text, voiceDescription, apiKey, voice = 'Aoede' } = await req.json();

        if (!text || !apiKey) {
            return NextResponse.json({ error: 'Missing text or apiKey' }, { status: 400 });
        }

        return await withKeyRotation(apiKey, async (ai: GoogleGenAI) => {
            // Use the dedicated TTS model via Google AI Studio SDK
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-preview-tts',
                contents: `You are a professional voiceover artist. Read the following text aloud with the exact voice and emotion described here: "${voiceDescription || 'calm vietnamese voice'}". Text: ${text}`,
                config: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voice
                            }
                        }
                    }
                }
            });

            const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;

            if (inlineData?.data) {
                const mimeType = inlineData.mimeType || '';
                const rawBuffer = Buffer.from(inlineData.data, 'base64');

                // If the audio is raw PCM (audio/L16), convert to WAV so browsers can play it
                if (mimeType.includes('L16') || mimeType.includes('pcm') || mimeType === 'audio/raw' || !mimeType.includes('/')) {
                    // Extract sample rate from mimeType if present (e.g., "audio/L16;rate=24000")
                    let sampleRate = 24000;
                    const rateMatch = mimeType.match(/rate=(\d+)/);
                    if (rateMatch) sampleRate = parseInt(rateMatch[1]);

                    const wavBuffer = pcmToWav(rawBuffer, sampleRate);
                    const wavBase64 = wavBuffer.toString('base64');

                    return NextResponse.json({
                        audioUrl: `data:audio/wav;base64,${wavBase64}`,
                        source: `Gemini 2.5 Flash TTS (${voice})`
                    });
                }

                // If it's already a browser-playable format (mp3, wav, ogg, etc.), return as-is
                return NextResponse.json({
                    audioUrl: `data:${mimeType};base64,${inlineData.data}`,
                    source: `Gemini 2.5 Flash TTS (${voice})`
                });
            }

            throw new Error('Gemini TTS did not return audio data');
        });
    } catch (error: any) {
        console.error('Error generating TTS:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
