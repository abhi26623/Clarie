"use client";

import { useEffect } from "react";

export function DemoLogoutRedirect({ returnTo }: { returnTo: string }) {
  useEffect(() => {
    fetch(`/api/demo-logout?returnTo=${encodeURIComponent(returnTo)}`, {
      method: "POST",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          window.location.href = returnTo;
        }
      })
      .catch(() => {
        window.location.href = returnTo;
      });
  }, [returnTo]);

  return (
    <main className="container p-10 flex flex-col items-center justify-center text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
      <p className="text-ink-secondary">Logging out of demo account...</p>
    </main>
  );
}
