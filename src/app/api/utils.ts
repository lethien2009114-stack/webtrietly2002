import { GoogleGenAI } from '@google/genai';

export async function withKeyRotation<T>(
    apiKeysString: string,
    operation: (ai: GoogleGenAI, apiKey: string) => Promise<T>
): Promise<T> {
    if (!apiKeysString) {
        throw new Error('API key must be set');
    }

    const keys = apiKeysString.split(',').map((k) => k.trim()).filter(Boolean);
    if (keys.length === 0) {
        throw new Error('No valid API keys found');
    }

    let lastError: any = null;

    for (const key of keys) {
        try {
            const ai = new GoogleGenAI({ apiKey: key });
            return await operation(ai, key);
        } catch (error: any) {
            console.warn(`Error with key ${key.substring(0, 8)}...:`, error.message);
            lastError = error;
            
            // Check if it's a rate limit or quota error (429 usually)
            // If it's a 400 Bad Request, we probably shouldn't retry with another key
            // unless the key is just invalid. For safety, we'll retry on any error since
            // "rotation" is requested.
            continue;
        }
    }

    throw lastError || new Error('All API keys failed');
}
