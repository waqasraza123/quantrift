"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";
import { listDataSources } from "@/lib/api/dataSources";
import { listWatchlists, listWatchlistItems } from "@/lib/api/watchlists";
import { getSignal, getAnalysisRunSignal } from "@/lib/api/signals";
import type { AnalysisRun, SymbolRead, Workspace } from "@/lib/api/types";
import {
  normalizeChartCandles,
  timeframeToMilliseconds,
} from "@/lib/charts/candles";
import { candlePage, unwrap, signalChartEvidence } from "@/lib/terminal/api";
import { parsePreferences } from "@/lib/terminal/preferences";
import {
  defaultPreferences,
  toolNames,
  type Drawing,
  type DrawingTool,
  type Timeframe,
  type WorkspacePreferences,
  type TerminalChartHandle,
} from "@/lib/terminal/types";

type ResearchNote = {
  id: string;
  title: string;
  note: string;
  href: string;
  created: string;
};
const emptyDrawings: Drawing[] = [];

export function useTerminalWorkspace({
  workspace,
  selectedSymbol,
  timeframe,
  workspaces,
  symbols,
  scope,
  initialError,
  navigate,
}: {
  workspace?: Workspace;
  selectedSymbol?: SymbolRead;
  timeframe: Timeframe;
  workspaces: Workspace[];
  symbols: SymbolRead[];
  scope: string;
  initialError: string | null;
  navigate: (changes: Record<string, string | null>) => void;
}) {
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const [preferences, setPreferences] =
    useState<WorkspacePreferences>(defaultPreferences);
  const [hydrated, setHydrated] = useState(false);
  const [preferredSourceId, setPreferredSourceId] = useState("");
  const sampleWatchlistInitialized = useRef(false);
  const [search, setSearch] = useState("");
  const [marketSearch, setMarketSearch] = useState("");
  const [dialog, setDialog] = useState<
    "symbol" | "settings" | "shortcuts" | "save" | null
  >(null);
  const [tool, setTool] = useState<DrawingTool>("cursor");
  const [bottomTab, setBottomTab] = useState("Overview");
  const [marketTab, setMarketTab] = useState("All markets");
  const [watchlistId, setWatchlistId] = useState("");
  const [marketLimit, setMarketLimit] = useState(60);
  const [range, setRange] = useState<{ start: number; end: number } | null>(
    null,
  );
  const [notice, setNotice] = useState(initialError || "");
  const [fullscreen, setFullscreen] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [notes, setNotes] = useState<ResearchNote[]>([]);
  const [note, setNote] = useState("");
  const [redo, setRedo] = useState<Drawing[]>([]);
  const [selectedDrawing, setSelectedDrawing] = useState("");
  const chart = useRef<TerminalChartHandle>(null);
  const root = useRef<HTMLDivElement>(null);
  const storageKey = `quantrift:terminal:v1:${scope}`;

  const update = useCallback(
    (patch: Partial<WorkspacePreferences>) =>
      setPreferences((previous) => ({ ...previous, ...patch })),
    [],
  );

  useEffect(() => {
    try {
      setPreferredSourceId(localStorage.getItem(`${storageKey}:source`) || "");
      const stored = localStorage.getItem(storageKey);
      const restored = stored
        ? parsePreferences(JSON.parse(stored))
        : defaultPreferences;
      setPreferences(
        window.matchMedia("(max-width: 760px)").matches
          ? { ...restored, rightOpen: false, analystOpen: false }
          : window.matchMedia("(max-width: 1199px)").matches
            ? { ...restored, analystOpen: false }
            : restored,
      );
      const saved = JSON.parse(
        localStorage.getItem(`${storageKey}:research`) || "[]",
      ) as unknown;
      if (Array.isArray(saved))
        setNotes(
          saved
            .filter(
              (item): item is ResearchNote =>
                typeof item === "object" &&
                item !== null &&
                typeof item.id === "string" &&
                typeof item.title === "string" &&
                typeof item.note === "string" &&
                typeof item.href === "string" &&
                item.href.startsWith("/terminal?") &&
                typeof item.created === "string",
            )
            .slice(0, 100),
        );
    } catch {
      setNotice(
        "Browser storage is unavailable. Workspace preferences will last for this visit.",
      );
    }
    setHydrated(true);
  }, [storageKey]);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(preferences));
      } catch {
        setNotice("Workspace preferences could not be saved in this browser.");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [preferences, hydrated, storageKey]);
  useEffect(() => {
    let expiring = false;
    const expire = () => {
      if (expiring) return;
      expiring = true;
      setNotice("Your session expired. Returning to sign in…");
      void queryClient.cancelQueries();
      void fetch("/api/auth/expire", {
        method: "POST",
        credentials: "same-origin",
        signal: AbortSignal.timeout(3000),
      }).finally(() =>
        window.location.replace(
          `/login?${new URLSearchParams({ next: window.location.pathname + window.location.search })}`,
        ),
      );
    };
    window.addEventListener("quantrift:session-expired", expire);
    return () =>
      window.removeEventListener("quantrift:session-expired", expire);
  }, [queryClient]);
  useEffect(() => {
    const changed = () =>
      setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  const sourceQuery = useQuery({
    queryKey: ["terminal-sources", workspace?.id],
    enabled: !!workspace,
    queryFn: async () => unwrap(await listDataSources(workspace!.id)),
  });
  const sources = useMemo(() => sourceQuery.data || [], [sourceQuery.data]);
  const source =
    sources.find((item) => item.id === params.get("sourceId")) ||
    sources.find((item) => item.id === preferredSourceId) ||
    sources.find(
      (item) =>
        item.provider === "quantrift_sample" && item.status === "active",
    ) ||
    sources[0];
  useEffect(() => {
    const explicit = params.get("sourceId");
    if (explicit && source?.id === explicit) {
      try {
        localStorage.setItem(`${storageKey}:source`, explicit);
        setPreferredSourceId(explicit);
      } catch {
        return;
      }
    }
  }, [params, source?.id, storageKey]);
  useEffect(() => {
    if (!hydrated || source?.provider !== "quantrift_sample") return;
    const marker = `${storageKey}:sample-personalized`;
    try {
      if (localStorage.getItem(marker)) return;
      if (!localStorage.getItem(`${storageKey}:research`)) {
        const examples: ResearchNote[] = [
          {
            id: "starter-research-v1",
            title: "Sample: chart research",
            created: new Date().toISOString(),
            note: "Sample research on synthetic market history. Compare the candles with the calculated indicators, inspect the saved signal evidence, and review its observed outcome. Replace this note with your own observations.",
            href: `/terminal?${new URLSearchParams({ workspaceId: workspace?.id || "", symbolId: selectedSymbol?.id || "", sourceId: source.id, timeframe })}`,
          },
        ];
        localStorage.setItem(
          `${storageKey}:research`,
          JSON.stringify(examples),
        );
        setNotes(examples);
      }
      setPreferences((previous) =>
        previous.favorites.length
          ? previous
          : {
              ...previous,
              favorites: symbols
                .filter((item) => ["BTCUSDT", "ETHUSDT"].includes(item.symbol))
                .map((item) => item.id),
            },
      );
      localStorage.setItem(marker, "1");
    } catch {
      return;
    }
  }, [
    hydrated,
    source,
    storageKey,
    workspace?.id,
    selectedSymbol?.id,
    timeframe,
    symbols,
  ]);
  const contextKey = `${selectedSymbol?.id}:${source?.id || "default"}:${timeframe}`;
  const drawings = preferences.drawings[contextKey] || emptyDrawings;
  useEffect(() => {
    setRedo([]);
    setSelectedDrawing("");
    setTool("cursor");
    setRange(null);
  }, [contextKey]);

  const context = useMemo(
    () => ({
      workspaceId: workspace?.id || "",
      symbolId: selectedSymbol?.id || "",
      sourceId: source?.id || "",
      timeframe,
    }),
    [workspace?.id, selectedSymbol?.id, source?.id, timeframe],
  );
  const enabled = !!(
    context.workspaceId &&
    context.symbolId &&
    context.sourceId
  );
  const recent = useQuery({
    queryKey: ["terminal-recent", context, params.get("endTime")],
    enabled,
    queryFn: ({ signal }) =>
      candlePage(
        context,
        params.get("endTime") &&
          Number.isFinite(Date.parse(params.get("endTime")!))
          ? new Date(Date.parse(params.get("endTime")!) + 1).toISOString()
          : undefined,
        signal,
      ),
    refetchInterval:
      params.get("endTime") || source?.provider === "quantrift_sample"
        ? false
        : 15000,
    refetchIntervalInBackground: false,
  });
  const anchor = useRef<{ key: string; timestamp: string | undefined }>({
    key: "",
    timestamp: undefined,
  });
  const dataKey = JSON.stringify([context, params.get("endTime")]);
  if (anchor.current.key !== dataKey)
    anchor.current = { key: dataKey, timestamp: undefined };
  if (!anchor.current.timestamp && recent.data?.length)
    anchor.current.timestamp = recent.data[0].timestamp;
  const older = useInfiniteQuery({
    queryKey: ["terminal-history", context, params.get("endTime")],
    enabled: false,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      candlePage(context, pageParam || anchor.current.timestamp, signal),
    getNextPageParam: (page, pages) =>
      page.length > 0 && pages.length < 10 ? page[0].timestamp : undefined,
  });
  const loadOlder = useCallback(() => {
    if (
      anchor.current.timestamp &&
      !older.isFetching &&
      (!older.data || older.hasNextPage) &&
      (older.data?.pages.length || 0) < 10
    )
      void older.fetchNextPage();
  }, [older]);
  const candles = useMemo(() => {
    const unique = new Map(
      [...(older.data?.pages.flat() || []), ...(recent.data || [])].map(
        (candle) => [candle.timestamp, candle],
      ),
    );
    return normalizeChartCandles([...unique.values()]);
  }, [older.data, recent.data]);
  const latest = candles.at(-1);
  const runs = useQuery({
    queryKey: ["terminal-runs", context],
    enabled: !!workspace && !!selectedSymbol,
    queryFn: async () =>
      unwrap(
        await apiGet<AnalysisRun[]>("/analysis-runs", {
          query: {
            workspace_id: workspace!.id,
            symbol_id: selectedSymbol!.id,
            timeframe,
            limit: 25,
          },
        }),
      ),
  });
  const matchingRuns = (runs.data || []).filter(
    (run) =>
      run.timeframe === timeframe && (!source || run.source_id === source.id),
  );
  const selectedRun =
    matchingRuns.find((run) => run.id === params.get("analysisRunId")) ||
    matchingRuns.find((run) => run.status === "completed") ||
    matchingRuns[0];
  const signalId = params.get("signalId");
  const signalQuery = useQuery({
    queryKey: ["terminal-signal", context, signalId, selectedRun?.id],
    enabled: !!signalId || !!selectedRun,
    queryFn: async () => {
      const result = unwrap(
        await (signalId
          ? getSignal(signalId)
          : getAnalysisRunSignal(selectedRun!.id)),
      );
      if (
        result.signal.workspace_id !== context.workspaceId ||
        result.signal.symbol_id !== context.symbolId ||
        result.signal.timeframe !== timeframe
      )
        return null;
      return result;
    },
  });
  const classification = signalQuery.data || null;
  const evidence = useQuery({
    queryKey: ["terminal-evidence", context, classification?.signal.id],
    enabled: !!classification,
    queryFn: () => signalChartEvidence(classification!),
  });
  const zones = useMemo(
    () =>
      evidence.data?.analysisRun?.source_id === source?.id
        ? evidence.data?.overlays.zones || []
        : [],
    [evidence.data, source?.id],
  );
  useEffect(() => {
    const analysisSource = evidence.data?.analysisRun?.source_id;
    if (
      params.get("signalId") &&
      !params.get("sourceId") &&
      analysisSource &&
      sources.some((item) => item.id === analysisSource)
    ) {
      const next = new URLSearchParams(params.toString());
      next.set("sourceId", analysisSource);
      window.history.replaceState(null, "", `/terminal?${next}`);
    }
  }, [evidence.data, params, sources]);
  const watchlists = useQuery({
    queryKey: ["terminal-watchlists", workspace?.id],
    enabled: !!workspace,
    queryFn: async () => unwrap(await listWatchlists(workspace!.id)),
  });
  useEffect(() => {
    const sample = watchlists.data?.find(
      (item) => item.metadata_json.sample === true,
    );
    if (
      source?.provider === "quantrift_sample" &&
      sample &&
      !sampleWatchlistInitialized.current
    ) {
      sampleWatchlistInitialized.current = true;
      setWatchlistId(sample.id);
    }
  }, [source?.provider, watchlists.data]);
  const watchlistItems = useQuery({
    queryKey: ["terminal-watchlist-items", workspace?.id, watchlistId],
    enabled: !!watchlistId,
    queryFn: async () => unwrap(await listWatchlistItems(watchlistId)),
  });
  const filteredSymbols = symbols.filter(
    (symbol) =>
      `${symbol.symbol} ${symbol.display_name}`
        .toLowerCase()
        .includes(marketSearch.toLowerCase()) &&
      (marketTab !== "Favorites" ||
        preferences.favorites.includes(symbol.id)) &&
      (!watchlistId ||
        watchlistItems.data?.some((item) => item.symbol_id === symbol.id)),
  );
  const selectSymbol = (symbol: SymbolRead) => {
    navigate({
      symbolId: symbol.id,
      workspaceId: workspace?.id || null,
      signalId: null,
      analysisRunId: null,
      endTime: null,
    });
    setDialog(null);
    setSearch("");
  };
  const setDrawings = useCallback(
    (items: Drawing[]) =>
      setPreferences((previous) => ({
        ...previous,
        drawings: { ...previous.drawings, [contextKey]: items },
      })),
    [contextKey],
  );
  const undoDrawing = useCallback(() => {
    if (drawings.length) {
      setRedo((previous) => [...previous, drawings.at(-1)!]);
      setDrawings(drawings.slice(0, -1));
    }
  }, [drawings, setDrawings]);
  const redoDrawing = () => {
    if (redo.length) {
      setDrawings([...drawings, redo.at(-1)!]);
      setRedo(redo.slice(0, -1));
    }
  };
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch {
      setNotice("Fullscreen is unavailable in this browser.");
    }
  };
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(
          "input,textarea,select,[contenteditable=true],dialog",
        )
      )
        return;
      if (event.key === "Escape") {
        setTool("cursor");
        setMenu(null);
      }
      if (event.key === "/") {
        event.preventDefault();
        setDialog("symbol");
      }
      if (event.key.toLowerCase() === "a" && !event.metaKey && !event.ctrlKey)
        setPreferences((previous) => ({
          ...previous,
          analystOpen: !previous.analystOpen,
        }));
      if (event.key.toLowerCase() === "f" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        void toggleFullscreen();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undoDrawing();
      }
      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        selectedDrawing
      ) {
        event.preventDefault();
        setDrawings(
          drawings.filter((drawing) => drawing.id !== selectedDrawing),
        );
        setSelectedDrawing("");
      }
      if (event.key === "?") setDialog("shortcuts");
    };
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [undoDrawing, selectedDrawing, drawings, setDrawings]);
  const saveNote = () => {
    const saved: ResearchNote = {
      id: crypto.randomUUID(),
      title: `${selectedSymbol?.symbol || "Market"} · ${timeframe}`,
      note: note.trim(),
      href: `/terminal?${new URLSearchParams({ workspaceId: workspace?.id || "", symbolId: selectedSymbol?.id || "", sourceId: source?.id || "", timeframe, ...(params.get("signalId") ? { signalId: params.get("signalId")! } : {}), ...(latest ? { endTime: latest.timestamp } : {}) })}`,
      created: new Date().toISOString(),
    };
    const next = [saved, ...notes].slice(0, 100);
    try {
      localStorage.setItem(`${storageKey}:research`, JSON.stringify(next));
      setNotes(next);
      setNote("");
      setDialog(null);
      setBottomTab("Research");
      update({ bottomOpen: true });
      setNotice("Research saved in this browser.");
    } catch {
      setNotice(
        "Research could not be saved. Your note is still available in the dialog.",
      );
    }
  };
  const onRange = useCallback(
    (start: number, end: number) =>
      setRange((previous) =>
        previous?.start === start && previous.end === end
          ? previous
          : { start, end },
      ),
    [],
  );
  const onInspect = useCallback((id: string) => {
    setSelectedDrawing(id);
    setBottomTab("Evidence");
    setPreferences((previous) => ({ ...previous, bottomOpen: true }));
  }, []);
  const error = recent.error || sourceQuery.error;
  const priceChange =
    latest && candles.length > 1 ? latest.close - candles.at(-2)!.close : null;
  const percentage =
    priceChange !== null && candles.at(-2)
      ? (priceChange / candles.at(-2)!.close) * 100
      : null;
  const price = (value: number) =>
    value.toLocaleString(undefined, {
      maximumFractionDigits: Math.min(10, selectedSymbol?.price_precision ?? 2),
    });
  const fresh =
    latest &&
    Date.now() - Date.parse(latest.timestamp) <
      (timeframeToMilliseconds(timeframe) || 3600000) * 2;
  const tools = Object.keys(toolNames) as DrawingTool[];

  return {
    workspace,
    selectedSymbol,
    timeframe,
    workspaces,
    symbols,
    scope,
    navigate,
    params,
    preferences,
    setPreferences,
    hydrated,
    search,
    setSearch,
    marketSearch,
    setMarketSearch,
    dialog,
    setDialog,
    tool,
    setTool,
    bottomTab,
    setBottomTab,
    marketTab,
    setMarketTab,
    watchlistId,
    setWatchlistId,
    marketLimit,
    setMarketLimit,
    range,
    notice,
    setNotice,
    fullscreen,
    menu,
    setMenu,
    notes,
    setNotes,
    note,
    setNote,
    redo,
    setRedo,
    selectedDrawing,
    setSelectedDrawing,
    chart,
    root,
    storageKey,
    contextKey,
    drawings,
    update,
    sourceQuery,
    sources,
    source,
    context,
    enabled,
    recent,
    older,
    loadOlder,
    candles,
    latest,
    runs,
    matchingRuns,
    selectedRun,
    signalQuery,
    classification,
    evidence,
    zones,
    watchlists,
    watchlistItems,
    filteredSymbols,
    selectSymbol,
    setDrawings,
    undoDrawing,
    redoDrawing,
    toggleFullscreen,
    saveNote,
    onRange,
    onInspect,
    error,
    priceChange,
    percentage,
    price,
    fresh,
    tools,
  };
}

export type TerminalWorkspaceState = ReturnType<typeof useTerminalWorkspace>;
