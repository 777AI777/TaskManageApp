import { EmailAuthForm } from "@/components/auth/email-auth-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="surface w-full max-w-md p-8">
        <p className="chip mb-4 inline-flex">TaskManageApp</p>
        <h1 className="text-2xl font-bold">ログイン</h1>
        <p className="mt-1 mb-6 text-sm muted">
          開発チームのワークスペースに参加して、タスクボードを管理します。
        </p>
        <EmailAuthForm mode="login" />
      </section>
    </main>
  );
}
