import MainAgent from "@/components/MainAgent";

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-screen pb-20 font-[family-name:var(--font-inter)]">
      <header className="w-full text-center py-12 mb-10">
        <h1 className="text-4xl md:text-[3.5rem] leading-tight font-lora font-bold mb-4 text-gradient-gold">
          Tạo triết lý
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed">
          Trợ lý AI phân tích tài liệu Phật pháp, lên ý tưởng kịch bản TikTok và tự động tìm kiếm video minh họa.
        </p>
      </header>

      <main className="w-full max-w-5xl mx-auto">
        <MainAgent />
      </main>
    </div>
  );
}
