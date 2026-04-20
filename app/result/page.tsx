"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Row = {
  rank: number;
  image_id: string;
  image_url: string;
};

function swapItems<T>(arr: T[], i: number, j: number) {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export default function ResultPage() {
  const router = useRouter();

  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const savedSessionId = localStorage.getItem("participant_session_id");
      setSessionId(savedSessionId);

      if (!savedSessionId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("ranking_results")
        .select("*")
        .eq("session_id", savedSessionId)
        .order("rank", { ascending: true });

      if (!error && data) {
        setData(data);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  function moveUp(index: number) {
    if (index === 0) return;

    const swapped = swapItems(data, index, index - 1).map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    setData(swapped);
  }

  function moveDown(index: number) {
    if (index === data.length - 1) return;

    const swapped = swapItems(data, index, index + 1).map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

    setData(swapped);
  }

  async function handleConfirm() {
    if (!sessionId || data.length === 0) return;

    setSaving(true);

    const results = await Promise.all(
      data.map((item, index) =>
        supabase
          .from("ranking_results")
          .update({ rank: index + 1 })
          .eq("session_id", sessionId)
          .eq("image_id", item.image_id)
      )
    );

    const hasError = results.some((r) => r.error);

    if (hasError) {
      console.error("更新最終排序失敗", results);
      setSaving(false);
      alert("儲存失敗，請稍後再試");
      return;
    }

    localStorage.removeItem("participant_session_id");
    router.push("/intake");
  }

  if (loading) {
    return <div className="p-10 text-center">載入中...</div>;
  }

  if (data.length === 0) {
    return <div className="p-10 text-center">找不到結果</div>;
  }

  return (
    <main className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">你的排序結果</h1>
          <div className="text-sm text-neutral-500">
            可用箭頭微調，確認後才會儲存
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {data.map((item, index) => (
            <div
              key={item.image_id}
              className="rounded-xl bg-white p-3 shadow"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="font-bold">#{index + 1}</div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0 || saving}
                    className="rounded-md border px-2 py-1 text-sm disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === data.length - 1 || saving}
                    className="rounded-md border px-2 py-1 text-sm disabled:opacity-30"
                  >
                    ↓
                  </button>
                </div>
              </div>

              <img
                src={item.image_url}
                alt={item.image_id}
                className="h-[200px] w-full object-contain"
              />
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="rounded-xl bg-black px-6 py-3 text-white disabled:opacity-50"
          >
            {saving ? "儲存中..." : "確定排序"}
          </button>
        </div>
      </div>
    </main>
  );
}