import { NextResponse } from 'next/server';
import { withKeyRotation } from '../utils';

export async function POST(req: Request) {
    try {
        const { originalText, userPrompt, apiKey, model = 'gemini-3-flash-preview' } = await req.json();

        if (!originalText || !userPrompt) {
            return NextResponse.json({ error: 'Thiếu văn bản gốc hoặc yêu cầu viết lại' }, { status: 400 });
        }

        if (!apiKey) {
            return NextResponse.json({ error: 'Vui lòng nhập Gemini API Key.' }, { status: 400 });
        }

        const prompt = `Bạn là một nhà biên kịch video TikTok chuyên nghiệp, chuyên về nội dung triết lý Phật giáo, chữa lành và truyền cảm hứng.

Dưới đây là đoạn lời đọc (voiceover) gốc:
---
${originalText}
---

Người dùng yêu cầu viết lại đoạn này với hướng dẫn sau:
"${userPrompt}"

HÃY VIẾT LẠI đoạn lời đọc trên theo đúng yêu cầu của người dùng. Giữ nguyên phong cách thấm thía, chữa lành, sâu sắc của Phật giáo (trừ khi người dùng yêu cầu khác). Độ dài tương đương đoạn gốc.

CHỈ TRẢ VỀ đoạn văn bản viết lại, KHÔNG kèm giải thích hay chú thích gì thêm.`;

        return await withKeyRotation(apiKey, async (ai) => {
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
            });
            const rewrittenText = response.text?.trim();
            if (!rewrittenText) {
                throw new Error('AI không trả về kết quả.');
            }
            return NextResponse.json({ rewrittenText });
        });

    } catch (error: any) {
        console.error('Error rewriting section:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
