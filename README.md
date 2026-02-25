# TaskManageApp

Supabase + Vercel で動作する、Trello再現の開発タスク管理アプリです。

## 実装済み機能

- 複数Workspace / Board / List / Card
- メール+パスワード認証、招待URLによる参加
- 権限: `workspace_admin` / `board_admin` / `member`
- カード詳細: 担当者、ラベル、優先度、期限、見積、コメント、チェックリスト、添付
- DnDによるカード移動（`dnd-kit`）
- 検索/フィルタ、カレンダービュー
- アクティビティ履歴、アプリ内通知
- Realtime同期とPresence在席表示
- 自動化ルール（代表トリガー/アクション）
- Vercel Cronによる自動化定期実行

## 技術スタック

- Next.js App Router + TypeScript
- Supabase: Auth / Postgres / RLS / Realtime / Storage
- Vercel: Hosting + Cron

## セットアップ

### 1. 環境変数

`.env.example` をコピーして `.env.local` を作成してください。

```bash
copy .env.example .env.local
```

設定値:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (例: `http://localhost:3000`)
- `AUTOMATION_CRON_SECRET` (Cronエンドポイント保護用)

### 2. Supabaseスキーマ適用

このリポジトリの初期スキーマ:

- `supabase/migrations/20260226000000_init.sql`

Supabase SQL Editor または CLI で適用してください。

CLIで自動適用する場合:

```bash
npm run db:init
```

必要な追加環境変数:

- `SUPABASE_PROJECT_REF`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_ACCESS_TOKEN` (任意。`supabase link` を使う場合に推奨)

### 3. 開発起動

```bash
npm install
npm run dev
```

## テスト

```bash
npm run test:unit
npm run test:e2e
```

## 主要API

- `POST /api/auth/invite`
- `POST /api/auth/invite/:token/accept`
- `POST /api/workspaces`
- `GET /api/workspaces/:id`
- `POST /api/workspaces/:id/boards`
- `PATCH /api/boards/:id`
- `POST /api/lists`
- `PATCH /api/lists/:id`
- `POST /api/cards`
- `PATCH /api/cards/:id`
- `POST /api/cards/:id/move`
- `POST /api/cards/:id/comments`
- `POST /api/cards/:id/checklists`
- `POST /api/cards/:id/attachments`
- `GET /api/search`
- `POST /api/automation/rules`
- `PATCH /api/automation/rules/:id`
- `POST /api/automation/rules/:id/toggle`
- `POST /api/automation/run` (Cron)

## デプロイ

`vercel.json` に `/api/automation/run` の15分Cronを設定済みです。
Vercelプロジェクトに同じ環境変数を設定してデプロイしてください。
