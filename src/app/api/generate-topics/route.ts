import { NextResponse } from 'next/server';
import { withVertexAI, mapToVertexModelName } from '../vertex-utils';
import { withKeyRotation } from '../utils';

export async function POST(req: Request) {
    try {
        const { text, apiKey, model = 'gemini-2.5-pro' } = await req.json();

        if (!text) {
            return NextResponse.json({ error: 'Vui lòng cung cấp nội dung tài liệu' }, { status: 400 });
        }

        if (!apiKey) {
            return NextResponse.json({ error: 'API key must be set' }, { status: 400 });
        }

        const prompt = `Bạn là một chuyên gia sáng tạo nội dung TikTok chuyên về mảng Phật pháp và Tâm linh. 
Dựa vào tài liệu dưới đây, hãy trích xuất và đề xuất 4 chủ đề (topic) có khả năng thu hút người xem cao nhất trên TikTok.
Mỗi chủ đề cần có một câu "hook" (câu mở đầu video) cực kỳ cuốn hút, đánh trúng tâm lý người xem trong 3 giây đầu tiên, và một đoạn mô tả ngắn về hướng đi của video. Tựa như các kênh chữa lành tâm hồn, tư vấn triết lý sống.

Tài liệu:
${text}

TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON MẢNG KẾT QUẢ SAU ĐÂY (chỉ trả về JSON hợp lệ):
[
  {
    "id": "topic-1",
    "hook": "Câu hook cực chất...",
    "description": "Mô tả ngắn về ý tưởng video, bài học nhân quả..."
  }
]`;

        if (model.startsWith('gemini-3')) {
            if (!apiKey) {
                return NextResponse.json({ error: 'Mô hình Gemini 3.x yêu cầu nhập Gemini API Key từ Google AI Studio trên giao diện vì tài khoản Google Cloud của bạn chưa được cấp phép Early Access.' }, { status: 400 });
            }
            return await withKeyRotation(apiKey, async (ai) => {
                const response = await ai.models.generateContent({
                    model: model,
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                    }
                });
                const outputText = response.text;
                const topics = JSON.parse(outputText || '[]');
                return NextResponse.json({ topics });
            });
        }

        return await withVertexAI(async (vertexAI) => {
            const generativeModel = vertexAI.getGenerativeModel({
                model: mapToVertexModelName(model),
                generationConfig: {
                    responseMimeType: "application/json",
                }
            });

            const response = await generativeModel.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            });

            const outputText = response.response.candidates?.[0]?.content?.parts?.[0]?.text;
            const topics = JSON.parse(outputText || '[]');
            return NextResponse.json({ topics });
        });

    } catch (error: any) {
        console.error('Error generating topics:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
