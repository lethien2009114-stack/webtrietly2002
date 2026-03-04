import { NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import { withVertexAI } from '../vertex-utils';

export async function POST(req: Request) {
    try {
        const { prompt, type, model, apiKey, pixabayKey } = await req.json();

        if (!prompt || !type || !model || !apiKey) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Only image generation is supported
        if (type !== 'image') {
            return NextResponse.json({ error: 'Only image generation is supported' }, { status: 400 });
        }

        return await withVertexAI(async (vertexAI, projectId) => {
            let mediaOptions: any[] = [];
            let errText = '';

            try {
                const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/${model}:predict`;
                const payload = {
                    instances: [{ prompt: `${prompt} - beautiful composition, high quality, 9:16 aspect ratio` }],
                    parameters: { sampleCount: 4, aspectRatio: "9:16" }
                };

                const auth = new GoogleAuth({
                    scopes: 'https://www.googleapis.com/auth/cloud-platform'
                });
                const client = await auth.getClient();
                const tokenResponse = await client.getAccessToken();
                const token = tokenResponse.token;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.predictions) {
                        mediaOptions = data.predictions.map((p: any, i: number) => {
                            let mediaUrl = p.bytesBase64Encoded ? `data:image/jpeg;base64,${p.bytesBase64Encoded}` : p.uri;
                            return {
                                type: 'image',
                                imageUrl: mediaUrl,
                                previewUrl: mediaUrl,
                                photographer: `Gemini (${model}) #${i + 1}`
                            };
                        }).filter((o: any) => o.imageUrl);
                    }
                } else {
                    errText = await response.text();
                    console.warn("Image gen failed:", errText);
                    throw new Error(`Image model ${model} failed: ${errText}`);
                }
            } catch (err: any) {
                console.warn(`Gemini media failed, type: ${type}`, err.message);
                if (!errText) errText = err.message;
            }

            // Fallback to Pixabay if Gemini didn't return anything
            if (mediaOptions.length === 0 && pixabayKey) {
                const searchQuery = prompt.split("Visual: ")[1]?.slice(0, 50).trim() || prompt.slice(0, 50).trim();

                const pbRes = await fetch(`https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(searchQuery)}&image_type=photo&orientation=vertical&per_page=4`);
                if (pbRes.ok) {
                    const pbData = await pbRes.json();
                    mediaOptions = (pbData.hits || []).map((photo: any) => ({
                        type: 'image',
                        imageUrl: photo.largeImageURL,
                        previewUrl: photo.webformatURL,
                        photographer: `Pixabay Image Fallback`
                    }));
                }
            }

            if (mediaOptions.length > 0) {
                return NextResponse.json({ mediaOptions });
            }

            throw new Error(`Image generation failed: ` + errText);
        });
    } catch (error: any) {
        console.error('Error generating Gemini media:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
