"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ThreadsImageSorter from "@/components/ThreadsImageSorter";

export default function Page() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const sessionId = localStorage.getItem("participant_session_id");

    if (!sessionId) {
      router.replace("/intake");
      return;
    }

    setChecked(true);
  }, [router]);

  if (!checked) {
    return null;
  }

  return <ThreadsImageSorter />;
}