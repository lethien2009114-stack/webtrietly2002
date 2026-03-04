import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { script, pexelsKey, pixabayKey } = await req.json();

        if (!script || !script.sections) {
            return NextResponse.json({ error: 'Thiếu kịch bản' }, { status: 400 });
        }

        if (!pexelsKey && !pixabayKey) {
            console.warn("No API Keys provided, returning original script.");
        }

        // Process each section to fetch a video
        const sectionsWithVideos = await Promise.all(script.sections.map(async (section: any) => {
            if (!pexelsKey && !pixabayKey) return section;

            // Use the raw short keyword
            const query = section.visual.slice(0, 50).trim();
            const fallbackQuery = "buddhism"; // Ultimate fallback if specific keyword yields 0 results

            let mediaOptions: any[] = [];

            const fetchPexelsVideos = async (searchQuery: string) => {
                if (!pexelsKey) return [];
                try {
                    const response = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(searchQuery)}&orientation=portrait&size=large&per_page=5`, {
                        headers: { Authorization: pexelsKey }
                    });
                    const data = await response.json();
                    return (data.videos || []).map((video: any) => {
                        const hdVideoFile = video.video_files.find((f: any) => f.quality === 'hd') || video.video_files[0];
                        const sdVideoFile = video.video_files.find((f: any) => f.quality === 'sd') || hdVideoFile;
                        return {
                            type: 'video',
                            videoUrl: hdVideoFile?.link,
                            previewUrl: sdVideoFile?.link,
                            imageUrl: video.image,
                            photographer: `Pexels Video: ${video.user.name}`
                        };
                    }).filter((v: any) => v.videoUrl);
                } catch (err) { console.error("Pexels video error:", err); return []; }
            };

            const fetchPexelsImages = async (searchQuery: string) => {
                if (!pexelsKey) return [];
                // Combine query with buddha context for better results
                const buddhaQuery = `${searchQuery} buddha temple meditation`;
                try {
                    const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(buddhaQuery)}&orientation=portrait&per_page=5`, {
                        headers: { Authorization: pexelsKey }
                    });
                    const data = await response.json();
                    return (data.photos || []).map((photo: any) => ({
                        type: 'image',
                        imageUrl: photo.src.large2x || photo.src.large,
                        previewUrl: photo.src.medium,
                        photographer: `Pexels Image: ${photo.photographer}`
                    }));
                } catch (err) { console.error("Pexels image error:", err); return []; }
            };

            const fetchPixabayVideos = async (searchQuery: string) => {
                if (!pixabayKey) return [];
                try {
                    const response = await fetch(`https://pixabay.com/api/videos/?key=${pixabayKey}&q=${encodeURIComponent(searchQuery)}&video_type=film&per_page=5`);
                    const data = await response.json();
                    return (data.hits || []).map((video: any) => {
                        const hdVideoFile = video.videos.large || video.videos.medium;
                        const sdVideoFile = video.videos.tiny || video.videos.small || hdVideoFile;
                        return {
                            type: 'video',
                            videoUrl: hdVideoFile?.url,
                            previewUrl: sdVideoFile?.url,
                            imageUrl: `https://i.vimeocdn.com/video/${video.picture_id}_640x360.jpg`,
                            photographer: `Pixabay Video: ${video.user}`
                        };
                    }).filter((v: any) => v.videoUrl);
                } catch (err) { console.error("Pixabay video error:", err); return []; }
            };

            const fetchPixabayImages = async (searchQuery: string) => {
                if (!pixabayKey) return [];
                const buddhaQuery = `${searchQuery} buddha zen`;
                try {
                    const response = await fetch(`https://pixabay.com/api/?key=${pixabayKey}&q=${encodeURIComponent(buddhaQuery)}&image_type=photo&orientation=vertical&per_page=5`);
                    const data = await response.json();
                    return (data.hits || []).map((photo: any) => ({
                        type: 'image',
                        imageUrl: photo.largeImageURL,
                        previewUrl: photo.webformatURL,
                        photographer: `Pixabay Image: ${photo.user}`
                    }));
                } catch (err) { console.error("Pixabay image error:", err); return []; }
            };

            // Fetch concurrently for exact query
            let [pxVid, pxImg, pbVid, pbImg] = await Promise.all([
                fetchPexelsVideos(query),
                fetchPexelsImages(query),
                fetchPixabayVideos(query),
                fetchPixabayImages(query)
            ]);

            mediaOptions = [...pxVid, ...pbVid, ...pxImg, ...pbImg];

            // 3. Fallback to generic if we got very few results
            if (mediaOptions.length < 2 && query.toLowerCase() !== fallbackQuery) {
                let [fbPxVid, fbPxImg, fbPbVid, fbPbImg] = await Promise.all([
                    fetchPexelsVideos(fallbackQuery),
                    fetchPexelsImages(fallbackQuery),
                    fetchPixabayVideos(fallbackQuery),
                    fetchPixabayImages(fallbackQuery)
                ]);
                mediaOptions = [...mediaOptions, ...fbPxVid, ...fbPbVid, ...fbPxImg, ...fbPbImg];
            }

            // Return section with populated mediaOptions
            return { ...section, mediaOptions };
        }));

        return NextResponse.json({
            script: {
                ...script,
                sections: sectionsWithVideos
            }
        });
    } catch (error: any) {
        console.error('Error fetching videos:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
