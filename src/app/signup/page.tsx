import { EmailAuthForm } from "@/components/auth/email-auth-form";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="surface w-full max-w-md p-8">
        <p className="chip mb-4 inline-flex">TaskManageApp</p>
        <h1 className="text-2xl font-bold">新規登録</h1>
        <p className="mt-1 mb-6 text-sm muted">
          招待を受けたメールで登録すると、ワークスペースに参加できます。
        </p>
        <EmailAuthForm mode="signup" />
      </section>
    </main>
  );
}
