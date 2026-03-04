import { VertexAI } from '@google-cloud/vertexai';

export function mapToVertexModelName(modelName: string): string {
    switch (modelName) {
        case 'gemini-3.1-pro': return 'gemini-experimental'; // 3.1 Pro currently sits in experimental ring
        case 'gemini-3.0-pro': return 'gemini-3.0-pro-exp'; // 3.0 Pro has its own exp tag
        case 'gemini-3.0-flash': return 'gemini-3.0-flash-exp'; // 3.0 Flash uses exp tag
        case 'gemini-2.5-pro': return 'gemini-2.5-pro'; // Standard naming
        case 'gemini-2.5-flash': return 'gemini-2.5-flash'; // Standard naming
        default: return modelName;
    }
}

export async function withVertexAI<T>(
    operation: (vertexAI: VertexAI, projectId: string, location: string) => Promise<T>
): Promise<T> {
    const projectId = process.env.GCP_PROJECT_ID;
    const location = 'us-central1';

    if (!projectId) {
        throw new Error('GCP_PROJECT_ID is not set in environment variables');
    }

    // Google Cloud automatically looks for GOOGLE_APPLICATION_CREDENTIALS environment variable
    try {
        const vertexAI = new VertexAI({ project: projectId, location: location });
        return await operation(vertexAI, projectId, location);
    } catch (error: any) {
        console.error("Vertex AI Initialization or Operation Error:", error.message);
        throw error;
    }
}
