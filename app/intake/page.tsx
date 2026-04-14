"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type FormDataType = {
  participantId: string;
  age: string;
  gender: string;
  threadsFrequency: string;
  dailyUsageMinutes: string;
  postingFrequency: string;
  consent: boolean;
};

const initialForm: FormDataType = {
  participantId: "",
  age: "",
  gender: "",
  threadsFrequency: "",
  dailyUsageMinutes: "",
  postingFrequency: "",
  consent: false,
};

export default function IntakePage() {
  const router = useRouter();
  const [form, setForm] = useState<FormDataType>(initialForm);
  const [error, setError] = useState("");

  function updateField<K extends keyof FormDataType>(
    key: K,
    value: FormDataType[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!form.participantId.trim()) {
      setError("請輸入受試者編號");
      return;
    }

    if (!form.age) {
      setError("請選擇年齡");
      return;
    }

    if (!form.gender) {
      setError("請選擇性別");
      return;
    }

    if (!form.threadsFrequency) {
      setError("請選擇 Threads 使用頻率");
      return;
    }

    if (!form.dailyUsageMinutes) {
      setError("請選擇每日使用時間");
      return;
    }

    if (!form.postingFrequency) {
      setError("請選擇發文頻率");
      return;
    }

    if (!form.consent) {
      setError("請先勾選同意參與研究");
      return;
    }

    const payload = {
      ...form,
      submittedAt: new Date().toISOString(),
    };

    localStorage.setItem("participant_profile", JSON.stringify(payload));
    router.push("/sorter");
  }

  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-8 md:px-6 md:py-12">
      <div className="mx-auto max-w-2xl rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="text-2xl font-bold text-neutral-900">受試者基本資料</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-600">
          請先填寫基本資料，再開始圖片比較任務。
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <Field label="受試者編號">
            <input
              type="text"
              value={form.participantId}
              onChange={(e) => updateField("participantId", e.target.value)}
              placeholder="例如 P001"
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-500"
            />
          </Field>

          <Field label="年齡">
            <select
              value={form.age}
              onChange={(e) => updateField("age", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-500"
            >
              <option value="">請選擇</option>
              <option value="18以下">18以下</option>
              <option value="18-24">18-24</option>
              <option value="25-34">25-34</option>
              <option value="35-44">35-44</option>
              <option value="45-54">45-54</option>
              <option value="55以上">55以上</option>
            </select>
          </Field>

          <Field label="性別">
            <select
              value={form.gender}
              onChange={(e) => updateField("gender", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-500"
            >
              <option value="">請選擇</option>
              <option value="男">男</option>
              <option value="女">女</option>
              <option value="非二元 / 多元性別">非二元 / 多元性別</option>
              <option value="不願透露">不願透露</option>
            </select>
          </Field>

          <Field label="你使用 Threads 的頻率">
            <select
              value={form.threadsFrequency}
              onChange={(e) => updateField("threadsFrequency", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-500"
            >
              <option value="">請選擇</option>
              <option value="幾乎每天">幾乎每天</option>
              <option value="每週數次">每週數次</option>
              <option value="每週一次左右">每週一次左右</option>
              <option value="每月數次">每月數次</option>
              <option value="幾乎不用">幾乎不用</option>
            </select>
          </Field>

          <Field label="你每天平均使用 Threads 多久">
            <select
              value={form.dailyUsageMinutes}
              onChange={(e) => updateField("dailyUsageMinutes", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-500"
            >
              <option value="">請選擇</option>
              <option value="10分鐘以下">10分鐘以下</option>
              <option value="10-30分鐘">10-30分鐘</option>
              <option value="31-60分鐘">31-60分鐘</option>
              <option value="1-2小時">1-2小時</option>
              <option value="2小時以上">2小時以上</option>
            </select>
          </Field>

          <Field label="你在 Threads 的發文頻率">
            <select
              value={form.postingFrequency}
              onChange={(e) => updateField("postingFrequency", e.target.value)}
              className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-500"
            >
              <option value="">請選擇</option>
              <option value="幾乎每天發文">幾乎每天發文</option>
              <option value="每週數次發文">每週數次發文</option>
              <option value="偶爾發文">偶爾發文</option>
              <option value="很少發文">很少發文</option>
              <option value="幾乎不發文">幾乎不發文</option>
            </select>
          </Field>

          <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
            <input
              type="checkbox"
              checked={form.consent}
              onChange={(e) => updateField("consent", e.target.checked)}
              className="mt-1"
            />
            <span className="text-sm leading-6 text-neutral-700">
              我已了解本研究內容，並同意參與本次測驗。
            </span>
          </label>

          {error ? (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-2xl bg-black px-5 py-3.5 text-white transition hover:opacity-90"
          >
            開始測驗
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-neutral-800">{label}</div>
      {children}
    </label>
  );
}