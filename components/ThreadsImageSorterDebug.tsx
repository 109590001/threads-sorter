"use client";

import { useEffect, useMemo, useState } from "react";

type Post = {
  id: string;
  imageUrl: string;
};

type PostState = Post & {
  swissPoints: number;
  totalMargin: number;
  matches: number;
  opponents: string[];
  seed: number;
};

type Pair = {
  left: PostState;
  right: PostState;
};

type PhaseConfig = {
  key: "phase1" | "phase2";
  label: string;
  rounds: number;
  poolSize: number | "all";
};

type Snapshot = {
  allItems: PostState[];
  activeIds: string[];
  phaseIndex: number;
  round: number;
  pairIndex: number;
  slider: number;
};

const TOTAL_POSTS = 60;

const PHASES: PhaseConfig[] = [
  {
    key: "phase1",
    label: "第一階段｜全體粗排",
    rounds: 2,
    poolSize: "all",
  },
  {
    key: "phase2",
    label: "第二階段｜前 16 名精排",
    rounds: 2,
    poolSize: 16,
  },
];

const basePosts: Post[] = Array.from({ length: TOTAL_POSTS }, (_, i) => ({
  id: String(i + 1),
  imageUrl: `/images/${String(i + 1).padStart(2, "0")}.png`,
}));

function shuffle<T>(array: T[]) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function cloneItems(items: PostState[]) {
  return items.map((item) => ({
    ...item,
    opponents: [...item.opponents],
  }));
}

function compareForRanking(a: PostState, b: PostState) {
  if (b.swissPoints !== a.swissPoints) return b.swissPoints - a.swissPoints;

  const aAvg = a.matches > 0 ? a.totalMargin / a.matches : 0;
  const bAvg = b.matches > 0 ? b.totalMargin / b.matches : 0;
  if (bAvg !== aAvg) return bAvg - aAvg;

  if (b.totalMargin !== a.totalMargin) return b.totalMargin - a.totalMargin;

  return a.seed - b.seed;
}

function buildSwissPairs(items: PostState[]): Pair[] {
  const sorted = [...items].sort(compareForRanking);
  const working = [...sorted];
  const pairs: Pair[] = [];

  while (working.length >= 2) {
    const left = working.shift()!;
    let opponentIndex = working.findIndex(
      (candidate) => !left.opponents.includes(candidate.id)
    );

    if (opponentIndex === -1) {
      opponentIndex = 0;
    }

    const right = working.splice(opponentIndex, 1)[0];
    pairs.push({ left, right });
  }

  return pairs;
}

function escapeCsvValue(value: string | number) {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function getFileName(path: string) {
  const parts = path.split("/");
  return parts[parts.length - 1] ?? path;
}

function getAverageMargin(item: PostState) {
  return item.matches > 0 ? item.totalMargin / item.matches : 0;
}

export default function ThreadsImageSorter() {
  const [allItems, setAllItems] = useState<PostState[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [pairIndex, setPairIndex] = useState(0);
  const [slider, setSlider] = useState(0);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [ready, setReady] = useState(false);

  const currentPhase = PHASES[phaseIndex] ?? null;

  useEffect(() => {
    const seeded = shuffle(basePosts).map((post, index) => ({
      ...post,
      swissPoints: 0,
      totalMargin: 0,
      matches: 0,
      opponents: [],
      seed: index,
    }));

    setAllItems(seeded);
    setActiveIds(seeded.map((item) => item.id));
    setPhaseIndex(0);
    setRound(1);
    setPairIndex(0);
    setSlider(0);
    setHistory([]);
    setReady(true);
  }, []);

  const ranking = useMemo(() => {
    return [...allItems].sort(compareForRanking);
  }, [allItems]);

  const activeItems = useMemo(() => {
    const idSet = new Set(activeIds);
    return ranking.filter((item) => idSet.has(item.id));
  }, [ranking, activeIds]);

  const currentPairs = useMemo(() => {
    if (!ready || activeItems.length === 0) return [];
    return buildSwissPairs(activeItems);
  }, [activeItems, ready]);

  const currentPair = currentPairs[pairIndex] ?? null;
  const finished = ready && phaseIndex >= PHASES.length;

  function moveToNextStage(nextRankingSource: PostState[]) {
    const nextPhaseIndex = phaseIndex + 1;

    if (nextPhaseIndex >= PHASES.length) {
      setPhaseIndex(nextPhaseIndex);
      return;
    }

    const nextPhase = PHASES[nextPhaseIndex];
    const sorted = [...nextRankingSource].sort(compareForRanking);
    const nextActive =
      nextPhase.poolSize === "all"
        ? sorted
        : sorted.slice(0, nextPhase.poolSize);

    const nextIds = nextActive.map((item) => item.id);

    setPhaseIndex(nextPhaseIndex);
    setActiveIds(nextIds);
    setRound(1);
    setPairIndex(0);
    setSlider(0);

    setAllItems((prev) =>
      prev.map((item) =>
        nextIds.includes(item.id) ? { ...item, opponents: [] } : item
      )
    );
  }

  function applyVote(value: number) {
    if (!currentPair || !currentPhase) return;

    const snapshot: Snapshot = {
      allItems: cloneItems(allItems),
      activeIds: [...activeIds],
      phaseIndex,
      round,
      pairIndex,
      slider,
    };

    setHistory((prev) => [...prev, snapshot]);

    const nextAllItems = cloneItems(allItems);
    const left = nextAllItems.find((item) => item.id === currentPair.left.id);
    const right = nextAllItems.find((item) => item.id === currentPair.right.id);

    if (!left || !right) return;

    left.matches += 1;
    right.matches += 1;

    left.opponents.push(right.id);
    right.opponents.push(left.id);

    left.totalMargin += -value;
    right.totalMargin += value;

    if (value < 0) {
      left.swissPoints += 1;
    } else if (value > 0) {
      right.swissPoints += 1;
    } else {
      left.swissPoints += 0.5;
      right.swissPoints += 0.5;
    }

    const nextRankingSource = [...nextAllItems].sort(compareForRanking);
    setAllItems(nextAllItems);
    setSlider(0);

    const isLastPairInRound = pairIndex + 1 >= currentPairs.length;

    if (!isLastPairInRound) {
      setPairIndex((prev) => prev + 1);
      return;
    }

    const isLastRoundInPhase = round >= currentPhase.rounds;

    if (!isLastRoundInPhase) {
      setRound((prev) => prev + 1);
      setPairIndex(0);
      setAllItems((prev) =>
        prev.map((item) =>
          activeIds.includes(item.id) ? { ...item, opponents: [] } : item
        )
      );
      return;
    }

    moveToNextStage(nextRankingSource);
  }

  function handlePrev() {
    const last = history[history.length - 1];
    if (!last) return;

    setAllItems(last.allItems);
    setActiveIds(last.activeIds);
    setPhaseIndex(last.phaseIndex);
    setRound(last.round);
    setPairIndex(last.pairIndex);
    setSlider(last.slider);
    setHistory((prev) => prev.slice(0, -1));
  }

  function handleRestart() {
    const seeded = shuffle(basePosts).map((post, index) => ({
      ...post,
      swissPoints: 0,
      totalMargin: 0,
      matches: 0,
      opponents: [],
      seed: index,
    }));

    setAllItems(seeded);
    setActiveIds(seeded.map((item) => item.id));
    setPhaseIndex(0);
    setRound(1);
    setPairIndex(0);
    setSlider(0);
    setHistory([]);
    setReady(true);
  }

  function handleExportCsv() {
    const header = [
      "rank",
      "id",
      "fileName",
      "imageUrl",
      "swissPoints",
      "totalMargin",
      "matches",
      "averageMargin",
    ];

    const rows = ranking.map((item, index) => [
      index + 1,
      item.id,
      getFileName(item.imageUrl),
      item.imageUrl,
      item.swissPoints,
      item.totalMargin,
      item.matches,
      getAverageMargin(item).toFixed(4),
    ]);

    const csv = [
      header.map(escapeCsvValue).join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const timestamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, "-");

    a.href = url;
    a.download = `threads-debug-ranking-${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const totalComparisonsEstimate = PHASES.reduce((sum, phase) => {
    const pool =
      phase.poolSize === "all" ? TOTAL_POSTS : Number(phase.poolSize);
    return sum + Math.floor(pool / 2) * phase.rounds;
  }, 0);

  const completedComparisons = history.length;

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg">
        載入中...
      </div>
    );
  }

  if (finished) {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-8 md:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">排序結果</h1>
              <p className="mt-2 text-sm text-neutral-600">
                已完成兩階段排序：先粗排，再針對前 16 名精排。
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleExportCsv}
                className="rounded-xl bg-green-600 px-4 py-2.5 text-white transition hover:opacity-90"
              >
                匯出 CSV
              </button>
              <button
                onClick={handleRestart}
                className="rounded-xl bg-black px-4 py-2.5 text-white transition hover:opacity-90"
              >
                重新開始
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
            {ranking.map((item, index) => (
              <div
                key={item.id}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
                  <div className="font-bold text-neutral-900">#{index + 1}</div>
                  <div className="text-xs text-neutral-500">
                    {getFileName(item.imageUrl)}
                  </div>
                </div>

                <div className="flex h-[220px] items-center justify-center bg-neutral-50 p-3">
                  <img
                    src={item.imageUrl}
                    alt={`Post ${item.id}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <div className="space-y-1 px-3 py-3 text-sm text-neutral-700">
                  <div>ID：{item.id}</div>
                  <div>積分：{item.swissPoints}</div>
                  <div>總分差：{item.totalMargin}</div>
                  <div>平均分差：{getAverageMargin(item).toFixed(2)}</div>
                  <div>比較次數：{item.matches}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!currentPair || !currentPhase) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg">
        配對中...
      </div>
    );
  }

  const leftItem =
    allItems.find((item) => item.id === currentPair.left.id) ?? currentPair.left;
  const rightItem =
    allItems.find((item) => item.id === currentPair.right.id) ?? currentPair.right;

  const sliderLabels = [
    "A 明顯較佳",
    "A 很較佳",
    "A 稍較佳",
    "A 略較佳",
    "差不多",
    "B 略較佳",
    "B 稍較佳",
    "B 很較佳",
    "B 明顯較佳",
  ];

  const sliderIndex = slider + 4;

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Threads Image Sorter Debug
          </h1>
          <p className="mt-3 text-sm text-neutral-600 md:text-base">
            debug 模式：一邊比較，一邊看檔名與即時分數
          </p>
          <p className="mt-3 text-base font-medium text-neutral-800">
            {currentPhase.label}
          </p>
          <p className="mt-2 text-lg font-medium text-neutral-800">
            第 {round} 輪 / {currentPhase.rounds} 輪　・　第 {pairIndex + 1} 組 /{" "}
            {currentPairs.length} 組
          </p>
          <p className="mt-2 text-sm text-neutral-500">
            已完成 {completedComparisons} / 約 {totalComparisonsEstimate} 題
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px_1fr_320px]">
          <div className="rounded-[28px] border border-neutral-300 bg-white p-3 shadow-sm">
            <div className="mb-3 text-center text-sm font-medium text-neutral-500">
              A 圖
            </div>

            <div className="mb-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <div>檔名：{getFileName(leftItem.imageUrl)}</div>
              <div>ID：{leftItem.id}</div>
              <div>目前積分：{leftItem.swissPoints}</div>
              <div>目前總分差：{leftItem.totalMargin}</div>
              <div>平均分差：{getAverageMargin(leftItem).toFixed(2)}</div>
              <div>比較次數：{leftItem.matches}</div>
            </div>

            <div className="flex h-[520px] items-center justify-center overflow-hidden rounded-[22px] bg-neutral-100">
              <img
                src={leftItem.imageUrl}
                alt={`Post ${leftItem.id}`}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-neutral-300 bg-white p-5 shadow-sm">
            <div className="mb-4 text-center text-sm text-neutral-500">
              請拖動拉桿，表示兩張圖在成效感覺上的差距
            </div>

            <div className="mb-3 flex items-center justify-between text-xs text-neutral-500">
              <span>A 成效較佳</span>
              <span>B 成效較佳</span>
            </div>

            <input
              type="range"
              min={-4}
              max={4}
              step={1}
              value={slider}
              onChange={(e) => setSlider(Number(e.target.value))}
              className="w-full"
            />

            <div className="mt-3 text-center text-sm font-medium text-neutral-800">
              {sliderLabels[sliderIndex]}
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm">
              <div>目前 slider 值：{slider}</div>
              <div>
                套用後：
                {slider < 0
                  ? ` A 勝，分差 ${Math.abs(slider)}`
                  : slider > 0
                  ? ` B 勝，分差 ${slider}`
                  : " 平手"}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={handlePrev}
                disabled={history.length === 0}
                className="rounded-xl bg-neutral-300 px-4 py-2.5 text-neutral-900 disabled:opacity-50"
              >
                上一題
              </button>

              <button
                onClick={() => applyVote(slider)}
                className="rounded-xl bg-black px-5 py-2.5 text-white transition hover:opacity-90"
              >
                下一題
              </button>
            </div>
          </div>

          <div className="rounded-[28px] border border-neutral-300 bg-white p-3 shadow-sm">
            <div className="mb-3 text-center text-sm font-medium text-neutral-500">
              B 圖
            </div>

            <div className="mb-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <div>檔名：{getFileName(rightItem.imageUrl)}</div>
              <div>ID：{rightItem.id}</div>
              <div>目前積分：{rightItem.swissPoints}</div>
              <div>目前總分差：{rightItem.totalMargin}</div>
              <div>平均分差：{getAverageMargin(rightItem).toFixed(2)}</div>
              <div>比較次數：{rightItem.matches}</div>
            </div>

            <div className="flex h-[520px] items-center justify-center overflow-hidden rounded-[22px] bg-neutral-100">
              <img
                src={rightItem.imageUrl}
                alt={`Post ${rightItem.id}`}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            </div>
          </div>

          <div className="rounded-[28px] border border-neutral-300 bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-neutral-900">
              即時排行榜 Top 10
            </div>

            <div className="space-y-2 text-sm">
              {ranking.slice(0, 10).map((item, index) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 p-2"
                >
                  <div className="font-medium">
                    #{index + 1}　{getFileName(item.imageUrl)}
                  </div>
                  <div className="text-neutral-600">ID：{item.id}</div>
                  <div className="text-neutral-600">
                    積分：{item.swissPoints}｜總分差：{item.totalMargin}
                  </div>
                  <div className="text-neutral-600">
                    平均分差：{getAverageMargin(item).toFixed(2)}｜次數：
                    {item.matches}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}