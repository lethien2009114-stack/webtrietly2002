import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { script, unsplashKey } = await req.json();

        if (!script || !script.sections) {
            return NextResponse.json({ error: 'Missing script data' }, { status: 400 });
        }

        if (!unsplashKey) {
            return NextResponse.json({ error: 'Missing Unsplash API Key' }, { status: 400 });
        }

        const newScript = { ...script };

        // Process all sections (though usually we just send one for specific search)
        for (let i = 0; i < newScript.sections.length; i++) {
            const section = newScript.sections[i];

            // 1. Try to find a search query: either from the 'visual' field or a short snippet of the 'audio'
            let searchQuery = section.visual || section.audio.substring(0, 50);

            // Clean up the query
            searchQuery = searchQuery.replace(/\[Visual:.*?\]/g, '').trim();
            if (searchQuery.length > 50) searchQuery = searchQuery.substring(0, 50);

            try {
                // Fetch photos from Unsplash
                // Unsplash prefers portrait orientation (squarish/portrait fits vertical better)
                const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&orientation=portrait&per_page=6`, {
                    headers: {
                        'Authorization': `Client-ID ${unsplashKey.trim()}`
                    }
                });

                if (unsplashRes.ok) {
                    const data = await unsplashRes.json();

                    if (data.results && data.results.length > 0) {
                        const newOptions = data.results.map((photo: any) => ({
                            type: 'image',
                            imageUrl: photo.urls.regular, // regular size is good for vertical video
                            previewUrl: photo.urls.small,
                            photographer: `Unsplash: ${photo.user.name}`
                        }));

                        // Return only the new options
                        section.mediaOptions = newOptions;

                        // Select the first one by default if none selected
                        if (!section.selectedMediaIndices || section.selectedMediaIndices.length === 0) {
                            section.selectedMediaIndices = [0];
                        }
                    }
                } else {
                    const errData = await unsplashRes.text();
                    console.error("Unsplash error:", errData);
                    throw new Error(`Unsplash API error: ${unsplashRes.status}`);
                }
            } catch (err: any) {
                console.error(`Error searching Unsplash for section ${i}:`, err.message);
                throw new Error("Lỗi tìm kiếm Unsplash: " + err.message);
            }
        }

        return NextResponse.json({ script: newScript });

    } catch (error: any) {
        console.error('Error in fetch-unsplash:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
