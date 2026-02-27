"use client";

import type { UserAttributes } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { resolveAvatarColor } from "@/lib/avatar-color";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type HomeUserMenuProps = {
  userId: string;
  initialEmail: string;
  initialDisplayName: string | null;
  initialAvatarColor?: string | null;
  menuMetaText?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_COLOR_OPTIONS = [
  "#0C66E4",
  "#1D7AFC",
  "#14B8A6",
  "#0EA5E9",
  "#16A34A",
  "#F97316",
  "#E11D48",
  "#DB2777",
  "#7C3AED",
  "#4F46E5",
] as const;

function resolveDisplayName(displayName: string | null, email: string) {
  const trimmed = displayName?.trim();
  if (trimmed) return trimmed;
  const fallback = email.split("@")[0]?.trim();
  return fallback || "User";
}

export function HomeUserMenu({
  userId,
  initialEmail,
  initialDisplayName,
  initialAvatarColor,
  menuMetaText,
}: HomeUserMenuProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const normalizedInitialEmail = initialEmail.trim();
  const fallbackName = resolveDisplayName(initialDisplayName, normalizedInitialEmail);
  const fallbackAvatarColor = resolveAvatarColor(initialAvatarColor);

  const [currentDisplayName, setCurrentDisplayName] = useState(fallbackName);
  const [currentEmail, setCurrentEmail] = useState(normalizedInitialEmail);
  const [currentAvatarColor, setCurrentAvatarColor] = useState(fallbackAvatarColor);

  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [displayNameInput, setDisplayNameInput] = useState(fallbackName);
  const [emailInput, setEmailInput] = useState(normalizedInitialEmail);
  const [avatarColorInput, setAvatarColorInput] = useState(fallbackAvatarColor);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordConfirmInput, setPasswordConfirmInput] = useState("");

  const userInitial = (currentDisplayName || currentEmail || "U").trim().charAt(0).toUpperCase() || "U";
  const avatarColor = resolveAvatarColor(currentAvatarColor);
  const normalizedEmailInput = emailInput.trim();
  const hasPendingChanges =
    displayNameInput.trim() !== currentDisplayName ||
    normalizedEmailInput.toLowerCase() !== currentEmail.toLowerCase() ||
    resolveAvatarColor(avatarColorInput).toLowerCase() !== resolveAvatarColor(currentAvatarColor).toLowerCase() ||
    passwordInput.length > 0;

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!profileOpen) return;
    const previousOverflow = document.body.style.overflow;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) {
        setProfileOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isSaving, profileOpen]);

  function openProfileModal() {
    setDisplayNameInput(currentDisplayName);
    setEmailInput(currentEmail);
    setAvatarColorInput(currentAvatarColor);
    setShowPasswordForm(false);
    setCurrentPasswordInput("");
    setPasswordInput("");
    setPasswordConfirmInput("");
    setError(null);
    setSuccess(null);
    setMenuOpen(false);
    setProfileOpen(true);
  }

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const nextDisplayName = displayNameInput.trim();
    const nextEmail = normalizedEmailInput;
    const nextCurrentPassword = currentPasswordInput;
    const nextPassword = passwordInput;
    const nextAvatarColor = resolveAvatarColor(avatarColorInput);
    const currentEmailForReauth = currentEmail.trim();
    const emailChanged = nextEmail.toLowerCase() !== currentEmail.toLowerCase();

    setError(null);
    setSuccess(null);

    if (!nextDisplayName) {
      setError("表示名を入力してください。");
      return;
    }
    if (!EMAIL_PATTERN.test(nextEmail)) {
      setError("メールアドレスの形式が正しくありません。");
      return;
    }
    if (nextPassword && nextPassword.length < 8) {
      setError("新しいパスワードは8文字以上で入力してください。");
      return;
    }
    if (nextPassword && nextPassword !== passwordConfirmInput) {
      setError("確認用パスワードが一致しません。");
      return;
    }
    if (nextPassword && !nextCurrentPassword) {
      setError("現在のパスワードを入力してください。");
      return;
    }
    if (nextPassword && !currentEmailForReauth) {
      setError("パスワード変更には再ログインが必要です。ログアウト後に再度お試しください。");
      return;
    }
    if (!hasPendingChanges) {
      setSuccess("変更はありません。");
      return;
    }

    const authUpdates: UserAttributes = {};
    if (nextDisplayName !== currentDisplayName) {
      authUpdates.data = { display_name: nextDisplayName };
    }
    if (emailChanged) {
      authUpdates.email = nextEmail;
    }
    if (nextPassword) {
      authUpdates.password = nextPassword;
    }

    setIsSaving(true);

    try {
      if (nextPassword) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: currentEmailForReauth,
          password: nextCurrentPassword,
        });
        if (reauthError) {
          throw new Error("現在のパスワードが正しくありません。");
        }
      }

      let emailChangePending = false;

      if (Object.keys(authUpdates).length > 0) {
        const { data, error: authError } = await supabase.auth.updateUser(authUpdates);
        if (authError) {
          throw new Error(authError.message);
        }

        const updatedEmail = data.user?.email?.trim() ?? currentEmail;
        if (emailChanged && updatedEmail.toLowerCase() !== nextEmail.toLowerCase()) {
          emailChangePending = true;
        }
      }

      const profileEmail = emailChangePending ? currentEmail : nextEmail;

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            email: profileEmail,
            display_name: nextDisplayName,
            avatar_color: nextAvatarColor,
          },
          { onConflict: "id" },
        );
      if (profileError) {
        throw new Error(profileError.message);
      }

      setCurrentDisplayName(nextDisplayName);
      setCurrentEmail(profileEmail);
      setCurrentAvatarColor(nextAvatarColor);
      setDisplayNameInput(nextDisplayName);
      setEmailInput(profileEmail);
      setAvatarColorInput(nextAvatarColor);
      setShowPasswordForm(false);
      setCurrentPasswordInput("");
      setPasswordInput("");
      setPasswordConfirmInput("");

      if (emailChangePending) {
        setSuccess(`確認メールを ${nextEmail} に送信しました。メールのリンクを開くと変更が反映されます。`);
      } else {
        setSuccess("ユーザー情報を更新しました。");
      }

      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "ユーザー情報の更新に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          className="myTaskApp-home-avatar"
          style={{ backgroundColor: avatarColor }}
          type="button"
          title={currentEmail || currentDisplayName}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          {userInitial}
        </button>
        {menuOpen ? (
          <div
            className="absolute right-0 top-11 z-[100] w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl"
            role="menu"
          >
            <p className="text-sm font-semibold text-slate-900">{currentDisplayName}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{currentEmail}</p>
            {menuMetaText ? <p className="mt-1 text-[11px] tracking-wide text-slate-500">{menuMetaText}</p> : null}
            <div className="mt-3 space-y-2">
              <button
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                type="button"
                role="menuitem"
                onClick={openProfileModal}
              >
                ユーザー設定
              </button>
              <button
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                role="menuitem"
                onClick={signOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? "ログアウト中..." : "ログアウト"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {profileOpen ? (
        <div className="tm-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="user-profile-modal-title">
          <div className="tm-modal-card w-full max-w-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="user-profile-modal-title" className="text-lg font-semibold text-slate-900">
                ユーザー情報
              </h2>
              <button
                className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={() => setProfileOpen(false)}
                disabled={isSaving}
              >
                閉じる
              </button>
            </div>

            <form className="space-y-4" onSubmit={submitProfile}>
              <label className="block">
                <span className="block text-sm font-medium text-slate-700">表示名</span>
                <input
                  className="tm-modal-input mt-1"
                  type="text"
                  value={displayNameInput}
                  onChange={(event) => {
                    setDisplayNameInput(event.target.value);
                    setError(null);
                    setSuccess(null);
                  }}
                  maxLength={120}
                  autoComplete="name"
                />
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-slate-700">メールアドレス</span>
                <input
                  className="tm-modal-input mt-1"
                  type="email"
                  value={emailInput}
                  onChange={(event) => {
                    setEmailInput(event.target.value);
                    setError(null);
                    setSuccess(null);
                  }}
                  autoComplete="email"
                />
              </label>

              <div className="block">
                <span className="block text-sm font-medium text-slate-700">テーマカラー</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {AVATAR_COLOR_OPTIONS.map((color) => {
                    const selected = resolveAvatarColor(avatarColorInput).toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={color}
                        className={`h-8 w-8 rounded-full border-2 transition ${
                          selected ? "border-slate-900 ring-2 ring-slate-300" : "border-white hover:border-slate-300"
                        }`}
                        style={{ backgroundColor: color }}
                        type="button"
                        aria-label={`テーマカラー ${color}`}
                        aria-pressed={selected}
                        onClick={() => {
                          setAvatarColorInput(color);
                          setError(null);
                          setSuccess(null);
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {!showPasswordForm ? (
                <button
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(true);
                    setError(null);
                    setSuccess(null);
                  }}
                >
                  新しいパスワードを設定
                </button>
              ) : (
                <div className="space-y-4 rounded-md border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-700">パスワード変更</p>
                    <button
                      className="text-xs font-medium text-slate-500 hover:text-slate-700"
                      type="button"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setCurrentPasswordInput("");
                        setPasswordInput("");
                        setPasswordConfirmInput("");
                        setError(null);
                        setSuccess(null);
                      }}
                    >
                      変更をやめる
                    </button>
                  </div>

                  <label className="block">
                    <span className="block text-sm font-medium text-slate-700">現在のパスワード</span>
                    <input
                      className="tm-modal-input mt-1"
                      type="password"
                      value={currentPasswordInput}
                      onChange={(event) => {
                        setCurrentPasswordInput(event.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      autoComplete="current-password"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-sm font-medium text-slate-700">新しいパスワード</span>
                    <input
                      className="tm-modal-input mt-1"
                      type="password"
                      value={passwordInput}
                      onChange={(event) => {
                        setPasswordInput(event.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      autoComplete="new-password"
                      placeholder="変更しない場合は空欄"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-sm font-medium text-slate-700">新しいパスワード（確認）</span>
                    <input
                      className="tm-modal-input mt-1"
                      type="password"
                      value={passwordConfirmInput}
                      onChange={(event) => {
                        setPasswordConfirmInput(event.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      autoComplete="new-password"
                    />
                  </label>
                </div>
              )}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  disabled={isSaving}
                >
                  キャンセル
                </button>
                <button
                  className="rounded-md bg-[#0c66e4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0055cc] disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={isSaving || !hasPendingChanges}
                >
                  {isSaving ? "保存中..." : "保存する"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
