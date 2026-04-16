"use client";

import { useEffect, useMemo, useState } from "react";

type Post = {
  id: string;
  imageUrl: string;
};

type CompareTask = {
  left: Post;
  right: Post;
};

type HistoryEntry = {
  leftQueue: Post[];
  rightQueue: Post[];
  merged: Post[];
  completed: Post[][];
  pending: Post[][];
  result: "left" | "right" | "tie";
};

function shuffle<T>(array: T[]) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeCsvValue(value: string | number) {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function ThreadsImageSorter() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pending, setPending] = useState<Post[][]>([]);
  const [completed, setCompleted] = useState<Post[][]>([]);
  const [leftQueue, setLeftQueue] = useState<Post[]>([]);
  const [rightQueue, setRightQueue] = useState<Post[]>([]);
  const [merged, setMerged] = useState<Post[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);

  function initializeWithPosts(sourcePosts: Post[]) {
    const shuffled = shuffle(sourcePosts);
    setPosts(sourcePosts);
    setPending(shuffled.map((p) => [p]));
    setCompleted([]);
    setLeftQueue([]);
    setRightQueue([]);
    setMerged([]);
    setHistory([]);
    setReady(true);
  }

  async function loadImagesAndInitialize() {
    try {
      const res = await fetch("/api/images", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("讀取圖片清單失敗");
      }

      const ids: string[] = await res.json();

      const formatted = ids.map((id) => ({
        id,
        imageUrl: `/images/${id}.png`,
      }));

      initializeWithPosts(formatted);
    } catch (error) {
      console.error(error);
      setPosts([]);
      setPending([]);
      setCompleted([]);
      setLeftQueue([]);
      setRightQueue([]);
      setMerged([]);
      setHistory([]);
      setReady(true);
    }
  }

  useEffect(() => {
    loadImagesAndInitialize();
  }, []);

  useEffect(() => {
    if (!ready) return;

    if (
      leftQueue.length === 0 &&
      rightQueue.length === 0 &&
      merged.length === 0
    ) {
      if (pending.length >= 2) {
        const [a, b, ...rest] = pending;
        setLeftQueue(a);
        setRightQueue(b);
        setPending(rest);
        return;
      }

      if (pending.length === 1 && completed.length === 0) {
        return;
      }

      if (pending.length === 0 && completed.length === 1) {
        return;
      }

      if (pending.length === 0 && completed.length > 1) {
        setPending(completed);
        setCompleted([]);
        return;
      }

      if (pending.length === 1 && completed.length > 0) {
        setCompleted((prev) => [...prev, pending[0]]);
        setPending([]);
      }
    }
  }, [ready, pending, completed, leftQueue, rightQueue, merged]);

  const finishedRanking = useMemo(() => {
    if (
      pending.length === 1 &&
      completed.length === 0 &&
      leftQueue.length === 0 &&
      rightQueue.length === 0 &&
      merged.length === 0
    ) {
      return pending[0];
    }

    if (
      pending.length === 0 &&
      completed.length === 1 &&
      leftQueue.length === 0 &&
      rightQueue.length === 0 &&
      merged.length === 0
    ) {
      return completed[0];
    }

    return null;
  }, [pending, completed, leftQueue, rightQueue, merged]);

  const currentTask: CompareTask | null =
    leftQueue.length > 0 && rightQueue.length > 0
      ? {
          left: leftQueue[0],
          right: rightQueue[0],
        }
      : null;

  const totalGroups =
    pending.length +
    completed.length +
    (leftQueue.length || rightQueue.length || merged.length ? 1 : 0);

  function saveHistory(result: "left" | "right" | "tie") {
    setHistory((prev) => [
      ...prev,
      {
        leftQueue: [...leftQueue],
        rightQueue: [...rightQueue],
        merged: [...merged],
        completed: completed.map((group) => [...group]),
        pending: pending.map((group) => [...group]),
        result,
      },
    ]);
  }

  function finalizeCurrentMerge(
    newLeftQueue: Post[],
    newRightQueue: Post[],
    newMerged: Post[]
  ) {
    const finalMerged = [...newMerged, ...newLeftQueue, ...newRightQueue];
    setLeftQueue([]);
    setRightQueue([]);
    setMerged([]);
    setCompleted((prev) => [...prev, finalMerged]);
  }

  function chooseLeft() {
    if (!currentTask) return;
    saveHistory("left");

    const nextMerged = [...merged, leftQueue[0]];
    const nextLeftQueue = leftQueue.slice(1);
    const nextRightQueue = [...rightQueue];

    if (nextLeftQueue.length === 0 || nextRightQueue.length === 0) {
      finalizeCurrentMerge(nextLeftQueue, nextRightQueue, nextMerged);
      return;
    }

    setMerged(nextMerged);
    setLeftQueue(nextLeftQueue);
    setRightQueue(nextRightQueue);
  }

  function chooseRight() {
    if (!currentTask) return;
    saveHistory("right");

    const nextMerged = [...merged, rightQueue[0]];
    const nextLeftQueue = [...leftQueue];
    const nextRightQueue = rightQueue.slice(1);

    if (nextLeftQueue.length === 0 || nextRightQueue.length === 0) {
      finalizeCurrentMerge(nextLeftQueue, nextRightQueue, nextMerged);
      return;
    }

    setMerged(nextMerged);
    setLeftQueue(nextLeftQueue);
    setRightQueue(nextRightQueue);
  }

  function chooseTie() {
    if (!currentTask) return;
    saveHistory("tie");

    const nextMerged = [...merged, leftQueue[0], rightQueue[0]];
    const nextLeftQueue = leftQueue.slice(1);
    const nextRightQueue = rightQueue.slice(1);

    if (nextLeftQueue.length === 0 || nextRightQueue.length === 0) {
      finalizeCurrentMerge(nextLeftQueue, nextRightQueue, nextMerged);
      return;
    }

    setMerged(nextMerged);
    setLeftQueue(nextLeftQueue);
    setRightQueue(nextRightQueue);
  }

  function handlePrev() {
    const last = history[history.length - 1];
    if (!last) return;

    setLeftQueue(last.leftQueue);
    setRightQueue(last.rightQueue);
    setMerged(last.merged);
    setCompleted(last.completed);
    setPending(last.pending);
    setHistory((prev) => prev.slice(0, -1));
  }

  function handleRestart() {
    if (posts.length > 0) {
      initializeWithPosts(posts);
    } else {
      loadImagesAndInitialize();
    }
  }

  function handleExportCsv() {
    if (!finishedRanking) return;

    const participantRaw =
      typeof window !== "undefined"
        ? localStorage.getItem("participant_profile")
        : null;

    const participant = participantRaw
      ? JSON.parse(participantRaw)
      : {
          participantId: "",
          age: "",
          gender: "",
          threadsFrequency: "",
          dailyUsageMinutes: "",
          postingFrequency: "",
        };

    const header = [
      "participantId",
      "age",
      "gender",
      "threadsFrequency",
      "dailyUsageMinutes",
      "postingFrequency",
      "rank",
      "id",
      "imageUrl",
    ];

    const rows = finishedRanking.map((item, index) => [
      participant.participantId,
      participant.age,
      participant.gender,
      participant.threadsFrequency,
      participant.dailyUsageMinutes,
      participant.postingFrequency,
      index + 1,
      item.id,
      item.imageUrl,
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
    a.download = `threads-complete-ranking-${
      participant.participantId || "unknown"
    }-${timestamp}.csv`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg">
        載入中...
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <div className="text-xl font-semibold">找不到圖片</div>
        <div className="text-sm text-neutral-500">
          請確認 /public/images 內有 .png 檔案，且 /api/images 可正常讀取。
        </div>
        <button
          onClick={handleRestart}
          className="rounded-xl bg-black px-4 py-2.5 text-white"
        >
          重新嘗試
        </button>
      </div>
    );
  }

  if (finishedRanking) {
    return (
      <main className="min-h-screen bg-neutral-100 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">排序結果</h1>
              <p className="mt-2 text-sm text-neutral-600">
                已完成完整排序。這份結果是完整名次，不是單純配對加分。
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                總比較次數：{history.length}
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
            {finishedRanking.map((post, index) => (
              <div
                key={post.id}
                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
                  <div className="font-bold text-neutral-900">#{index + 1}</div>
                  <div className="text-xs text-neutral-500">ID {post.id}</div>
                </div>

                <div className="flex h-[240px] items-center justify-center bg-neutral-50 p-3">
                  <img
                    src={post.imageUrl}
                    alt={`Post ${post.id}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (!currentTask) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg">
        配對中...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-6 md:px-6 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
            Threads Image Sorter
          </h1>
          <p className="mt-3 text-sm text-neutral-600 md:text-base">
            完整排序模式：用人工比較完成真正的完整排名
          </p>
          <p className="mt-3 text-lg font-medium text-neutral-800">
            已比較 {history.length} 次　・　目前待合併群組：{totalGroups}
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px_1fr] md:items-center md:gap-6">
          <button
            type="button"
            onClick={chooseLeft}
            className="rounded-[28px] border border-neutral-300 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 text-center text-sm font-medium text-neutral-500">
              左邊較佳
            </div>
            <div className="flex h-[520px] items-center justify-center overflow-hidden rounded-[22px] bg-neutral-100">
              <img
                src={currentTask.left.imageUrl}
                alt={`Post ${currentTask.left.id}`}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            </div>
          </button>

          <div className="rounded-[28px] border border-neutral-300 bg-white p-5 shadow-sm">
            <div className="text-center text-sm text-neutral-500">
              請選擇哪一張圖片的成效感覺較好
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={chooseTie}
                className="rounded-xl bg-neutral-500 px-4 py-3 text-white transition hover:opacity-90"
              >
                看不出來 / 差不多
              </button>

              <button
                onClick={handlePrev}
                disabled={history.length === 0}
                className="rounded-xl bg-neutral-300 px-4 py-3 text-neutral-900 disabled:opacity-50"
              >
                上一題
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={chooseRight}
            className="rounded-[28px] border border-neutral-300 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 text-center text-sm font-medium text-neutral-500">
              右邊較佳
            </div>
            <div className="flex h-[520px] items-center justify-center overflow-hidden rounded-[22px] bg-neutral-100">
              <img
                src={currentTask.right.imageUrl}
                alt={`Post ${currentTask.right.id}`}
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}