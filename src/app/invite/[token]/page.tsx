import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="surface w-full max-w-xl p-8">
        <p className="chip mb-4 inline-flex">招待リンク</p>
        <h1 className="text-2xl font-bold">ワークスペースに参加</h1>
        <p className="mt-2 text-sm muted">
          下のボタンからログインまたは新規登録後、自動的に招待承認を試行します。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href={`/login?invite=${token}`}>
            ログインして参加
          </Link>
          <Link className="btn btn-secondary" href={`/signup?invite=${token}`}>
            新規登録して参加
          </Link>
        </div>
      </section>
    </main>
  );
}
