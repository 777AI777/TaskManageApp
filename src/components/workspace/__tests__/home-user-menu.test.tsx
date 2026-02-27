import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomeUserMenu } from "@/components/workspace/home-user-menu";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  upsert: vi.fn(),
  from: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signOut: mocks.signOut,
      signInWithPassword: mocks.signInWithPassword,
      updateUser: mocks.updateUser,
    },
    from: mocks.from,
  }),
}));

describe("HomeUserMenu", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.refresh.mockReset();
    mocks.signOut.mockReset();
    mocks.signInWithPassword.mockReset();
    mocks.updateUser.mockReset();
    mocks.upsert.mockReset();
    mocks.from.mockReset();

    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mocks.updateUser.mockResolvedValue({ data: { user: { email: "user@example.com" } }, error: null });
    mocks.upsert.mockResolvedValue({ error: null });
  });

  async function openProfileModal() {
    const user = userEvent.setup();
    render(
      <HomeUserMenu userId="user-1" initialEmail="user@example.com" initialDisplayName="User Name" />,
    );

    await user.click(screen.getByRole("button", { name: "U" }));
    await user.click(screen.getByRole("menuitem", { name: "ユーザー設定" }));
    return user;
  }

  it("requires current password when changing password", async () => {
    const user = await openProfileModal();

    await user.click(screen.getByRole("button", { name: "新しいパスワードを設定" }));
    await user.type(screen.getByLabelText("新しいパスワード"), "new-password-123");
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "new-password-123");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByText("現在のパスワードを入力してください。")).toBeInTheDocument();
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("blocks update when current password is invalid", async () => {
    const user = await openProfileModal();
    mocks.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: { message: "Invalid login credentials" } });

    await user.click(screen.getByRole("button", { name: "新しいパスワードを設定" }));
    await user.type(screen.getByLabelText("新しいパスワード"), "new-password-123");
    await user.type(screen.getByLabelText("現在のパスワード"), "wrong-password");
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "new-password-123");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    expect(await screen.findByText("現在のパスワードが正しくありません。")).toBeInTheDocument();
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "wrong-password",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("updates password after re-authentication succeeds", async () => {
    const user = await openProfileModal();

    await user.click(screen.getByRole("button", { name: "新しいパスワードを設定" }));
    await user.type(screen.getByLabelText("新しいパスワード"), "new-password-123");
    await user.type(screen.getByLabelText("現在のパスワード"), "current-password-123");
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), "new-password-123");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "current-password-123",
      });
      expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-password-123" });
      expect(mocks.upsert).toHaveBeenCalled();
    });
  });

  it("does not require current password when updating display name only", async () => {
    const user = await openProfileModal();

    const displayNameInput = screen.getByLabelText("表示名");
    await user.clear(displayNameInput);
    await user.type(displayNameInput, "Renamed User");
    await user.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(mocks.signInWithPassword).not.toHaveBeenCalled();
      expect(mocks.updateUser).toHaveBeenCalledWith({ data: { display_name: "Renamed User" } });
      expect(mocks.upsert).toHaveBeenCalled();
    });
  });
});
