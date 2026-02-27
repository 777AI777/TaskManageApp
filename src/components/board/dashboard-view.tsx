"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  BoardCard,
  BoardList,
  BoardMember,
  CardAssignee,
  CardLabel,
  DashboardTile,
  Label,
} from "@/components/board/board-types";

type Props = {
  cards: BoardCard[];
  lists: BoardList[];
  members: BoardMember[];
  labels: Label[];
  cardAssignees: CardAssignee[];
  cardLabels: CardLabel[];
  tiles: DashboardTile[];
  canEdit: boolean;
  onTilesChange: (tiles: DashboardTile[]) => Promise<void>;
};

type ChartDataset = Array<{ label: string; value: number; color?: string }>;
type ChartType = DashboardTile["chartType"];

const TILE_LIMIT = 12;
const CHART_CHOICES: Array<{ value: ChartType; label: string; icon: string }> = [
  { value: "bar", label: "棒グラフ", icon: "▁▆█" },
  { value: "pie", label: "円グラフ", icon: "◔" },
  { value: "line", label: "折れ線グラフ", icon: "╱╲" },
];

const METRIC_CHOICES: Array<{ value: DashboardTile["metric"]; label: string; title: string }> = [
  { value: "cards_per_list", label: "リスト別カード数", title: "リスト別カード数" },
  { value: "due_status", label: "期限別カード数", title: "期限別カード数" },
  { value: "cards_per_member", label: "メンバー別カード数", title: "メンバー別カード数" },
  { value: "cards_per_label", label: "ラベル別カード数", title: "ラベル別カード数" },
];

const DEFAULT_TILES: DashboardTile[] = [
  { id: "2cead1a3-7f6d-4d59-8d8f-1224fe631001", chartType: "bar", metric: "cards_per_list", title: "リスト別カード数", position: 0, size: "half" },
  { id: "2cead1a3-7f6d-4d59-8d8f-1224fe631002", chartType: "bar", metric: "due_status", title: "期限別カード数", position: 1, size: "half" },
  { id: "2cead1a3-7f6d-4d59-8d8f-1224fe631003", chartType: "bar", metric: "cards_per_member", title: "メンバー別カード数", position: 2, size: "half" },
  { id: "2cead1a3-7f6d-4d59-8d8f-1224fe631004", chartType: "pie", metric: "cards_per_label", title: "ラベル別カード数", position: 3, size: "half" },
];

function normalizeTiles(tiles: DashboardTile[]) {
  return [...tiles]
    .sort((a, b) => a.position - b.position)
    .map((tile, index) => ({ ...tile, position: index }));
}

function toArcPath(cx: number, cy: number, r: number, start: number, end: number) {
  const startX = cx + r * Math.cos(start);
  const startY = cy + r * Math.sin(start);
  const endX = cx + r * Math.cos(end);
  const endY = cy + r * Math.sin(end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

function chartColor(index: number) {
  const palette = ["#1f2937", "#1d4ed8", "#0ea5e9", "#16a34a", "#d97706", "#dc2626", "#9333ea"];
  return palette[index % palette.length];
}

function BarChart({ data }: { data: ChartDataset }) {
  if (!data.length) return <div className="tm-chart-empty">データがありません</div>;
  const width = 720;
  const height = 280;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const chartHeight = 200;
  const barWidth = Math.max(36, width / Math.max(data.length * 2, 8));
  const gap = barWidth * 0.6;

  return (
    <svg className="tm-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img">
      <line x1="56" y1="230" x2={width - 22} y2="230" stroke="#94a3b8" strokeWidth="1.2" />
      {data.map((item, index) => {
        const x = 68 + index * (barWidth + gap);
        const barHeight = (item.value / maxValue) * chartHeight;
        const y = 230 - barHeight;
        return (
          <g key={`${item.label}-${index}`}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={item.color ?? chartColor(index)}
              rx="6"
            />
            <text x={x + barWidth / 2} y="252" textAnchor="middle" className="tm-chart-label">
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PieChart({ data }: { data: ChartDataset }) {
  if (!data.length) return <div className="tm-chart-empty">データがありません</div>;
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <div className="tm-chart-empty">データがありません</div>;

  const slices = data.map((item, index) => {
    const prevSum = data.slice(0, index).reduce((sum, entry) => sum + entry.value, 0);
    const start = -Math.PI / 2 + (Math.PI * 2 * prevSum) / total;
    const end = start + (Math.PI * 2 * item.value) / total;
    return {
      item,
      index,
      path: toArcPath(110, 110, 88, start, end),
    };
  });

  return (
    <div className="tm-pie-wrap">
      <svg className="tm-pie-svg" viewBox="0 0 220 220" role="img">
        {slices.map((slice) => {
          return (
            <path
              key={`${slice.item.label}-${slice.index}`}
              d={slice.path}
              fill={slice.item.color ?? chartColor(slice.index)}
            />
          );
        })}
        <circle cx="110" cy="110" r="44" fill="#f5f7fb" />
      </svg>
      <ul className="tm-chart-legend">
        {data.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <span className="tm-chart-dot" style={{ background: item.color ?? chartColor(index) }} />
            <span>{item.label}</span>
            <span className="font-semibold">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LineChart({ data }: { data: ChartDataset }) {
  if (!data.length) return <div className="tm-chart-empty">データがありません</div>;
  const width = 720;
  const height = 260;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const minX = 56;
  const maxX = width - 28;
  const minY = 32;
  const maxY = 212;
  const xGap = data.length > 1 ? (maxX - minX) / (data.length - 1) : 0;

  const points = data.map((item, index) => {
    const x = minX + index * xGap;
    const y = maxY - (item.value / maxValue) * (maxY - minY);
    return { x, y, item };
  });

  return (
    <svg className="tm-chart-svg" viewBox={`0 0 ${width} ${height}`} role="img">
      <line x1={minX} y1={maxY} x2={maxX} y2={maxY} stroke="#94a3b8" strokeWidth="1.2" />
      <polyline
        fill="none"
        stroke="#1d4ed8"
        strokeWidth="3"
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
      />
      {points.map((point, index) => (
        <g key={`${point.item.label}-${index}`}>
          <circle cx={point.x} cy={point.y} r="4.5" fill={point.item.color ?? chartColor(index)} />
          <text x={point.x} y={maxY + 20} textAnchor="middle" className="tm-chart-label">
            {point.item.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function chartFor(type: ChartType, dataset: ChartDataset) {
  if (type === "pie") return <PieChart data={dataset} />;
  if (type === "line") return <LineChart data={dataset} />;
  return <BarChart data={dataset} />;
}

export function DashboardView({
  cards,
  lists,
  members,
  labels,
  cardAssignees,
  cardLabels,
  tiles,
  canEdit,
  onTilesChange,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<1 | 2>(1);
  const [selectedChart, setSelectedChart] = useState<ChartType>("bar");
  const [selectedMetric, setSelectedMetric] = useState<DashboardTile["metric"]>("cards_per_list");
  const [tileTitle, setTileTitle] = useState("リスト別カード数");
  const [saving, setSaving] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    setNowMs(Date.now());
  }, [cards]);

  const effectiveTiles = useMemo(() => {
    const source = tiles.length ? tiles : DEFAULT_TILES;
    return normalizeTiles(source);
  }, [tiles]);

  const metricData = useMemo(() => {
    const listCounts = lists.map((list) => ({
      label: list.name,
      value: cards.filter((card) => card.list_id === list.id).length,
    }));

    const dueStatusData = (() => {
      let completed = 0;
      let dueSoon = 0;
      let futureDue = 0;
      let overdue = 0;
      let noDue = 0;

      cards.forEach((card) => {
        if (card.is_completed) {
          completed += 1;
          return;
        }
        if (!card.due_at) {
          noDue += 1;
          return;
        }
        const dueMs = new Date(card.due_at).valueOf();
        if (dueMs < nowMs) overdue += 1;
        else if (dueMs - nowMs <= 7 * 24 * 60 * 60 * 1000) dueSoon += 1;
        else futureDue += 1;
      });

      return [
        { label: "完了", value: completed, color: "#16a34a" },
        { label: "まもなく締切", value: dueSoon, color: "#f59e0b" },
        { label: "先の期限", value: futureDue, color: "#1d4ed8" },
        { label: "期限切れ", value: overdue, color: "#dc2626" },
        { label: "期限なし", value: noDue, color: "#d1d5db" },
      ];
    })();

    const memberNameById = new Map(
      members.map((member) => [
        member.user_id,
        member.profile?.display_name ?? member.profile?.email ?? member.user_id,
      ]),
    );
    const memberCounts = new Map<string, number>();
    cardAssignees.forEach((assignee) => {
      memberCounts.set(assignee.user_id, (memberCounts.get(assignee.user_id) ?? 0) + 1);
    });
    const cardsWithoutAssignee = cards.filter((card) => !cardAssignees.some((row) => row.card_id === card.id)).length;
    const memberData = [
      ...Array.from(memberCounts.entries()).map(([userId, count]) => ({
        label: memberNameById.get(userId) ?? userId,
        value: count,
      })),
      { label: "未割当て", value: cardsWithoutAssignee },
    ].sort((a, b) => b.value - a.value);

    const labelNameById = new Map(labels.map((label) => [label.id, label.name]));
    const labelCountMap = new Map<string, number>();
    cardLabels.forEach((row) => {
      labelCountMap.set(row.label_id, (labelCountMap.get(row.label_id) ?? 0) + 1);
    });
    const labelData = Array.from(labelCountMap.entries()).map(([labelId, count]) => ({
      label: labelNameById.get(labelId) ?? "ラベル",
      value: count,
    }));

    return {
      cards_per_list: listCounts,
      due_status: dueStatusData,
      cards_per_member: memberData,
      cards_per_label: labelData,
    } satisfies Record<DashboardTile["metric"], ChartDataset>;
  }, [cards, lists, members, labels, cardAssignees, cardLabels, nowMs]);

  async function saveTiles(nextTiles: DashboardTile[]) {
    if (!canEdit) return;
    setSaving(true);
    try {
      await onTilesChange(normalizeTiles(nextTiles));
    } finally {
      setSaving(false);
    }
  }

  async function removeTile(tileId: string) {
    await saveTiles(effectiveTiles.filter((tile) => tile.id !== tileId));
  }

  async function moveTile(tileId: string, direction: "up" | "down") {
    const index = effectiveTiles.findIndex((tile) => tile.id === tileId);
    if (index < 0) return;
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= effectiveTiles.length) return;

    const next = [...effectiveTiles];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    await saveTiles(next);
  }

  async function addTile() {
    if (effectiveTiles.length >= TILE_LIMIT) return;
    const metricInfo = METRIC_CHOICES.find((item) => item.value === selectedMetric);
    const title = tileTitle.trim() || metricInfo?.title || "新しいタイル";
    const tile: DashboardTile = {
      id: crypto.randomUUID(),
      chartType: selectedChart,
      metric: selectedMetric,
      title,
      position: effectiveTiles.length,
      size: "half",
    };
    await saveTiles([...effectiveTiles, tile]);
    setTileTitle(metricInfo?.title ?? "新しいタイル");
    setSelectedMetric("cards_per_list");
    setSelectedChart("bar");
    setModalStep(1);
    setShowModal(false);
  }

  const hasLabelData = metricData.cards_per_label.some((item) => item.value > 0);

  return (
    <section className="tm-dashboard-surface">
      <div className="tm-dashboard-grid">
        {effectiveTiles.map((tile, index) => {
          const dataset = metricData[tile.metric] ?? [];
          const isLabelMetricWithoutData = tile.metric === "cards_per_label" && !hasLabelData;
          return (
            <article key={tile.id} className={`tm-dashboard-tile ${tile.size === "full" ? "tm-dashboard-tile-full" : ""}`}>
              <header className="tm-dashboard-tile-header">
                <h3>{tile.title}</h3>
                {canEdit ? (
                  <div className="flex items-center gap-1">
                    <button
                      className="tm-tile-action"
                      type="button"
                      onClick={() => void moveTile(tile.id, "up")}
                      disabled={saving || index === 0}
                    >
                      ↑
                    </button>
                    <button
                      className="tm-tile-action"
                      type="button"
                      onClick={() => void moveTile(tile.id, "down")}
                      disabled={saving || index === effectiveTiles.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      className="tm-tile-action"
                      type="button"
                      onClick={() => void removeTile(tile.id)}
                      disabled={saving}
                    >
                      ×
                    </button>
                  </div>
                ) : null}
              </header>

              {isLabelMetricWithoutData ? (
                <div className="tm-dashboard-empty">
                  <p className="text-7xl">🐺</p>
                  <p className="mt-2 text-lg font-semibold text-slate-700">このボードには、まだラベル付きカードがありません。</p>
                </div>
              ) : (
                <div className="tm-dashboard-chart">{chartFor(tile.chartType, dataset)}</div>
              )}
            </article>
          );
        })}
      </div>

      {canEdit ? (
        <div className="mt-4">
          <button
            className="tm-dashboard-add-button"
            type="button"
            disabled={saving || effectiveTiles.length >= TILE_LIMIT}
            onClick={() => {
              setModalStep(1);
              setShowModal(true);
            }}
          >
            + タイルを追加
          </button>
        </div>
      ) : null}

      {showModal ? (
        <div className="tm-modal-backdrop" role="dialog" aria-modal="true">
          <div className="tm-modal-card">
            <div className="flex items-start justify-between">
              <h3 className="text-2xl font-bold text-slate-800">タイルを追加</h3>
              <button className="tm-tile-action" type="button" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>

            {modalStep === 1 ? (
              <>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {CHART_CHOICES.map((choice) => (
                    <button
                      key={choice.value}
                      className={`tm-modal-option ${
                        selectedChart === choice.value ? "tm-modal-option-selected" : ""
                      }`}
                      type="button"
                      onClick={() => setSelectedChart(choice.value)}
                    >
                      <span className="text-6xl leading-none text-slate-500">{choice.icon}</span>
                      <span className="mt-3 text-xl font-semibold text-slate-700">{choice.label}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-5 flex justify-end">
                  <button className="tm-button tm-button-primary px-6 py-2" type="button" onClick={() => setModalStep(2)}>
                    次
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-5 space-y-3">
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-slate-700">メトリクス</span>
                    <select
                      className="tm-modal-input"
                      value={selectedMetric}
                      onChange={(event) => {
                        const metric = event.target.value as DashboardTile["metric"];
                        setSelectedMetric(metric);
                        const metricInfo = METRIC_CHOICES.find((item) => item.value === metric);
                        setTileTitle(metricInfo?.title ?? "新しいタイル");
                      }}
                    >
                      {METRIC_CHOICES.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-slate-700">タイトル</span>
                    <input
                      className="tm-modal-input"
                      value={tileTitle}
                      onChange={(event) => setTileTitle(event.target.value)}
                      placeholder="タイルタイトル"
                    />
                  </label>
                </div>
                <div className="mt-5 flex justify-between">
                  <button className="tm-button tm-button-secondary px-5 py-2" type="button" onClick={() => setModalStep(1)}>
                    戻る
                  </button>
                  <button className="tm-button tm-button-primary px-6 py-2" type="button" onClick={() => void addTile()}>
                    追加
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
