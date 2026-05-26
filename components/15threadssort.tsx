"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ThreadItem = {
    id: string;
    image_url: string;
};

type Pair = {
    left: ThreadItem;
    right: ThreadItem;
};

type ResultRow = {
    rank: number;
    image_id: string;
    image_url: string;
};

const MAX_COMPARISONS = 40;
const INITIAL_ELO = 1000;
const K_FACTOR = 32;

export default function ThreadsSort15() {
    const [items, setItems] = useState<ThreadItem[]>([]);
    const [pairs, setPairs] = useState<Pair[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [eloScores, setEloScores] = useState<Record<string, number>>({});
    const [finalRanking, setFinalRanking] = useState<ResultRow[]>([]);
    const [step, setStep] = useState<"loading" | "compare" | "adjust" | "done">(
        "loading"
    );
    const [saving, setSaving] = useState(false);
    const [showGuide, setShowGuide] = useState(true);

    useEffect(() => {
        async function loadImages() {
            const res = await fetch("/threads15.json", {
                cache: "no-store",
            });

            const data: ThreadItem[] = await res.json();

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

        loadImages();
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
                    image_id: item.id,
                    image_url: item.image_url,
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

            const targetIndex =
                direction === "up" ? index - 1 : index + 1;

            if (targetIndex < 0 || targetIndex >= next.length) {
                return prev;
            }

            [next[index], next[targetIndex]] = [
                next[targetIndex],
                next[index],
            ];

            return next.map((item, idx) => ({
                ...item,
                rank: idx + 1,
            }));
        });
    }

    async function saveFinalRanking() {
        setSaving(true);

        const sessionId = localStorage.getItem("thread15_session_id");

        if (!sessionId) {
            alert("找不到受試者資料，請先從 intake 頁面開始。");
            setSaving(false);
            return;
        }

        const rows = finalRanking.map((item) => ({
            session_id: sessionId,
            rank: item.rank,
            image_id: item.image_id,
            image_url: item.image_url,
        }));

        const { error } = await supabase
            .from("thread15_ranking_results")
            .insert(rows);

        if (error) {
            console.error(error);
            alert("儲存失敗");
            setSaving(false);
            return;
        }

        setSaving(false);
        setStep("done");
    }

    if (step === "loading") {
        return (
            <div className="p-10 text-center">
                載入貼文中...
            </div>
        );
    }

    if (step === "compare" && currentPair) {
        return (
            <main className="mx-auto max-w-6xl px-4 py-8">
                <section className="mb-4 rounded-2xl border bg-white shadow-sm">
                    <button
                        type="button"
                        onClick={() => setShowGuide((prev) => !prev)}
                        className="flex w-full flex-col gap-1 px-5 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
                    >
                        <h1 className="text-2xl font-bold">
                            Threads 貼文比較
                        </h1>

                        <span className="text-sm font-semibold text-blue-600">
                            {showGuide ? "收起說明 ▲" : "展開說明 ▼"}
                        </span>
                    </button>

                    {showGuide && (
                        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                            <p className="text-sm text-gray-500">
                                請選出你認為「更可能在 Threads 爆紅」的貼文。
                            </p>

                            <p className="mt-2 font-semibold text-red-500">
                                不是選自己喜歡的內容，
                                而是選更容易獲得大量互動與擴散的貼文。
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
                            style={{
                                width: `${progressPercent}%`,
                            }}
                        />
                    </div>
                </section>

                <section className="mx-auto grid w-full max-w-[980px] grid-cols-1 gap-5 md:grid-cols-[430px_60px_430px] md:items-center md:justify-center">
                    <button
                        type="button"
                        onClick={() => handleChoose("left")}
                        className="group mx-auto flex w-full max-w-[430px] flex-col items-center rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-sm transition hover:border-blue-500 hover:shadow-lg"
                    >
                        <div className="relative aspect-[430/429] w-full overflow-hidden rounded-xl bg-white">
                            <img
                                src={currentPair.left.image_url}
                                alt=""
                                className="h-full w-full object-contain"
                                draggable={false}
                            />
                        </div>

                        <div className="mt-3 w-full rounded-xl bg-gray-50 p-3 text-center text-sm font-semibold text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600">
                            選這篇
                        </div>
                    </button>

                    <div className="hidden items-center justify-center text-xl font-bold text-gray-400 md:flex">
                        VS
                    </div>

                    <button
                        type="button"
                        onClick={() => handleChoose("right")}
                        className="group mx-auto flex w-full max-w-[430px] flex-col items-center rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-sm transition hover:border-blue-500 hover:shadow-lg"
                    >
                        <div className="relative aspect-[430/429] w-full overflow-hidden rounded-xl bg-white">
                            <img
                                src={currentPair.right.image_url}
                                alt=""
                                className="h-full w-full object-contain"
                                draggable={false}
                            />
                        </div>

                        <div className="mt-3 w-full rounded-xl bg-gray-50 p-3 text-center text-sm font-semibold text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600">
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
            <main className="mx-auto max-w-4xl px-4 py-8">
                <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
                    <h1 className="mb-2 text-2xl font-bold">
                        最終排序確認
                    </h1>

                    <p className="text-gray-600">
                        你可以微調順序後再送出。
                    </p>
                </section>

                <div className="space-y-4">
                    {finalRanking.map((item, index) => (
                        <div
                            key={item.image_id}
                            className="rounded-2xl border bg-white p-4 shadow-sm"
                        >
                            <div className="mb-3 flex items-center justify-between">
                                <div className="text-lg font-bold">
                                    第 {item.rank} 名
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            moveItem(index, "up")
                                        }
                                        disabled={index === 0}
                                        className="rounded-lg border px-3 py-1 text-sm disabled:opacity-30"
                                    >
                                        上移
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            moveItem(index, "down")
                                        }
                                        disabled={
                                            index ===
                                            finalRanking.length - 1
                                        }
                                        className="rounded-lg border px-3 py-1 text-sm disabled:opacity-30"
                                    >
                                        下移
                                    </button>
                                </div>
                            </div>

                            <img
                                src={item.image_url}
                                alt=""
                                className="mx-auto w-full max-w-[430px] rounded-xl border"
                            />
                        </div>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={saveFinalRanking}
                    disabled={saving}
                    className="mt-8 w-full rounded-2xl bg-blue-600 px-6 py-4 font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? "儲存中..." : "確認排序並送出"}
                </button>
            </main>
        );
    }

    if (step === "done") {
        return (
            <main className="mx-auto max-w-xl px-4 py-20 text-center">
                <h1 className="mb-4 text-3xl font-bold">
                    完成！
                </h1>

                <p className="text-gray-600">
                    感謝你完成這次比較。
                </p>
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
    const expectedA =
        1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));

    const expectedB = 1 - expectedA;

    const resultB = 1 - resultA;

    return {
        newRatingA:
            ratingA + K_FACTOR * (resultA - expectedA),

        newRatingB:
            ratingB + K_FACTOR * (resultB - expectedB),
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