"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, FileText, Sparkles, Video, Clapperboard, CheckCircle2, KeyRound, Music, Play, Download, Copy, DollarSign, Search, Mic, Star, Edit2, Wand2, X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Topic = {
    id: string;
    hook: string;
    description: string;
};

export type MediaOption = {
    type: 'video' | 'image';
    videoUrl?: string;
    previewUrl?: string;
    imageUrl: string;
    photographer?: string;
};

type ScriptSection = {
    audio: string;
    visual: string;
    mediaOptions?: MediaOption[];
    selectedMediaIndices?: number[];
};

type Script = {
    title: string;
    backgroundMusic?: string;
    voiceDescription?: string;
    sections: ScriptSection[];
};

type AppStatus = "idle" | "generating_topics" | "topics_ready" | "generating_script" | "script_ready" | "finding_videos" | "complete" | "generating_video" | "video_ready";

export default function MainAgent() {
    const [documentText, setDocumentText] = useState("");
    const [geminiKey, setGeminiKey] = useState("");
    const [pexelsKey, setPexelsKey] = useState("");
    const [pixabayKey, setPixabayKey] = useState("");
    const [unsplashKey, setUnsplashKey] = useState("");
    const [status, setStatus] = useState<AppStatus>("idle");
    const [topics, setTopics] = useState<Topic[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
    const [aiModel] = useState("gemini-3-flash-preview");
    const [script, setScript] = useState<Script | null>(null);
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [imageModel] = useState("gemini-banana-3-flash");
    const [generatingMedia, setGeneratingMedia] = useState<Record<string, boolean>>({});
    const [tempVoiceDesc, setTempVoiceDesc] = useState("");
    const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
    const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
    const [ttsApproved, setTtsApproved] = useState(false);
    const [totalCost, setTotalCost] = useState(0);
    const [selectedVoice, setSelectedVoice] = useState("Aoede");
    const [isVoiceDropdownOpen, setIsVoiceDropdownOpen] = useState(false);
    const [ttsSpeed, setTtsSpeed] = useState(1.0);
    const [favoriteVoices, setFavoriteVoices] = useState<string[]>([]);
    const [voiceNotes, setVoiceNotes] = useState<Record<string, string>>({});
    const previewAudioRef = useRef<HTMLAudioElement>(null);
    const fullAudioRef = useRef<HTMLAudioElement>(null);

    const [searchingPexels, setSearchingPexels] = useState<Record<number, boolean>>({});
    const [searchingUnsplash, setSearchingUnsplash] = useState<Record<number, boolean>>({});
    const [fullAudioUrl, setFullAudioUrl] = useState<string | null>(null);

    // AI Rewrite state
    const [rewriteOpenIdx, setRewriteOpenIdx] = useState<number | null>(null);
    const [rewritePrompt, setRewritePrompt] = useState("");
    const [rewritingIdx, setRewritingIdx] = useState<number | null>(null);

    // Full list of 30 Gemini 2.5 TTS Voices
    const TTS_VOICES = [
        { name: "Aoede", desc: "Nữ trầm ấm, chuyên nghiệp" },
        { name: "Charon", desc: "Nam trầm thấp, bí ẩn" },
        { name: "Fenrir", desc: "Nam mạnh mẽ, sâu lắng" },
        { name: "Kore", desc: "Nữ nhẹ nhàng, trong trẻo" },
        { name: "Puck", desc: "Nam năng động, vui vẻ" },
        { name: "Achernar", desc: "Nam giới, giọng chuẩn" },
        { name: "Achird", desc: "Nữ giới, thanh lịch" },
        { name: "Algenib", desc: "Nam giới, dứt khoát" },
        { name: "Algieba", desc: "Nữ giới, điềm tĩnh" },
        { name: "Alnilam", desc: "Nam giới, chậm rãi" },
        { name: "Autonoe", desc: "Nữ giới, sôi nổi" },
        { name: "Callirrhoe", desc: "Nữ giới, ấm áp" },
        { name: "Despina", desc: "Nữ giới, dõng dạc" },
        { name: "Enceladus", desc: "Nam giới, vang dội" },
        { name: "Erinome", desc: "Nữ giới, truyền cảm" },
        { name: "Gacrux", desc: "Nam giới, điềm đạm" },
        { name: "Iapetus", desc: "Nam giới, mạnh mẽ" },
        { name: "Laomedeia", desc: "Nữ giới, trong sáng" },
        { name: "Leda", desc: "Nữ giới, linh hoạt" },
        { name: "Orus", desc: "Nam giới, nghiêm trang" },
        { name: "Pulcherrima", desc: "Nữ giới, uyển chuyển" },
        { name: "Rasalgethi", desc: "Nam giới, vững vàng" },
        { name: "Sadachbia", desc: "Nam giới, trưởng thành" },
        { name: "Sadaltager", desc: "Nam giới, tự tin" },
        { name: "Schedar", desc: "Nữ giới, tự nhiên" },
        { name: "Sulafat", desc: "Nam giới, nhẹ nhàng" },
        { name: "Umbriel", desc: "Nam giới, êm dịu" },
        { name: "Vindemiatrix", desc: "Nữ giới, sắc sảo" },
        { name: "Zephyr", desc: "Nam giới, bay bổng" },
        { name: "Zubenelgenubi", desc: "Nam giới, rõ ràng" },
    ];

    const estimateCost = (action: string, model?: string): number => {
        const m = model || aiModel;
        switch (action) {
            case 'topics':
                if (m.includes('3.1-pro')) return 0.01;
                if (m.includes('3-flash')) return 0.002;
                if (m.includes('3-pro')) return 0.008;
                if (m.includes('2.5-pro')) return 0.008;
                if (m.includes('2.5-flash')) return 0.001;
                return 0.005;
            case 'script':
                if (m.includes('3.1-pro')) return 0.02;
                if (m.includes('3-flash')) return 0.005;
                if (m.includes('3-pro')) return 0.015;
                if (m.includes('2.5-pro')) return 0.015;
                if (m.includes('2.5-flash')) return 0.003;
                return 0.01;
            case 'image':
                return 0.02; // Banana 3 Flash
            case 'tts_preview':
                return 0.01;
            case 'tts_full':
                return 0.03;
            case 'pexels':
                return 0;
            default:
                return 0;
        }
    };

    const formatCost = (cost: number) => cost < 0.01 ? `~$${cost.toFixed(4)}` : `~$${cost.toFixed(2)}`;

    // Initialize state from local storage on mount
    useEffect(() => {
        const storedGemini = localStorage.getItem("geminiKey") || "";
        const storedPexels = localStorage.getItem("pexelsKey") || "";
        const storedPixabay = localStorage.getItem("pixabayKey") || "";
        const storedUnsplash = localStorage.getItem("unsplashKey") || "";
        const savedFavs = localStorage.getItem("favoriteVoices");
        const savedNotes = localStorage.getItem("voiceNotes");

        if (storedGemini) setGeminiKey(storedGemini);
        if (storedPexels) setPexelsKey(storedPexels);
        if (storedPixabay) setPixabayKey(storedPixabay);
        if (storedUnsplash) setUnsplashKey(storedUnsplash);

        if (savedFavs) {
            try { setFavoriteVoices(JSON.parse(savedFavs)) } catch (e) { }
        }
        if (savedNotes) {
            try { setVoiceNotes(JSON.parse(savedNotes)) } catch (e) { }
        }
    }, []);

    const toggleFavoriteVoice = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setFavoriteVoices(prev => {
            const next = prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name];
            localStorage.setItem("favoriteVoices", JSON.stringify(next));
            return next;
        });
    };

    const saveVoiceNote = (name: string, note: string) => {
        setVoiceNotes(prev => {
            const next = { ...prev, [name]: note };
            localStorage.setItem("voiceNotes", JSON.stringify(next));
            return next;
        });
    };

    // Save keys to local storage whenever they change
    const updateGeminiKey = (key: string) => {
        setGeminiKey(key);
        localStorage.setItem("geminiKey", key);
    };

    const updatePexelsKey = (key: string) => {
        setPexelsKey(key);
        localStorage.setItem("pexelsKey", key);
    };

    const updatePixabayKey = (key: string) => {
        setPixabayKey(key);
        localStorage.setItem("pixabayKey", key);
    };

    const updateUnsplashKey = (key: string) => {
        setUnsplashKey(key);
        localStorage.setItem("unsplashKey", key);
    };

    const handleGenerateTopics = async () => {
        if (!documentText.trim()) return;
        if (!geminiKey.trim()) {
            alert("Vui lòng nhập Gemini API Key để tiếp tục.");
            return;
        }
        setStatus("generating_topics");
        const cost = estimateCost('topics');

        try {
            const res = await fetch("/api/generate-topics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: documentText, apiKey: geminiKey, model: aiModel })
            });

            if (!res.ok) {
                const text = await res.text();
                let errorMsg = text;
                try {
                    const errorJson = JSON.parse(text);
                    if (errorJson.error) errorMsg = errorJson.error;
                } catch (e) { }
                throw new Error("Lỗi Server: " + errorMsg);
            }

            const data = await res.json();
            if (data.topics) {
                setTopics(data.topics);
                setTotalCost(prev => prev + cost);
                setStatus("topics_ready");
            } else {
                throw new Error(data.error || "Lỗi tạo chủ đề");
            }
        } catch (err: any) {
            console.error(err);
            setStatus("idle");
            alert("Có lỗi xảy ra: " + err.message);
        }
    };

    const handleGenerateScript = async (topicId: string) => {
        setSelectedTopic(topicId);
        setStatus("generating_script");
        const cost = estimateCost('script');

        try {
            const topic = topics.find(t => t.id === topicId);
            const res = await fetch("/api/generate-script", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic, text: documentText, apiKey: geminiKey, model: aiModel })
            });

            if (!res.ok) {
                const text = await res.text();
                let errorMsg = text;
                try {
                    const errorJson = JSON.parse(text);
                    if (errorJson.error) errorMsg = errorJson.error;
                } catch (e) { }
                throw new Error("Lỗi Server: " + errorMsg);
            }

            const data = await res.json();
            if (data.script) {
                setTotalCost(prev => prev + cost);
                setScript(data.script);
                if (data.script.voiceDescription) {
                    setTempVoiceDesc(data.script.voiceDescription);
                    setTtsApproved(false);
                    setPreviewAudioUrl(null);
                }
                setStatus("script_ready");
            } else {
                throw new Error(data.error || "Lỗi tạo kịch bản");
            }
        } catch (err) {
            console.error(err);
            setStatus("topics_ready");
            alert("Có lỗi xảy ra: " + (err as Error).message);
        }
    };

    const handleFindVideos = async () => {
        if (!script) return;
        setStatus("finding_videos");

        try {
            const res = await fetch("/api/fetch-videos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ script, pexelsKey, pixabayKey })
            });
            const data = await res.json();
            if (data.script) {
                setScript(data.script);
                setStatus("complete");
            } else {
                throw new Error(data.error || "Lỗi tìm video");
            }
        } catch (err) {
            console.error(err);
            setStatus("script_ready");
            alert("Có lỗi xảy ra: " + (err as Error).message);
        }
    };

    const handleGenerateGeminiMedia = async (idx: number, type: 'video' | 'image') => {
        if (!script) return;
        if (!geminiKey.trim()) {
            alert("Vui lòng nhập Gemini API Key (hoặc danh sách keys).");
            return;
        }

        const key = `${idx}-${type}`;
        setGeneratingMedia(prev => ({ ...prev, [key]: true }));

        try {
            const section = script.sections[idx];
            // For AI-generated media, use the voiceover text (audio column) as the creative prompt
            const prompt = `Topic: ${script.title}. Voiceover: ${section.audio}`;
            const res = await fetch("/api/generate-gemini-media", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, type, model: imageModel, apiKey: geminiKey, pixabayKey })
            });

            if (!res.ok) {
                const text = await res.text();
                let errorMsg = text;
                try {
                    const errorJson = JSON.parse(text);
                    if (errorJson.error) errorMsg = errorJson.error;
                } catch (e) { }
                throw new Error("Lỗi Server: " + errorMsg);
            }

            const data = await res.json();

            if (data.mediaOptions && data.mediaOptions.length > 0) {
                const newScript = { ...script };
                newScript.sections[idx].mediaOptions = [
                    ...data.mediaOptions,
                    ...(newScript.sections[idx].mediaOptions || [])
                ];
                newScript.sections[idx].selectedMediaIndices = [0];
                setScript(newScript);
            } else {
                throw new Error(data.error || "Lỗi tạo media mảng rỗng");
            }
        } catch (err: any) {
            console.error(err);
            alert(`Có lỗi xảy ra khi tạo ${type}: ` + err.message);
        } finally {
            setGeneratingMedia(prev => ({ ...prev, [key]: false }));
        }
    };

    const handlePreviewTTS = async () => {
        if (!script) return;
        setIsGeneratingTTS(true);
        try {
            const textToRead = script.sections.map(s => s.audio).join(". ").slice(0, 100) + "..."; // Read a preview sample
            const cost = estimateCost('tts_preview');
            const res = await fetch("/api/generate-tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: textToRead, voiceDescription: tempVoiceDesc, apiKey: geminiKey, voice: selectedVoice })
            });
            const data = await res.json();
            if (data.audioUrl) {
                setTotalCost(prev => prev + cost);
                setPreviewAudioUrl(data.audioUrl);
            } else {
                throw new Error(data.error || "Lỗi tạo TTS");
            }
        } catch (err) {
            console.error(err);
            alert("Có lỗi xảy ra: " + (err as Error).message);
        } finally {
            setIsGeneratingTTS(false);
        }
    };

    const handleGenerateFullTTS = async () => {
        if (!script) return;
        setIsGeneratingTTS(true);
        try {
            const fullTextToRead = script.sections.map(s => s.audio).join(". ");
            const cost = estimateCost('tts_full');
            const res = await fetch("/api/generate-tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: fullTextToRead, voiceDescription: tempVoiceDesc, apiKey: geminiKey, voice: selectedVoice })
            });
            const data = await res.json();
            if (data.audioUrl) {
                setTotalCost(prev => prev + cost);
                // Store full audio URL for playback
                setFullAudioUrl(data.audioUrl);
                // Convert base64 data URL to a File object
                const response = await fetch(data.audioUrl);
                const blob = await response.blob();
                const file = new File([blob], "Gemini_AI_Voice_Full.mp3", { type: "audio/mp3" });
                setAudioFile(file);
                setTtsApproved(true);
            } else {
                throw new Error(data.error || "Lỗi tạo giọng đọc đầy đủ");
            }
        } catch (err) {
            console.error(err);
            alert("Có lỗi xảy ra: " + (err as Error).message);
        } finally {
            setIsGeneratingTTS(false);
        }
    };

    const handleGenerateVideo = async () => {
        if (!script || !audioFile) return;
        setStatus("generating_video");

        try {
            const formData = new FormData();
            formData.append("audio", audioFile);

            // Extract selected media
            const selectedMediaList = script.sections
                .flatMap(s => {
                    const indices = s.selectedMediaIndices || [0];
                    return s.mediaOptions && s.mediaOptions.length > 0 ? indices.map(idx => s.mediaOptions![idx]) : [];
                })
                .filter(m => m !== null && m !== undefined);

            formData.append("mediaItems", JSON.stringify(selectedMediaList));

            // Extract audio script text
            const scriptTexts = script.sections.map(s => s.audio);
            formData.append("scriptTexts", JSON.stringify(scriptTexts));

            const res = await fetch("/api/generate-video", {
                method: "POST",
                body: formData,
                // Don't set Content-Type header, let browser set it with boundary for FormData
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Lỗi tạo video");
            }

            // The response will be the video file itself
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setFinalVideoUrl(url);
            setStatus("video_ready");

        } catch (err) {
            console.error(err);
            setStatus("complete");
            alert("Có lỗi xảy ra trong quá trình lồng ghép video: " + (err as Error).message);
        }
    };

    const handleGenerateSyncVideo = async () => {
        if (!script) return;
        setStatus("generating_video");

        try {
            const selectedMediaList = script.sections
                .flatMap(s => {
                    const indices = s.selectedMediaIndices || [0];
                    return s.mediaOptions && s.mediaOptions.length > 0 ? indices.map(idx => s.mediaOptions![idx]) : [];
                })
                .filter(m => m !== null && m !== undefined);

            const scriptTexts = script.sections.map(s => s.audio);

            const res = await fetch("/api/generate-sync-video", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scriptTexts,
                    mediaItems: selectedMediaList,
                    voice: selectedVoice,
                    voiceDescription: tempVoiceDesc,
                    apiKey: geminiKey
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Lỗi tạo video đồng bộ");
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setFinalVideoUrl(url);
            setStatus("video_ready");

        } catch (err) {
            console.error(err);
            setStatus("complete");
            alert("Có lỗi xảy ra: " + (err as Error).message);
        }
    };

    const handleRewriteSection = async (idx: number) => {
        if (!script || !rewritePrompt.trim() || !geminiKey.trim()) return;
        setRewritingIdx(idx);
        try {
            const res = await fetch('/api/rewrite-section', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    originalText: script.sections[idx].audio,
                    userPrompt: rewritePrompt,
                    apiKey: geminiKey,
                    model: aiModel,
                }),
            });
            const data = await res.json();
            if (data.rewrittenText) {
                const newScript = { ...script };
                newScript.sections[idx].audio = data.rewrittenText;
                setScript(newScript);
                setTtsApproved(false);
                setPreviewAudioUrl(null);
                setFullAudioUrl(null);
                setRewriteOpenIdx(null);
                setRewritePrompt("");
                const cost = estimateCost('script');
                setTotalCost(prev => prev + cost);
            } else {
                throw new Error(data.error || 'AI không trả về kết quả');
            }
        } catch (err: any) {
            console.error(err);
            alert('Lỗi viết lại: ' + err.message);
        } finally {
            setRewritingIdx(null);
        }
    };

    return (
        <div className="space-y-8 relative">
            {/* 0. API Keys Setup */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-6 md:p-8 rounded-2xl relative z-10"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-500">
                        <KeyRound className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-lora font-semibold">0. Khóa API (API Keys)</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400 font-medium">Gemini Key (Nhiều key cách bằng dấu phẩy)</label>
                        <input
                            type="password"
                            value={geminiKey}
                            onChange={(e) => updateGeminiKey(e.target.value)}
                            placeholder="AIzaSy...,AIzaSy..."
                            className="w-full bg-obsidian-900 border border-gray-800 rounded-xl p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400 font-medium">Pexels Key (Tùy chọn)</label>
                        <input
                            type="password"
                            value={pexelsKey}
                            onChange={(e) => updatePexelsKey(e.target.value)}
                            placeholder="563492..."
                            className="w-full bg-obsidian-900 border border-gray-800 rounded-xl p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400 font-medium">Pixabay Key (Tùy chọn)</label>
                        <input
                            type="password"
                            value={pixabayKey}
                            onChange={(e) => updatePixabayKey(e.target.value)}
                            placeholder="423156-..."
                            className="w-full bg-obsidian-900 border border-gray-800 rounded-xl p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm text-gray-400 font-medium">Unsplash Key (Tùy chọn)</label>
                        <input
                            type="password"
                            value={unsplashKey}
                            onChange={(e) => updateUnsplashKey(e.target.value)}
                            placeholder="Ns3BtJ35CTm..."
                            className="w-full bg-obsidian-900 border border-gray-800 rounded-xl p-3 text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono text-sm"
                        />
                    </div>
                </div>
            </motion.section>

            {/* 1. Document Input */}
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-panel p-6 md:p-8 rounded-2xl relative z-10"
            >
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 rounded-full bg-saffron-500/10 text-saffron-500">
                        <FileText className="w-6 h-6" />
                    </div>
                    <h2 className="text-2xl font-lora font-semibold">1. Nguồn Tài Liệu & Cấu Hình AI</h2>
                </div>
                <div className="mb-4 flex items-center gap-3">
                    <span className="text-sm text-gray-400 font-medium">Mô hình AI:</span>
                    <span className="px-3 py-1.5 bg-obsidian-900 border border-saffron-500/30 rounded-lg text-saffron-400 font-mono text-sm">Gemini 3 Flash</span>
                    <span className="text-xs text-gray-500">• Ảnh: Banana 3 Flash</span>
                </div>

                <textarea
                    value={documentText}
                    onChange={(e) => setDocumentText(e.target.value)}
                    placeholder="Dán nội dung tài liệu Phật pháp, kinh văn, hoặc bài giảng vào đây..."
                    className="w-full h-48 bg-obsidian-900 border border-gray-800 rounded-xl p-4 text-gray-200 focus:outline-none focus:ring-2 focus:ring-saffron-500/50 resize-y transition-all"
                />
                <div className="mt-4 flex justify-end">
                    <button
                        onClick={handleGenerateTopics}
                        disabled={!documentText.trim() || status === "generating_topics"}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-saffron-600 to-saffron-500 text-white font-medium hover:from-saffron-500 hover:to-saffron-400 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                        {status === "generating_topics" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        Tạo Chủ Đề & Hook
                        <span className="ml-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono">{formatCost(estimateCost('topics'))}</span>
                    </button>
                </div>
            </motion.section>

            {/* 2. Topics List */}
            <AnimatePresence>
                {status !== "idle" && status !== "generating_topics" && topics.length > 0 && (
                    <motion.section
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="glass-panel p-6 md:p-8 rounded-2xl relative z-10 overflow-hidden"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-full bg-lotus-500/10 text-lotus-500">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-lora font-semibold">2. Chọn Chủ Đề</h2>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            {topics.map((topic) => (
                                <button
                                    key={topic.id}
                                    onClick={() => handleGenerateScript(topic.id)}
                                    disabled={status === "generating_script" || (status !== "topics_ready" && selectedTopic !== topic.id)}
                                    className={`text-left p-5 rounded-xl border transition-all ${selectedTopic === topic.id
                                        ? 'border-saffron-500 bg-saffron-500/5 ring-1 ring-saffron-500/50'
                                        : 'border-gray-800 bg-obsidian-900 hover:border-gray-700 hover:bg-obsidian-800'
                                        } group`}
                                >
                                    <h3 className="text-lg font-semibold text-saffron-400 mb-2 leading-tight group-hover:text-saffron-300 transition-colors">
                                        &quot;{topic.hook}&quot;
                                    </h3>
                                    <p className="text-gray-400 text-sm line-clamp-3">
                                        {topic.description}
                                    </p>

                                    {selectedTopic === topic.id && status === "generating_script" && (
                                        <div className="mt-4 flex items-center gap-2 text-saffron-500 text-sm">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Đang viết kịch bản...
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>

            {/* 3. Script & Videos */}
            <AnimatePresence>
                {(status === "script_ready" || status === "finding_videos" || status === "complete" || status === "generating_video" || status === "video_ready") && script && (
                    <motion.section
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="glass-panel p-6 md:p-8 rounded-2xl relative z-10 overflow-hidden"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-full bg-blue-500/10 text-blue-500">
                                    <Clapperboard className="w-6 h-6" />
                                </div>
                                <h2 className="text-2xl font-lora font-semibold">3. Kịch Bản Chi Tiết</h2>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        const text = script.sections.map((s, idx) => `Dòng ${idx + 1}: ${s.audio}`).join("\n\n");
                                        navigator.clipboard.writeText(text);
                                        alert("Đã sao chép kịch bản thành công!");
                                    }}
                                    className="px-5 py-2.5 rounded-xl bg-obsidian-800 border border-gray-700 text-white hover:bg-obsidian-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    title="Copy kịch bản (có đánh số dòng)"
                                >
                                    <Copy className="w-4 h-4 text-emerald-400" />
                                    Copy Kịch Bản
                                </button>

                                <button
                                    onClick={handleFindVideos}
                                    disabled={status === "finding_videos" || status === "complete"}
                                    className="px-5 py-2.5 rounded-xl bg-obsidian-800 border border-gray-700 text-white hover:bg-obsidian-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                                >
                                    {status === "finding_videos" ? <Loader2 className="w-4 h-4 animate-spin" /> : status === "complete" ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Video className="w-4 h-4 text-saffron-400" />}
                                    {status === "complete" ? "Đã Tìm Video" : "Tìm Video Minh Họa"}
                                </button>
                            </div>
                        </div>

                        <h3 className="text-xl font-bold mb-6 text-center text-white">{script.title}</h3>

                        {/* TTS Voice Generation Section */}
                        {script.voiceDescription !== undefined && (
                            <div className="bg-purple-900/10 border border-purple-500/20 rounded-xl p-6 mb-6">
                                <div className="flex items-start gap-4 flex-col md:flex-row">
                                    <div className="p-3 rounded-full bg-purple-500/10 text-purple-400 shrink-0">
                                        <Sparkles className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 w-full space-y-4">
                                        <div>
                                            <h4 className="text-lg font-semibold text-purple-100 mb-1">Cấu hình Giọng Đọc (Gemini 2.5 Pro Preview TTS)</h4>
                                            <p className="text-sm text-purple-300">AI đã đề xuất mô tả cho giọng đọc. Chọn giọng, sửa đổi mô tả và nghe thử.</p>
                                        </div>

                                        <div className="flex items-center gap-4 flex-wrap">
                                            <div className="flex items-center gap-2 relative">
                                                <Mic className="w-4 h-4 text-purple-400" />
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsVoiceDropdownOpen(!isVoiceDropdownOpen)}
                                                        className="bg-obsidian-950 border border-purple-900/50 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 flex flex-col justify-start text-left w-64 items-start"
                                                    >
                                                        <span className="font-semibold">{selectedVoice}</span>
                                                        <span className="text-xs text-gray-400 truncate w-full">{TTS_VOICES.find(v => v.name === selectedVoice)?.desc}</span>
                                                    </button>

                                                    {isVoiceDropdownOpen && (
                                                        <div className="absolute z-50 top-full left-0 mt-1 h-64 overflow-y-auto w-80 bg-obsidian-950 border border-purple-900/50 rounded-lg shadow-2xl">
                                                            {[...TTS_VOICES].sort((a, b) => {
                                                                const aFav = favoriteVoices.includes(a.name);
                                                                const bFav = favoriteVoices.includes(b.name);
                                                                if (aFav && !bFav) return -1;
                                                                if (!aFav && bFav) return 1;
                                                                return a.name.localeCompare(b.name);
                                                            }).map((v) => (
                                                                <div
                                                                    key={v.name}
                                                                    className="px-3 py-2 hover:bg-purple-900/50 cursor-pointer flex flex-col items-start border-b border-gray-800 last:border-0 transition-colors"
                                                                    onClick={() => {
                                                                        setSelectedVoice(v.name);
                                                                        setIsVoiceDropdownOpen(false);
                                                                        const synth = window.speechSynthesis;
                                                                        synth.cancel();
                                                                    }}
                                                                    onMouseEnter={() => {
                                                                        if ((window as any).hoverPreviewAudio) {
                                                                            (window as any).hoverPreviewAudio.pause();
                                                                        }

                                                                        const playPreview = (url: string) => {
                                                                            const audio = new Audio(url);
                                                                            audio.playbackRate = ttsSpeed;
                                                                            audio.play().catch(e => console.log("Hover preview blocked:", e));
                                                                            (window as any).hoverPreviewAudio = audio;
                                                                        };

                                                                        const staticUrl = `/voice-samples/${v.name}.wav`;

                                                                        fetch(staticUrl, { method: 'HEAD' })
                                                                            .then(res => {
                                                                                if (res.ok) {
                                                                                    playPreview(staticUrl);
                                                                                } else {
                                                                                    if (!geminiKey) return;
                                                                                    fetch('/api/tts-preview', {
                                                                                        method: 'POST',
                                                                                        headers: { 'Content-Type': 'application/json' },
                                                                                        body: JSON.stringify({ voice: v.name, voiceDescription: v.desc, apiKey: geminiKey })
                                                                                    })
                                                                                        .then(r => r.json())
                                                                                        .then(data => {
                                                                                            if (data.audioUrl) playPreview(data.audioUrl);
                                                                                        })
                                                                                        .catch(e => console.error("TTS Preview Cache Error:", e));
                                                                                }
                                                                            });
                                                                    }}
                                                                >
                                                                    <div className="flex items-center justify-between w-full">
                                                                        <span className="text-sm font-medium text-gray-200 flex items-center gap-2">
                                                                            {v.name}
                                                                            {favoriteVoices.includes(v.name) && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                                                                        </span>
                                                                        <div className="flex items-center gap-2">
                                                                            <button
                                                                                onClick={(e) => toggleFavoriteVoice(v.name, e)}
                                                                                className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-yellow-400"
                                                                                title="Yêu thích giọng này"
                                                                            >
                                                                                <Star className={`w-3.5 h-3.5 ${favoriteVoices.includes(v.name) ? 'text-yellow-400 fill-yellow-400' : ''}`} />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const note = window.prompt("Nhập ghi chú cá nhân cho giọng " + v.name + ":", voiceNotes[v.name] || "");
                                                                                    if (note !== null) {
                                                                                        saveVoiceNote(v.name, note);
                                                                                    }
                                                                                }}
                                                                                className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-purple-400"
                                                                                title="Thêm ghi chú cá nhân"
                                                                            >
                                                                                <Edit2 className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-xs text-purple-300">
                                                                        {v.desc}
                                                                        {voiceNotes[v.name] && <span className="ml-1 text-gray-400 italic">({voiceNotes[v.name]})</span>}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 bg-obsidian-950 px-3 py-2 rounded-lg border border-purple-900/50">
                                                <label className="text-xs font-medium text-purple-300 w-16">Tốc độ: {ttsSpeed}x</label>
                                                <input
                                                    type="range"
                                                    min="0.5"
                                                    max="1.5"
                                                    step="0.1"
                                                    value={ttsSpeed}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        setTtsSpeed(val);
                                                        if (previewAudioRef.current) previewAudioRef.current.playbackRate = val;
                                                        if (fullAudioRef.current) fullAudioRef.current.playbackRate = val;
                                                    }}
                                                    className="w-24 accent-purple-500"
                                                />
                                            </div>
                                        </div>

                                        <textarea
                                            value={tempVoiceDesc}
                                            onChange={(e) => setTempVoiceDesc(e.target.value)}
                                            className="w-full h-24 bg-obsidian-950 border border-purple-900/50 rounded-xl p-3 text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y"
                                            placeholder="Prompt mô tả chất giọng tiếng Anh..."
                                        />

                                        <div className="flex flex-wrap items-center gap-3">
                                            <button
                                                onClick={handlePreviewTTS}
                                                disabled={isGeneratingTTS}
                                                className="px-4 py-2 bg-obsidian-800 hover:bg-obsidian-700 text-purple-400 border border-purple-900/50 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                                            >
                                                {isGeneratingTTS ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                                {isGeneratingTTS ? "Đang tạo đoạn mẫu..." : "Nghe thử"}
                                                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-[9px] font-mono">{formatCost(estimateCost('tts_preview'))}</span>
                                            </button>

                                            {previewAudioUrl && (
                                                <div className="flex items-center gap-3 flex-1 min-w-[200px] flex-wrap">
                                                    <audio
                                                        ref={previewAudioRef}
                                                        src={previewAudioUrl}
                                                        controls
                                                        className="h-10 w-full max-w-[250px]"
                                                        onLoadedData={(e) => { e.currentTarget.playbackRate = ttsSpeed; }}
                                                    />

                                                    <button
                                                        onClick={handleGenerateFullTTS}
                                                        disabled={isGeneratingTTS}
                                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 justify-center ${ttsApproved ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg'}`}
                                                    >
                                                        {isGeneratingTTS ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                        {isGeneratingTTS ? "Đang xử lý toàn bộ bài..." : (ttsApproved ? "Đã Tạo Xong" : "OK, Tạo Full Audio")}
                                                        {!ttsApproved && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-[9px] font-mono">{formatCost(estimateCost('tts_full'))}</span>}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Full Audio Player - appears after generation */}
                                        {fullAudioUrl && ttsApproved && (
                                            <div className="mt-4 bg-obsidian-950 border border-green-500/30 rounded-xl p-4">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <Music className="w-5 h-5 text-green-400" />
                                                    <h5 className="text-sm font-bold text-green-300 uppercase tracking-wider">Audio Full Kịch Bản</h5>
                                                </div>
                                                <audio
                                                    ref={fullAudioRef}
                                                    src={fullAudioUrl}
                                                    controls
                                                    className="w-full mb-3"
                                                    onLoadedData={(e) => { e.currentTarget.playbackRate = ttsSpeed; }}
                                                />
                                                <div className="flex flex-wrap gap-2">
                                                    <a
                                                        href={fullAudioUrl}
                                                        download="Gemini_AI_Voice_Full.mp3"
                                                        className="px-4 py-2 bg-obsidian-800 hover:bg-obsidian-700 border border-gray-700 rounded-lg text-sm text-gray-200 flex items-center gap-2 transition-all"
                                                    >
                                                        <Download className="w-4 h-4" /> Tải Audio
                                                    </a>
                                                    <button
                                                        onClick={() => {
                                                            alert("Audio đã được tự động gắn vào bước Lồng Ghép Video bên dưới (Mục 4)!");
                                                        }}
                                                        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-lg"
                                                    >
                                                        <Clapperboard className="w-4 h-4" /> Dán Audio vào Video Final
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}



                        <div className="space-y-1">
                            {/* Header row */}
                            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-gray-500 uppercase tracking-wider">
                                <div className="col-span-5">Âm thanh (Lời đọc)</div>
                                <div className="col-span-4">Hình ảnh (Mô tả)</div>
                                <div className="col-span-3">Video đề xuất</div>
                            </div>

                            <div className="space-y-4">
                                {script.sections.map((section, idx) => (
                                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-obsidian-900 rounded-xl p-4 border border-gray-800/50">
                                        <div className="col-span-5 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="md:hidden text-xs font-medium text-gray-500 uppercase">Âm thanh</span>
                                                <button
                                                    onClick={() => {
                                                        if (rewriteOpenIdx === idx) {
                                                            setRewriteOpenIdx(null);
                                                            setRewritePrompt("");
                                                        } else {
                                                            setRewriteOpenIdx(idx);
                                                            setRewritePrompt("");
                                                        }
                                                    }}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all ${rewriteOpenIdx === idx
                                                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                                                            : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 hover:border-purple-500/40'
                                                        }`}
                                                    title="Viết lại bằng AI"
                                                >
                                                    <Wand2 className="w-3.5 h-3.5" />
                                                    AI Viết lại
                                                </button>
                                            </div>

                                            {/* AI Rewrite Prompt Input */}
                                            <AnimatePresence>
                                                {rewriteOpenIdx === idx && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="bg-purple-900/15 border border-purple-500/30 rounded-lg p-3 space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <Wand2 className="w-4 h-4 text-purple-400 shrink-0" />
                                                                <span className="text-xs font-semibold text-purple-300">Yêu cầu viết lại đoạn này:</span>
                                                                <button
                                                                    onClick={() => { setRewriteOpenIdx(null); setRewritePrompt(""); }}
                                                                    className="ml-auto p-1 hover:bg-gray-800 rounded text-gray-500 hover:text-gray-300 transition-colors"
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={rewritePrompt}
                                                                    onChange={(e) => setRewritePrompt(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && rewritePrompt.trim()) {
                                                                            handleRewriteSection(idx);
                                                                        }
                                                                    }}
                                                                    placeholder="VD: Viết ngắn lại, giọng buồn hơn, thêm câu hỏi tu từ..."
                                                                    className="flex-1 bg-obsidian-950 border border-purple-900/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                                                    autoFocus
                                                                    disabled={rewritingIdx === idx}
                                                                />
                                                                <button
                                                                    onClick={() => handleRewriteSection(idx)}
                                                                    disabled={!rewritePrompt.trim() || rewritingIdx === idx}
                                                                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/30 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                                                >
                                                                    {rewritingIdx === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                                    {rewritingIdx === idx ? 'Đang viết...' : 'Gửi'}
                                                                </button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {['Viết ngắn gọn hơn', 'Thêm cảm xúc sâu lắng', 'Viết lại giọng thuyết pháp', 'Thêm câu hỏi tu từ', 'Dùng ẩn dụ thiên nhiên'].map((suggestion) => (
                                                                    <button
                                                                        key={suggestion}
                                                                        onClick={() => {
                                                                            setRewritePrompt(suggestion);
                                                                        }}
                                                                        className="px-2 py-1 bg-obsidian-950 border border-gray-800 hover:border-purple-500/40 rounded text-[10px] text-gray-400 hover:text-purple-300 transition-all"
                                                                    >
                                                                        {suggestion}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <textarea
                                                className="w-full bg-obsidian-950 border border-gray-800 rounded-lg p-3 text-gray-200 text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-y min-h-[120px]"
                                                value={section.audio}
                                                onChange={(e) => {
                                                    const newScript = { ...script };
                                                    newScript.sections[idx].audio = e.target.value;
                                                    setScript(newScript);
                                                    setTtsApproved(false);
                                                    setPreviewAudioUrl(null);
                                                    setFullAudioUrl(null);
                                                }}
                                            />
                                        </div>

                                        <div className="col-span-4 space-y-2">
                                            <span className="md:hidden text-xs font-medium text-gray-500 uppercase">Hình ảnh</span>
                                            <p className="text-gray-400 text-sm italic">{section.visual}</p>

                                            {/* Video Prompt gợi ý */}
                                            <div className="mt-2 bg-obsidian-950 border border-gray-800 rounded-lg p-2">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">🎬 Prompt Video AI</span>
                                                    <button
                                                        onClick={() => {
                                                            const videoPrompt = `Create a cinematic vertical video (9:16 ratio, 8 seconds) for a Buddhist/spiritual TikTok. Scene: ${section.visual}. The mood should match this voiceover: "${section.audio.slice(0, 100)}...". Style: slow motion, warm golden lighting, peaceful atmosphere, 4K quality.`;
                                                            navigator.clipboard.writeText(videoPrompt);
                                                            alert('Đã copy prompt video!');
                                                        }}
                                                        className="px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 rounded text-[10px] font-mono transition-all flex items-center gap-1"
                                                    >
                                                        <Copy className="w-3 h-3" /> Copy
                                                    </button>
                                                </div>
                                                <p className="text-[11px] text-gray-500 leading-relaxed">
                                                    Cinematic 9:16, 8s: {section.visual}. Mood: "{section.audio.slice(0, 60)}..."
                                                </p>
                                            </div>
                                        </div>

                                        <div className="col-span-3">
                                            <span className="md:hidden text-xs font-medium text-gray-500 uppercase mb-2 block">Video / Ảnh Lựa Chọn</span>

                                            {/* Nhóm 1: Tìm kiếm Pexels/Pixabay/Unsplash (Miễn phí) */}
                                            <div className="mb-3 grid grid-cols-2 gap-2">
                                                <div className="col-span-2">
                                                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1 block">🔍 Kho Ảnh/Video Miễn Phí</span>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        if (!script) return;
                                                        setSearchingPexels(prev => ({ ...prev, [idx]: true }));
                                                        try {
                                                            const res = await fetch('/api/fetch-videos', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ script: { ...script, sections: [section] }, pexelsKey, pixabayKey })
                                                            });
                                                            const data = await res.json();
                                                            if (data.script?.sections?.[0]?.mediaOptions) {
                                                                const newScript = { ...script };
                                                                const existingOptions = newScript.sections[idx].mediaOptions || [];
                                                                const existingUrls = new Set(existingOptions.map(m => m.previewUrl || m.imageUrl || m.videoUrl));
                                                                const newUniqueOptions = data.script.sections[0].mediaOptions.filter((m: any) => !existingUrls.has(m.previewUrl || m.imageUrl || m.videoUrl));

                                                                newScript.sections[idx].mediaOptions = [
                                                                    ...existingOptions,
                                                                    ...newUniqueOptions
                                                                ];
                                                                setScript(newScript);
                                                            }
                                                        } catch (e: any) {
                                                            alert('Lỗi tìm Pexels/Pixabay: ' + e.message);
                                                        } finally {
                                                            setSearchingPexels(prev => ({ ...prev, [idx]: false }));
                                                        }
                                                    }}
                                                    disabled={searchingPexels[idx]}
                                                    className="w-full py-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all flex justify-center items-center gap-1.5"
                                                >
                                                    {searchingPexels[idx] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                                    Pexels & Pixabay
                                                </button>

                                                <button
                                                    onClick={async () => {
                                                        if (!script) return;
                                                        if (!unsplashKey) {
                                                            alert('Vui lòng nhập API Key Unsplash ở Mục 0.');
                                                            return;
                                                        }
                                                        setSearchingUnsplash(prev => ({ ...prev, [idx]: true }));
                                                        try {
                                                            const res = await fetch('/api/fetch-unsplash', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ script: { ...script, sections: [section] }, unsplashKey })
                                                            });
                                                            const data = await res.json();
                                                            if (data.script?.sections?.[0]?.mediaOptions) {
                                                                const newScript = { ...script };
                                                                const existingOptions = newScript.sections[idx].mediaOptions || [];
                                                                const existingUrls = new Set(existingOptions.map(m => m.previewUrl || m.imageUrl || m.videoUrl));
                                                                const newUniqueOptions = data.script.sections[0].mediaOptions.filter((m: any) => !existingUrls.has(m.previewUrl || m.imageUrl || m.videoUrl));

                                                                newScript.sections[idx].mediaOptions = [
                                                                    ...newUniqueOptions,
                                                                    ...existingOptions,
                                                                ];
                                                                if (newUniqueOptions.length > 0) {
                                                                    newScript.sections[idx].selectedMediaIndices = [0];
                                                                }
                                                                setScript(newScript);
                                                            }
                                                        } catch (e: any) {
                                                            alert('Lỗi tìm Unsplash: ' + e.message);
                                                        } finally {
                                                            setSearchingUnsplash(prev => ({ ...prev, [idx]: false }));
                                                        }
                                                    }}
                                                    disabled={searchingUnsplash[idx]}
                                                    className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all flex justify-center items-center gap-1.5"
                                                >
                                                    {searchingUnsplash[idx] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                                    Ảnh Unsplash
                                                </button>
                                            </div>



                                            {section.mediaOptions && section.mediaOptions.length > 0 ? (
                                                <div className="space-y-4 w-full overflow-hidden">
                                                    {/* Video Section */}
                                                    <div className="space-y-1.5 flex flex-col items-start w-full">
                                                        <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest pl-1">Video (Chọn nhiều)</span>
                                                        <div className="flex gap-2 overflow-x-auto pb-2 snap-x w-full custom-scrollbar pr-4">
                                                            {section.mediaOptions.map((media, mIdx) => {
                                                                if (media.type !== 'video') return null;
                                                                const isSelected = (section.selectedMediaIndices === undefined && mIdx === 0) || (section.selectedMediaIndices?.includes(mIdx));

                                                                return (
                                                                    <div
                                                                        key={`vid-${mIdx}`}
                                                                        onClick={() => {
                                                                            const newScript = { ...script };
                                                                            let currentIndices = section.selectedMediaIndices || [];
                                                                            if (currentIndices.includes(mIdx)) {
                                                                                currentIndices = currentIndices.filter(i => i !== mIdx);
                                                                            } else {
                                                                                currentIndices = [...currentIndices, mIdx];
                                                                            }
                                                                            newScript.sections[idx].selectedMediaIndices = currentIndices;
                                                                            setScript(newScript);
                                                                        }}
                                                                        className={`flex-none w-[120px] h-[213px] rounded-lg bg-obsidian-950 border-2 cursor-pointer relative group snap-start transition-all overflow-hidden ${isSelected ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)] z-10' : 'border-gray-800 hover:border-gray-500 opacity-60 hover:opacity-100'}`}
                                                                    >
                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                        <img src={media.imageUrl} alt="media" className="w-full h-full object-cover absolute inset-0 transition-opacity duration-300 group-hover:opacity-0" />

                                                                        {media.previewUrl && (
                                                                            <video
                                                                                src={media.previewUrl}
                                                                                className="w-full h-full object-cover absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                                                muted loop playsInline
                                                                                onMouseEnter={(e) => e.currentTarget.play()}
                                                                                onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                                                            />
                                                                        )}

                                                                        <div className="absolute top-1 left-1 bg-blue-600/80 border border-blue-400/30 rounded px-1.5 py-0.5 text-[9px] text-white font-medium uppercase tracking-wider backdrop-blur-sm">
                                                                            VIDEO
                                                                        </div>

                                                                        {isSelected && (
                                                                            <div className="absolute inset-0 border-[3px] border-blue-500 rounded-lg pointer-events-none z-10" />
                                                                        )}

                                                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 text-center text-white">
                                                                            {media.photographer && <span className="text-[9px] text-gray-300 line-clamp-1">{media.photographer}</span>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Image Section */}
                                                    <div className="space-y-1.5 flex flex-col items-start w-full">
                                                        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest pl-1">Hình Ảnh (Có thể chọn nhiều)</span>
                                                        <div className="flex gap-2 overflow-x-auto pb-2 snap-x w-full custom-scrollbar pr-4">
                                                            {section.mediaOptions.map((media, mIdx) => {
                                                                if (media.type !== 'image') return null;
                                                                const isSelected = (section.selectedMediaIndices?.includes(mIdx));

                                                                return (
                                                                    <div
                                                                        key={`img-${mIdx}`}
                                                                        onClick={() => {
                                                                            const newScript = { ...script };
                                                                            let currentIndices = section.selectedMediaIndices || [0];

                                                                            if (currentIndices.includes(mIdx)) {
                                                                                if (currentIndices.length > 1) {
                                                                                    currentIndices = currentIndices.filter(i => i !== mIdx);
                                                                                }
                                                                            } else {
                                                                                const hasVideoSelected = currentIndices.some(i => section.mediaOptions![i].type === 'video');
                                                                                if (hasVideoSelected) {
                                                                                    currentIndices = [mIdx];
                                                                                } else {
                                                                                    currentIndices = [...currentIndices, mIdx];
                                                                                }
                                                                            }

                                                                            newScript.sections[idx].selectedMediaIndices = currentIndices;
                                                                            setScript(newScript);
                                                                        }}
                                                                        className={`flex-none w-[120px] h-[213px] rounded-lg bg-obsidian-950 border-2 cursor-pointer relative group snap-start transition-all overflow-hidden ${isSelected ? 'border-saffron-500 shadow-[0_0_15px_rgba(234,179,8,0.4)] scale-[1.02] z-10' : 'border-gray-800 hover:border-gray-500 opacity-60 hover:opacity-100 hover:scale-[1.01]'}`}
                                                                    >
                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                        <img src={media.imageUrl} alt="media" className="w-full h-full object-cover absolute inset-0 transition-opacity duration-300 group-hover:opacity-60" />

                                                                        <div className="absolute top-1 left-1 bg-emerald-600/80 border border-emerald-400/30 rounded px-1.5 py-0.5 text-[9px] text-white font-medium uppercase tracking-wider backdrop-blur-sm">
                                                                            ẢNH
                                                                        </div>

                                                                        {isSelected && (
                                                                            <div className="absolute top-1 right-1 bg-saffron-500 rounded-full w-5 h-5 flex items-center justify-center shadow-lg border-2 border-white">
                                                                                <CheckCircle2 className="w-3 h-3 text-white" />
                                                                            </div>
                                                                        )}

                                                                        {isSelected && (
                                                                            <div className="absolute inset-0 border-[3px] border-saffron-500 rounded-lg pointer-events-none z-10" />
                                                                        )}

                                                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent p-2 text-center text-white">
                                                                            {media.photographer && <span className="text-[9px] text-gray-300 line-clamp-1">{media.photographer}</span>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-full min-h-[140px] rounded-lg bg-obsidian-950 border border-gray-800 flex items-center justify-center relative group">
                                                    <div className="text-center p-4">
                                                        {status === "finding_videos" ? (
                                                            <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-500 mb-2" />
                                                        ) : (
                                                            <Video className="w-6 h-6 text-gray-600 mx-auto mb-2 opacity-30" />
                                                        )}
                                                        <span className="text-xs text-gray-500">
                                                            {status === "finding_videos" ? "Đang tìm kiếm..." : "Chưa có media"}
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.section>
                )}
            </AnimatePresence>

            {/* 4. Generate Final Video */}
            <AnimatePresence>
                {(status === "script_ready" || status === "finding_videos" || status === "complete" || status === "generating_video" || status === "video_ready") && script && (
                    <motion.section
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="glass-panel p-6 md:p-8 rounded-2xl relative z-10 overflow-hidden"
                    >
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-full bg-rose-500/10 text-rose-500">
                                <Play className="w-6 h-6" />
                            </div>
                            <h2 className="text-2xl font-lora font-semibold">4. Tạo Video Hoàn Chỉnh (Đồng bộ Khớp Kịch Bản / Lồng Nhạc Tự Do)</h2>
                        </div>

                        {!finalVideoUrl ? (
                            <div className="bg-obsidian-900 border border-gray-800 rounded-xl p-6 space-y-8">

                                {/* Option 1: Sync Video */}
                                <div className="border border-blue-900/40 bg-blue-900/5 rounded-xl p-6 text-center space-y-4 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 bg-blue-600 text-[10px] font-bold px-3 py-1 text-white rounded-bl-lg uppercase tracking-wider">Khuyên Dùng</div>
                                    <h3 className="text-xl font-bold text-blue-400">Cách 1: Trí tuệ AI (Đồng bộ chính xác)</h3>
                                    <p className="text-gray-300 max-w-lg mx-auto text-sm">Hệ thống sẽ tự động ghép audio vào từng khung hình một cách chính xác tuyệt đối, không có âm nhạc nền xen lẫn. Cảnh chuyển mượt mà đồng điệu với giọng nói.</p>

                                    <button
                                        onClick={handleGenerateSyncVideo}
                                        disabled={status === "generating_video"}
                                        className="px-6 py-3 mx-auto rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium hover:from-blue-500 hover:to-blue-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                                    >
                                        {status === "generating_video" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Clapperboard className="w-5 h-5" />}
                                        {status === "generating_video" ? "Đang xử lý đồng bộ (Mất vài phút)..." : "Tạo Video Tự Động Đồng Bộ"}
                                    </button>
                                </div>

                                {/* Option 2: Custom Music */}
                                <div className="border border-gray-800 bg-obsidian-950 rounded-xl p-6 text-center space-y-4">
                                    <h3 className="text-lg font-bold text-emerald-400">Cách 2: Lồng âm thanh chung toàn bài</h3>
                                    <p className="text-gray-400 max-w-lg mx-auto text-sm">Tải lên 1 file nhạc/mp3 dài hoặc sử dụng Audio Full Kịch Bản ở trên, hệ thống sẽ tự động dàn đều các video đã chọn cho vừa độ dài âm thanh.</p>

                                    <input
                                        type="file"
                                        accept="audio/mp3,audio/wav,audio/mpeg"
                                        ref={fileInputRef}
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setAudioFile(e.target.files[0]);
                                            }
                                        }}
                                    />

                                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-6 py-3 rounded-xl bg-obsidian-800 border border-gray-700 text-white hover:bg-obsidian-700 transition-all font-medium flex items-center gap-2 text-sm"
                                        >
                                            <Music className="w-4 h-4 text-emerald-400" />
                                            {audioFile ? audioFile.name : "Chọn hoặc dùng file audio ở Bước 3..."}
                                        </button>

                                        <button
                                            onClick={handleGenerateVideo}
                                            disabled={!audioFile || status === "generating_video"}
                                            className="px-6 py-3 rounded-xl bg-obsidian-800 text-emerald-400 font-medium hover:bg-obsidian-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm border border-emerald-900/50"
                                        >
                                            {status === "generating_video" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                            {status === "generating_video" ? "Đang xử lý..." : "Lồng Video & Âm Thanh Khớp Độ Dài"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-obsidian-900 border border-green-500/30 rounded-xl p-6 text-center space-y-6">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 text-green-500 mb-2">
                                    <CheckCircle2 className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-2">Video Đã Sẵn Sàng!</h3>
                                    <p className="text-gray-400">Bạn có thể xem trước hoặc tải ngay về máy để đăng TikTok.</p>
                                </div>

                                <div className="max-w-[300px] mx-auto rounded-xl overflow-hidden shadow-2xl border border-gray-800 bg-black">
                                    <video
                                        src={finalVideoUrl}
                                        controls
                                        className="w-full h-auto aspect-[9/16] object-cover"
                                        playsInline
                                    />
                                </div>

                                <div className="pt-4">
                                    <a
                                        href={finalVideoUrl}
                                        download="Tao_triet_ly_Video.mp4"
                                        className="inline-flex px-8 py-4 rounded-xl bg-gradient-to-r from-saffron-600 to-saffron-500 text-white font-bold hover:from-saffron-500 hover:to-saffron-400 transition-all items-center gap-3 shadow-lg shadow-saffron-500/20"
                                    >
                                        <Download className="w-6 h-6" />
                                        TẢI VIDEO VỀ MÁY
                                    </a>

                                    <button
                                        onClick={() => {
                                            setFinalVideoUrl(null);
                                            setAudioFile(null);
                                            setStatus("complete");
                                        }}
                                        className="block mx-auto mt-4 text-sm text-gray-500 hover:text-gray-300 underline"
                                    >
                                        Tạo video khác
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.section>
                )}
            </AnimatePresence>
            {/* Sticky Cost Footer */}
            {
                totalCost > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 z-50 bg-obsidian-950/95 backdrop-blur-md border-t border-saffron-500/30 px-6 py-3">
                        <div className="max-w-4xl mx-auto flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <DollarSign className="w-4 h-4 text-saffron-500" />
                                <span>Chi phí API ước tính phiên làm việc này:</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-saffron-400 font-mono">${totalCost.toFixed(4)}</span>
                                <button onClick={() => setTotalCost(0)} className="text-xs text-gray-500 hover:text-gray-300 underline">Reset</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
