"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type WordItem = {
    id: string;
    content: string;
};

type Pair = {
    left: WordItem;
    right: WordItem;
};

type ResultRow = {
    rank: number;
    word_id: string;
    content: string;
};

const MAX_COMPARISONS = 40;
const INITIAL_ELO = 1000;
const K_FACTOR = 32;

export default function ThreadsWordSorter() {
    const [items, setItems] = useState<WordItem[]>([]);
    const [pairs, setPairs] = useState<Pair[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [eloScores, setEloScores] = useState<Record<string, number>>({});
    const [finalRanking, setFinalRanking] = useState<ResultRow[]>([]);
    const [step, setStep] = useState<"loading" | "compare" | "adjust" | "done">(
        "loading"
    );
    const [saving, setSaving] = useState(false);
    const [showGuide, setShowGuide] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [startedAtIso, setStartedAtIso] = useState<string | null>(null);

    useEffect(() => {
        async function loadWords() {
            const res = await fetch("/words.json", { cache: "no-store" });
            const data: WordItem[] = await res.json();

            const participantSessionId = localStorage.getItem(
                "participant_session_id"
            );

            if (!participantSessionId) {
                alert("找不到 participant session，請回到基本資料頁重新開始。");
                return;
            }

            const startIso = new Date().toISOString();

            const { error: sessionError } = await supabase
                .from("wordsort_sessions")
                .insert({
                    participant_session_id: participantSessionId,
                    started_at: startIso,
                });

            if (sessionError) {
                console.error("建立 wordsort_sessions 失敗", sessionError);
                alert("建立 wordsort session 失敗");
                return;
            }

            setStartTime(Date.now());
            setStartedAtIso(startIso);

            const initialEloScores: Record<string, number> = {};
            data.forEach((item) => {
                initialEloScores[item.id] = INITIAL_ELO;
            });

            const generatedPairs: Pair[] = [];

            for (let i = 0; i < data.length; i++) {
                for (let j = i + 1; j < data.length; j++) {
                    generatedPairs.push({
                        left: data[i],
                        right: data[j],
                    });
                }
            }

            setItems(data);
            setEloScores(initialEloScores);
            setPairs(shuffleArray(generatedPairs).slice(0, MAX_COMPARISONS));
            setStep("compare");
        }

        loadWords();
    }, []);

    const currentPair = pairs[currentIndex];

    const progressPercent = useMemo(() => {
        if (pairs.length === 0) return 0;
        return ((currentIndex + 1) / pairs.length) * 100;
    }, [currentIndex, pairs.length]);

    function handleChoose(choice: "left" | "right" | "tie") {
        if (!currentPair) return;

        const leftId = currentPair.left.id;
        const rightId = currentPair.right.id;

        const leftRating = eloScores[leftId] ?? INITIAL_ELO;
        const rightRating = eloScores[rightId] ?? INITIAL_ELO;

        let resultLeft: 0 | 0.5 | 1 = 0.5;

        if (choice === "left") resultLeft = 1;
        if (choice === "right") resultLeft = 0;
        if (choice === "tie") resultLeft = 0.5;

        const { newRatingA, newRatingB } = calculateElo(
            leftRating,
            rightRating,
            resultLeft
        );

        const nextEloScores = {
            ...eloScores,
            [leftId]: newRatingA,
            [rightId]: newRatingB,
        };

        setEloScores(nextEloScores);

        if (currentIndex + 1 >= pairs.length) {
            const ranked = [...items]
                .map((item) => ({
                    ...item,
                    elo: nextEloScores[item.id] ?? INITIAL_ELO,
                }))
                .sort((a, b) => b.elo - a.elo)
                .map((item, index) => ({
                    rank: index + 1,
                    word_id: item.id,
                    content: item.content,
                }));

            setFinalRanking(ranked);
            setStep("adjust");
            return;
        }

        setCurrentIndex((prev) => prev + 1);
    }

    function moveItem(index: number, direction: "up" | "down") {
        setFinalRanking((prev) => {
            const next = [...prev];
            const targetIndex = direction === "up" ? index - 1 : index + 1;

            if (targetIndex < 0 || targetIndex >= next.length) return prev;

            [next[index], next[targetIndex]] = [next[targetIndex], next[index]];

            return next.map((item, idx) => ({
                ...item,
                rank: idx + 1,
            }));
        });
    }

    async function saveFinalRanking() {
        setSaving(true);

        const sessionId = localStorage.getItem("participant_session_id");

        if (!sessionId) {
            alert("找不到測驗 session，請回到基本資料頁重新開始。");
            setSaving(false);
            return;
        }

        const rows = finalRanking.map((item) => ({
            session_id: sessionId,
            rank: item.rank,
            word_id: item.word_id,
            content: item.content,
        }));

        const { error } = await supabase.from("word_ranking_results").insert(rows);

        if (error) {
            console.error("寫入 word_ranking_results 失敗", error);
            alert("儲存失敗，請稍後再試。");
            setSaving(false);
            return;
        }

        if (startTime && startedAtIso) {
            const { error: sessionUpdateError } = await supabase
                .from("wordsort_sessions")
                .update({
                    completed_at: new Date().toISOString(),
                    duration_seconds: Math.floor((Date.now() - startTime) / 1000),
                    total_comparisons: pairs.length,
                })
                .eq("participant_session_id", sessionId)
                .eq("started_at", startedAtIso);

            if (sessionUpdateError) {
                console.error("更新 wordsort_sessions 失敗", sessionUpdateError);
            }
        }

        setSaving(false);
        setStep("done");
    }

    if (step === "loading") {
        return <div className="p-10 text-center">載入文字題目中...</div>;
    }

    if (step === "compare" && currentPair) {
        return (
            <main className="mx-auto max-w-5xl px-4 py-8">
                <section className="mb-4 rounded-2xl border bg-white shadow-sm">
                    <button
                        type="button"
                        onClick={() => setShowGuide((prev) => !prev)}
                        className="flex w-full flex-col gap-1 px-5 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
                    >
                        <h1 className="text-2xl font-bold sm:text-xl">
                            Threads 貼文比較
                        </h1>

                        <span className="text-sm font-semibold text-blue-600">
                            {showGuide ? "收起說明 ▲" : "展開說明 ▼"}
                        </span>
                    </button>

                    {showGuide && (
                        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                            <p className="text-gray-700">
                                請選出你覺得「更可能在 Threads 爆紅」的貼文。
                            </p>

                            <p className="mt-2 font-semibold text-blue-600">
                                點擊整張文字卡片即可選擇。
                            </p>

                            <p className="mt-2 text-sm text-gray-500">
                                爆紅定義：較可能獲得按讚、留言、轉發與擴散。請以貼文本身內容為準。
                            </p>
                        </div>
                    )}
                </section>

                <section className="mb-5">
                    <div className="mb-2 flex items-center justify-between text-sm font-medium text-gray-600">
                        <span>
                            第 {currentIndex + 1} / {pairs.length} 題
                        </span>

                        <span>{Math.round(progressPercent)}%</span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                        <div
                            className="h-full rounded-full bg-blue-500 transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </section>
                <section className="mx-auto flex w-[calc(100vw-32px)] flex-col gap-4 md:w-full md:max-w-[900px] md:grid md:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] md:items-center md:gap-5">
                    <button
                        type="button"
                        onClick={() => handleChoose("left")}
                        className="group box-border flex h-[260px] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border-2 border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-500 hover:shadow-lg md:p-6"
                    >
                        <div className="h-[150px] w-full min-w-0 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words text-sm leading-7 text-gray-900 [scrollbar-gutter:stable] md:text-base md:leading-8">
                            {currentPair.left.content}
                        </div>

                        <div className="mt-auto w-full rounded-xl bg-gray-50 p-3 text-center text-sm font-semibold text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600">
                            選這篇
                        </div>
                    </button>

                    <div className="hidden items-center justify-center text-xl font-bold text-gray-400 md:flex">
                        VS
                    </div>

                    <button
                        type="button"
                        onClick={() => handleChoose("right")}
                        className="group box-border flex h-[260px] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border-2 border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-500 hover:shadow-lg md:p-6"
                    >
                        <div className="h-[150px] w-full min-w-0 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words text-sm leading-7 text-gray-900 [scrollbar-gutter:stable] md:text-base md:leading-8">
                            {currentPair.right.content}
                        </div>

                        <div className="mt-auto w-full rounded-xl bg-gray-50 p-3 text-center text-sm font-semibold text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600">
                            選這篇
                        </div>
                    </button>
                </section>

                <div className="mt-6 flex justify-center">
                    <button
                        type="button"
                        onClick={() => handleChoose("tie")}
                        className="rounded-full border border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 shadow-sm transition hover:bg-gray-100"
                    >
                        看不出來 / 差不多
                    </button>
                </div>
            </main>
        );
    }

    if (step === "adjust") {
        return (
            <main className="mx-auto max-w-3xl px-4 py-8">
                <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
                    <h1 className="mb-2 text-2xl font-bold">按底下送出就完成了</h1>
                    <p className="text-gray-600">
                        這是根據你剛才的選擇產生的排序。你可以手動微調，確認後請按下送出。
                    </p>
                </section>

                <div className="space-y-4">
                    {finalRanking.map((item, index) => (
                        <div
                            key={item.word_id}
                            className="rounded-2xl border bg-white p-4 shadow-sm"
                        >
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="text-lg font-bold">第 {item.rank} 名</div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => moveItem(index, "up")}
                                        disabled={index === 0}
                                        className="rounded-lg border px-3 py-1 text-sm disabled:opacity-30"
                                    >
                                        上移
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => moveItem(index, "down")}
                                        disabled={index === finalRanking.length - 1}
                                        className="rounded-lg border px-3 py-1 text-sm disabled:opacity-30"
                                    >
                                        下移
                                    </button>
                                </div>
                            </div>

                            <div className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 leading-7 text-gray-800">
                                {item.content}
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={saveFinalRanking}
                    disabled={saving}
                    className="mt-8 w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? "儲存中..." : "確認排序並送出"}
                </button>
            </main>
        );
    }

    if (step === "done") {
        return (
            <main className="mx-auto max-w-xl px-4 py-20 text-center">
                <h1 className="mb-4 text-3xl font-bold">完成！</h1>
                <p className="text-gray-600">感謝你完成這次貼文排序測驗。</p>
            </main>
        );
    }

    return null;
}

function calculateElo(
    ratingA: number,
    ratingB: number,
    resultA: 0 | 0.5 | 1
) {
    const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const expectedB = 1 - expectedA;

    const resultB = 1 - resultA;

    return {
        newRatingA: ratingA + K_FACTOR * (resultA - expectedA),
        newRatingB: ratingB + K_FACTOR * (resultB - expectedB),
    };
}

function shuffleArray<T>(array: T[]) {
    const next = [...array];

    for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }

    return next;
}