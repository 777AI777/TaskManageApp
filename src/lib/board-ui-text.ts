export type BoardVisibility = "private" | "workspace" | "public";
export type BoardRole = "workspace_admin" | "board_admin" | "member";

export const BOARD_VISIBILITY_LABELS: Record<BoardVisibility, string> = {
  private: "非公開",
  workspace: "ワークスペース内",
  public: "公開",
};

export const BOARD_ROLE_LABELS: Record<BoardRole, string> = {
  workspace_admin: "ワークスペース管理者",
  board_admin: "ボード管理者",
  member: "メンバー",
};

export const BOARD_COMMON_LABELS = {
  boardName: "ボード名",
  boardNameEdit: "ボード名を変更",
  boards: "ボード",
  workspace: "ワークスペース",
  noDescription: "説明はありません。",
  unknown: "不明",
  publicUrl: "公開URL",
  user: "ユーザー",
} as const;

export const BOARD_ERROR_MESSAGES = {
  createBoard: "ボードの作成に失敗しました。",
  createList: "リストの作成に失敗しました。",
  createCard: "カードの作成に失敗しました。",
  archiveList: "リストのアーカイブに失敗しました。",
  updateBoardVisibility: "公開範囲の更新に失敗しました。",
  boardNameTooShort: "ボード名は2文字以上で入力してください。",
  renameBoard: "ボード名の変更に失敗しました。",
  updateDashboardTiles: "ダッシュボードの更新に失敗しました。",
  moveCard: "カードの移動に失敗しました。",
} as const;

export const CARD_DETAIL_ERROR_MESSAGES = {
  updateCard: "カードの更新に失敗しました。",
  saveTitle: "タイトルの保存に失敗しました。",
  saveDescription: "説明の保存に失敗しました。",
  saveMembers: "メンバーの保存に失敗しました。",
  saveLabels: "ラベルの保存に失敗しました。",
  saveDates: "日付の保存に失敗しました。",
  saveLocation: "場所の保存に失敗しました。",
  updateCustomFields: "カスタムフィールドの更新に失敗しました。",
  updateWatchState: "ウォッチ状態の更新に失敗しました。",
  updateCompletion: "完了状態の更新に失敗しました。",
  updateArchiveState: "アーカイブ状態の更新に失敗しました。",
  createComment: "コメントの作成に失敗しました。",
  createChecklist: "チェックリストの作成に失敗しました。",
  createChecklistItem: "チェックリスト項目の作成に失敗しました。",
  updateChecklistItem: "チェックリスト項目の更新に失敗しました。",
  uploadAttachment: "添付ファイルのアップロードに失敗しました。",
  getAttachmentUrl: "添付ファイルのURL取得に失敗しました。",
} as const;

export function booleanLabel(value: boolean): string {
  return value ? "はい" : "いいえ";
}
