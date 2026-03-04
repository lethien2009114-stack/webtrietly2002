import { NextResponse } from 'next/server';
import { withVertexAI, mapToVertexModelName } from '../vertex-utils';
import { withKeyRotation } from '../utils';

export async function POST(req: Request) {
  try {
    const { topic, text, apiKey, model = 'gemini-2.5-pro' } = await req.json();

    if (!topic || !text) {
      return NextResponse.json({ error: 'Thiếu dữ liệu topic hoặc văn bản' }, { status: 400 });
    }

    const prompt = `Bạn là biên kịch video TikTok chuyên nghiệp và một nhà tư vấn tâm lý mang đậm triết lý đạo Phật. Bạn cần viết một kịch bản hoàn chỉnh cho một video dọc (9:16) thời lượng khoảng 60-90 giây (tương đương 140-180 từ khi đọc).
Chủ đề đã được chọn: "${topic.hook}" - ${topic.description}

Dựa trên tài liệu tham khảo sau:
${text}

YÊU CẦU ĐẶC BIỆT QUAN TRỌNG:
1. Lời đọc (audio) phải CỰC KỲ THẤM THÍA, CHỮA LÀNH, VÀ SÂU SẮC. Lời văn cần như một cái ôm an ủi người xem đang mệt mỏi, mang đậm triết lý nhân quả, buông xả, và từ bi của Phật giáo. Tránh thuyết giáo khô khan, hãy dùng ngôn từ nhẹ nhàng, thức tỉnh tâm can, chạm đến trái tim người nghe.
2. Hình ảnh (visual) CHỈ ĐƯỢC LÀ cụm từ khóa cốt lõi bằng TIẾNG ANH (từ 1 đến 4 từ) mô tả vật thể mang ĐẬM CHẤT PHẬT GIÁO. Việc này để API tìm đúng video nhất. KHÔNG dùng câu dài, KHÔNG dùng các từ chung chung.
   VÍ DỤ TỪ KHÓA CHUẨN: "buddha statue", "buddhist temple", "monk meditating", "incense smoke", "lotus flower", "zen garden", "prayer beads", "monk praying", "pagoda timelapse".
3. Kịch bản chia thành 3-5 phân cảnh (sections).
4. Đề xuất một giọng đọc (voiceDescription) bằng TIẾNG ANH để hướng dẫn công cụ AI tạo giọng nói Text-to-Speech (TTS). Mô tả phải chi tiết về giới tính, độ tuổi, âm sắc, tốc độ, cảm xúc. VD: "A calm, deep, and soothing middle-aged male voice, speaking slowly and softly, feeling like a wise monk offering spiritual comfort".

TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON (chỉ trả về JSON hợp lệ):
{
  "title": "Tên tiêu đề video",
  "backgroundMusic": "Gợi ý từ khóa tìm nhạc nền bằng tiếng Anh",
  "voiceDescription": "Mô tả chất giọng bằng TIẾNG ANH một cách thật chi tiết dùng để prompt cho AI TTS...",
  "sections": [
    {
      "audio": "Lời đọc voiceover của đoạn này...",
      "visual": "macro shot of lotus flower blooming"
    }
  ]
}`;

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
        const script = JSON.parse(outputText || '{}');
        return NextResponse.json({ script });
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
      const script = JSON.parse(outputText || '{}');

      return NextResponse.json({ script });
    });
  } catch (error: any) {
    console.error('Error generating script:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
