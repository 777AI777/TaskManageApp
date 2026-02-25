"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type Props = {
  mode: "login" | "signup";
};

export function EmailAuthForm({ mode }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inviteToken = searchParams.get("invite");
  const nextPath = searchParams.get("next") ?? "/app/workspaces";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || email.split("@")[0],
            },
          },
        });
        if (signUpError) {
          throw signUpError;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          throw signInError;
        }
      }

      if (inviteToken) {
        const response = await fetch(`/api/auth/invite/${inviteToken}/accept`, {
          method: "POST",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error?.message ?? "招待の承認に失敗しました。");
        }
      }

      router.push(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "認証に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="email">
          メールアドレス
        </label>
        <input
          id="email"
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      {mode === "signup" ? (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="displayName">
            表示名
          </label>
          <input
            id="displayName"
            className="input"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="例: yuki"
          />
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="password">
          パスワード
        </label>
        <input
          id="password"
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
        />
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button className="btn btn-primary w-full" type="submit" disabled={loading}>
        {loading ? "処理中..." : mode === "login" ? "ログイン" : "アカウント作成"}
      </button>

      <p className="text-center text-sm muted">
        {mode === "login" ? "アカウントが未作成の場合は " : "既にアカウントがある場合は "}
        <Link
          className="font-semibold text-blue-700 underline underline-offset-2"
          href={mode === "login" ? "/signup" : "/login"}
        >
          {mode === "login" ? "新規登録" : "ログイン"}
        </Link>
      </p>
    </form>
  );
}
