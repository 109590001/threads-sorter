"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

type FormDataType = {
    age: string;
    gender: string;
    threadsFrequency: string;
    dailyUsageMinutes: string;
    postingFrequency: string;
};

const initialForm: FormDataType = {
    age: "",
    gender: "",
    threadsFrequency: "",
    dailyUsageMinutes: "",
    postingFrequency: "",
};

export default function IntakePage() {
    const router = useRouter();
    const [form, setForm] = useState<FormDataType>(initialForm);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    function updateField<K extends keyof FormDataType>(
        key: K,
        value: FormDataType[K]
    ) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");

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

        setSubmitting(true);

        try {
            const participantId = uuidv4();
            const payload = {
                participant_code: participantId,
                age: form.age,
                gender: form.gender,
                threads_frequency: form.threadsFrequency,
                daily_usage_minutes: form.dailyUsageMinutes,
                posting_frequency: form.postingFrequency,
                dataset_version: "words_v1",
            };
            const { data, error } = await supabase
                .from("wordsort_participant_sessions")
                .insert(payload)
                .select()
                .single();
            if (error || !data) {
                console.error("supabase insert failed");
                console.error("insert payload:", payload);
                console.error("supabase insert error:", error);
                console.error(
                    "supabase insert error json:",
                    JSON.stringify(error, null, 2)
                );

                setError(error?.message || "資料送出失敗，請稍後再試");
                return;
            }

            const profile = {
                participantId: data.participant_code ?? data.participant_id,
                age: form.age,
                gender: form.gender,
                threadsFrequency: form.threadsFrequency,
                dailyUsageMinutes: form.dailyUsageMinutes,
                postingFrequency: form.postingFrequency,
                submittedAt: new Date().toISOString(),
            };

            localStorage.setItem("participant_session_id", data.id);
            localStorage.setItem("participant_profile", JSON.stringify(profile));

            router.push("/wordsort");
        } catch (err) {
            console.error("handleSubmit unexpected error:", err);
            setError("資料送出失敗，請稍後再試");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-neutral-100 px-4 py-8 md:px-6 md:py-12">
            <div className="mb-6 rounded-2xl border border-black/10 bg-white p-5 text-sm leading-relaxed">
                <h1 className="text-2xl font-bold text-neutral-900">作答說明</h1>

                <ul className="space-y-2 text-black/80">
                    <li>
                        請判斷哪一篇貼文更可能在 Threads 上爆紅（獲得更高互動）
                        <br />
                        <span className="text-black/50">
                            （爆紅定義：更可能被按讚、留言、轉發或擴散）
                        </span>
                    </li>

                    <li>
                        請以貼文本身呈現為準，不需考慮品牌粉絲數或個人喜好
                    </li>

                    <li>
                        若真的看不出差異，可選擇「看不出來／差不多」
                    </li>

                    <li>
                        測驗最後會產生你的貼文排名，你可以再手動調整一次心目中的爆紅名次，
                        並按下「送出」，測驗方算完成
                    </li>
                </ul>
            </div>
            <div className="mx-auto max-w-2xl rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm md:p-8">
                <h1 className="text-2xl font-bold text-neutral-900">受試者基本資料</h1>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                    請先填寫基本資料，再開始圖片比較任務。所有欄位皆為必填。
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                    <Field label="年齡" required>
                        <select
                            required
                            value={form.age}
                            onChange={(e) => updateField("age", e.target.value)}
                            className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-500"
                        >
                            <option value="" disabled>
                                請選擇
                            </option>
                            <option value="18以下">18以下</option>
                            <option value="18-24">18-24</option>
                            <option value="25-34">25-34</option>
                            <option value="35-44">35-44</option>
                            <option value="45-54">45-54</option>
                            <option value="55以上">55以上</option>
                        </select>
                    </Field>

                    <Field label="性別" required>
                        <select
                            required
                            value={form.gender}
                            onChange={(e) => updateField("gender", e.target.value)}
                            className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-500"
                        >
                            <option value="" disabled>
                                請選擇
                            </option>
                            <option value="男">男</option>
                            <option value="女">女</option>
                            <option value="非二元 / 多元性別">非二元 / 多元性別</option>
                            <option value="不願透露">不願透露</option>
                        </select>
                    </Field>

                    <Field label="你使用 Threads 的頻率" required>
                        <select
                            required
                            value={form.threadsFrequency}
                            onChange={(e) => updateField("threadsFrequency", e.target.value)}
                            className="w-full rounded-xl border border-neutral-300 px-4 py-3 outline-none transition focus:border-neutral-500"
                        >
                            <option value="" disabled>
                                請選擇
                            </option>
                            <option value="幾乎每天">幾乎每天</option>
                            <option value="每週數次">每週數次</option>
                            <option value="每週一次左右">每週一次左右</option>
                            <option value="每月數次">每月數次</option>
                            <option value="幾乎不用">幾乎不用</option>
                        </select>
                    </Field>

                    {error ? (
                        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                            {error}
                        </div>
                    ) : null}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full rounded-2xl bg-black px-5 py-3.5 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {submitting ? "送出中..." : "開始測驗"}
                    </button>
                </form>
            </div>
        </main>
    );
}

function Field({
    label,
    required = false,
    children,
}: {
    label: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    return (
        <label className="block">
            <div className="mb-2 text-sm font-medium text-neutral-800">
                {required ? <span className="mr-1 text-red-500">*</span> : null}
                {label}
            </div>
            {children}
        </label>
    );
}