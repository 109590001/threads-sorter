"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

export default function ThreadsImageSorter() {
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [pending, setPending] = useState<Post[][]>([]);
  const [completed, setCompleted] = useState<Post[][]>([]);
  const [leftQueue, setLeftQueue] = useState<Post[]>([]);
  const [rightQueue, setRightQueue] = useState<Post[]>([]);
  const [merged, setMerged] = useState<Post[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [savedToSupabase, setSavedToSupabase] = useState(false);

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
    setSavedToSupabase(false);
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
      setSavedToSupabase(false);
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

  const estimatedTotalComparisons = useMemo(() => {
    const n = posts.length;
    if (n <= 1) return 0;

    const m = Math.ceil(Math.log2(n));
    return n * m - 2 ** m + 1;
  }, [posts.length]);

  const completedComparisons = history.length;

  const progressPercent =
    estimatedTotalComparisons > 0
      ? Math.min(
        100,
        Math.round((completedComparisons / estimatedTotalComparisons) * 100)
      )
      : 0;

  const remainingComparisons = Math.max(
    estimatedTotalComparisons - completedComparisons,
    0
  );

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

  async function saveResultsToSupabase() {
    if (!finishedRanking || savedToSupabase) return;

    const sessionId =
      typeof window !== "undefined"
        ? localStorage.getItem("participant_session_id")
        : null;

    if (!sessionId) {
      console.warn("找不到 participant_session_id");
      return;
    }

    const rankingRows = finishedRanking.map((item, index) => ({
      session_id: sessionId,
      rank: index + 1,
      image_id: String(item.id),
      image_url: String(item.imageUrl ?? ""),
    }));

    const invalidRow = rankingRows.find(
      (row) =>
        !row.session_id ||
        !row.rank ||
        !row.image_id.trim() ||
        !row.image_url.trim()
    );

    if (invalidRow) {
      console.error("ranking_results payload 有缺值", invalidRow);
      console.error("完整 rankingRows:", rankingRows);
      return;
    }

    const { error: deleteError, status: deleteStatus } = await supabase
      .from("ranking_results")
      .delete()
      .eq("session_id", sessionId);

    if (deleteError) {
      console.error("刪除舊 ranking_results 失敗");
      console.error("delete status:", deleteStatus);
      console.error("delete error raw:", deleteError);
      console.error("delete error json:", JSON.stringify(deleteError, null, 2));
      return;
    }

    const {
      data: insertData,
      error: insertError,
      status: insertStatus,
      statusText: insertStatusText,
    } = await supabase
      .from("ranking_results")
      .insert(rankingRows)
      .select();

    if (insertError) {
      console.error("寫入 ranking_results 失敗");
      console.error("insert status:", insertStatus);
      console.error("insert statusText:", insertStatusText);
      console.error("rankingRows:", rankingRows);
      console.error("insert error raw:", insertError);
      console.error("insert error json:", JSON.stringify(insertError, null, 2));
      return;
    }

    console.log("ranking_results 寫入成功", insertData);

    const {
      error: updateError,
      status: updateStatus,
      statusText: updateStatusText,
    } = await supabase
      .from("participant_sessions")
      .update({
        total_comparisons: history.length,
      })
      .eq("id", sessionId);

    if (updateError) {
      console.error("更新 participant_sessions 失敗");
      console.error("update status:", updateStatus);
      console.error("update statusText:", updateStatusText);
      console.error("update error raw:", updateError);
      console.error("update error json:", JSON.stringify(updateError, null, 2));
      return;
    }

    setSavedToSupabase(true);
  }

  useEffect(() => {
    if (finishedRanking && !savedToSupabase) {
      saveResultsToSupabase();
    }
  }, [finishedRanking, savedToSupabase]);

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
      <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
        <div className="w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold text-neutral-900">排序完成</h1>

          <p className="mt-3 text-sm leading-6 text-neutral-600">
            你已完成本次圖片排序，可以前往結果頁查看完整排名。
          </p>

          <p className="mt-2 text-sm text-neutral-500">
            總比較次數：{completedComparisons}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => router.push("/result")}
              className="rounded-xl bg-black px-5 py-3 text-white transition hover:opacity-90"
            >
              查看結果
            </button>
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
          <p className="mt-3 text-lg font-medium text-neutral-800">
            請選擇哪一張圖片的成效感覺較好
          </p>
          <p className="mt-3 text-lg font-medium text-neutral-800">
            已比較 {completedComparisons} 次，預計比較次數：70
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_320px_1fr] md:items-center md:gap-6">
          <button
            type="button"
            onClick={chooseLeft}
            className="rounded-[28px] border border-neutral-300 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-2 text-center text-sm font-medium text-neutral-500">
              這邊較佳
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
              這邊較佳
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