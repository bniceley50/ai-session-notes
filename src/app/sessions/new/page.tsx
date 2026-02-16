"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
/**
 * New Session page - generates a UUID and redirects to the session detail page
 * This allows ALLOW_SESSION_AUTOCREATE to create the session on first access
 */
export default function NewSessionPage() {
  const router = useRouter();

  useEffect(() => {
    // Generate a new UUID for the session
    const sessionId = crypto.randomUUID();

    // Redirect to the new session page
    router.replace(`/sessions/${sessionId}`);
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
        <p className="text-sm text-slate-600">Creating new session...</p>
      </div>
    </div>
  );
}

