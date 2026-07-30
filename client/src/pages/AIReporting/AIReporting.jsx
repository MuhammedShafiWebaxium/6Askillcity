import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  BarChart3,
  Bot,
  CalendarClock,
  ChevronDown,
  Copy,
  Database,
  History,
  IndianRupee,
  Layers3,
  Loader2,
  MessageSquareText,
  Plus,
  Sparkles,
  User,
} from "lucide-react";
import {
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardLayout } from "../../components/dashboard/DashboardLayout";
import {
  askNaturalLanguageReport,
  getReportConversation,
  getReportConversations,
} from "../../api/report.api";

const suggestions = [
  {
    title: "Course fee completion",
    prompt: "How many course fee completed students are there?",
  },
  {
    title: "Application pipeline",
    prompt: "Show application statuses this month",
  },
  {
    title: "Admission trends",
    prompt: "Show admissions by month this year",
  },
  {
    title: "Partner performance",
    prompt: "Show the top 10 partners by student registrations",
  },
];

const formatAmount = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);

const formatCompactNumber = (value) =>
  new Intl.NumberFormat("en-IN", {
    notation: Number(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);

const chartPalette = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#dc2626",
  "#0891b2",
  "#db2777",
  "#4f46e5",
];

const getRowColor = (label, index) => {
  const normalized = String(label || "").toLowerCase();
  if (/(paid|eligible|active|approved|received|completed)/.test(normalized)) {
    return "#059669";
  }
  if (/(pending|waiting|progress|partial|postponed)/.test(normalized)) {
    return "#d97706";
  }
  if (/(closed|rejected|inactive|unpaid|draft)/.test(normalized)) {
    return "#dc2626";
  }
  return chartPalette[index % chartPalette.length];
};

const formatConversationDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) {
    return `Today, ${date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
};

function ChartTooltip({ active, payload, label, showsAmount }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;

  return (
    <div className="min-w-36 rounded-xl border border-border bg-card px-3 py-2.5 shadow-xl">
      <p className="max-w-52 truncate text-xs font-bold">
        {label || row?.label}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Records:{" "}
        <span className="font-bold text-foreground">
          {formatCompactNumber(row?.count)}
        </span>
      </p>
      {showsAmount && row?.amount !== undefined && (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Amount:{" "}
          <span className="font-bold text-foreground">
            {formatAmount(row.amount)}
          </span>
        </p>
      )}
    </div>
  );
}

function ReportVisualization({ result }) {
  const rows = Array.isArray(result.rows) ? result.rows : [];
  if (!rows.length) return null;

  const showsAmount = rows.some((row) => row.amount !== undefined);
  const totalRecords = rows.reduce(
    (total, row) => total + (Number(row.count) || 0),
    0,
  );
  const totalAmount = rows.reduce(
    (total, row) => total + (Number(row.amount) || 0),
    0,
  );
  const largestRow = [...rows].sort(
    (left, right) =>
      (Number(right.count) || 0) - (Number(left.count) || 0),
  )[0];
  const chartRows = rows.slice(0, 10).map((row, index) => ({
    ...row,
    count: Number(row.count) || 0,
    color: getRowColor(row.label, index),
  }));
  const isTrend = result.plan.intent === "admission_trend";

  return (
    <div className="space-y-3">
      <div
        className={`grid gap-3 ${
          showsAmount ? "sm:grid-cols-3" : "sm:grid-cols-2"
        }`}
      >
        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Total records
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Database className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black tracking-tight">
            {formatCompactNumber(totalRecords)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Across {rows.length} {rows.length === 1 ? "group" : "groups"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {rows.length === 1 ? "Result group" : "Largest group"}
            </p>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
              <Layers3 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 truncate text-base font-black">
            {largestRow?.label || "Unknown"}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {formatCompactNumber(largestRow?.count)} records
          </p>
        </div>

        {showsAmount && (
          <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Total amount
              </p>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <IndianRupee className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-3 truncate text-xl font-black tracking-tight">
              {formatAmount(totalAmount)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Verified transaction value
            </p>
          </div>
        )}
      </div>

      {chartRows.length > 1 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-black">
                {isTrend ? "Trend over time" : "Record distribution"}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {chartRows.length < rows.length
                  ? `Showing the top ${chartRows.length} groups`
                  : "Compared across all result groups"}
              </p>
            </div>
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>

          <div
            className="w-full"
            style={{
              height: isTrend
                ? 230
                : Math.min(360, Math.max(190, chartRows.length * 42)),
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              {isTrend ? (
                <ReLineChart
                  data={chartRows}
                  margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    vertical={false}
                    stroke="currentColor"
                    className="text-border"
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<ChartTooltip showsAmount={showsAmount} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#2563eb"
                    strokeWidth={3}
                    dot={{ r: 4, fill: "#2563eb", strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </ReLineChart>
              ) : (
                <ReBarChart
                  data={chartRows}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    horizontal={false}
                    stroke="currentColor"
                    className="text-border"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={110}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      String(value).length > 16
                        ? `${String(value).slice(0, 15)}…`
                        : value
                    }
                  />
                  <Tooltip
                    content={<ChartTooltip showsAmount={showsAmount} />}
                  />
                  <Bar dataKey="count" radius={[0, 7, 7, 0]} maxBarSize={22}>
                    {chartRows.map((row) => (
                      <Cell key={row.label} fill={row.color} />
                    ))}
                  </Bar>
                </ReBarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

const ticketStatusStyle = {
  Received: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "On Progress": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Postponed: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  Closed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  Reopened: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

const ticketPriorityStyle = {
  Low: "bg-slate-500/10 text-slate-600",
  Medium: "bg-blue-500/10 text-blue-600",
  High: "bg-orange-500/10 text-orange-600",
  Critical: "bg-red-500/10 text-red-600",
};

function TicketDetails({ rows }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Matching tickets
          </p>
          <p className="mt-1 text-2xl font-black">{rows.length}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <MessageSquareText className="h-5 w-5" />
        </div>
      </div>

      {rows.map((ticket) => (
        <article
          key={ticket.id || `${ticket.label}-${ticket.createdAt}`}
          className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/25"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h4 className="font-black leading-5">{ticket.label}</h4>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-wider ${
                    ticketStatusStyle[ticket.status] ||
                    "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {ticket.status}
                </span>
                <span
                  className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-wider ${
                    ticketPriorityStyle[ticket.priority] ||
                    "bg-muted text-muted-foreground"
                  }`}
                >
                  {ticket.priority} priority
                </span>
                {ticket.category && (
                  <span className="rounded-lg bg-muted px-2 py-1 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                    {ticket.category}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" />
              {new Date(ticket.createdAt).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
            {ticket.description || "No description was provided."}
          </p>
        </article>
      ))}
    </div>
  );
}

function ReportResult({ result }) {
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const showsAmount = rows.some((row) => row.amount !== undefined);
  const totalRecords = rows.reduce(
    (total, row) => total + (Number(row.count) || 0),
    0,
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h3 className="font-black text-base">{result.title}</h3>
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-primary/10 text-primary">
            {result.plan.intent.replaceAll("_", " ")}
          </span>
        </div>
        <p className="text-sm leading-6">{result.summary}</p>
        {result.insight && (
          <p className="text-sm leading-6 text-muted-foreground mt-1">
            {result.insight}
          </p>
        )}
      </div>

      {result.plan.intent === "help" ? null : result.plan.intent === "ticket_details" ? (
        <TicketDetails rows={rows} />
      ) : (
        <>
          <ReportVisualization result={result} />

          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/70">
            <tr>
              <th className="text-left px-4 py-3 font-bold">Group</th>
              <th className="text-right px-4 py-3 font-bold">Records</th>
              {showsAmount && (
                <th className="text-right px-4 py-3 font-bold">Amount</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr
                  key={`${row.label}-${index}`}
                  className="border-t border-border transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: getRowColor(row.label, index) }}
                      />
                      {row.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-bold">
                      {formatCompactNumber(row.count)}
                    </span>
                    {totalRecords > 0 && (
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        {Math.round(
                          ((Number(row.count) || 0) / totalRecords) * 100,
                        )}
                        %
                      </span>
                    )}
                  </td>
                  {showsAmount && (
                    <td className="px-4 py-3 text-right">
                      {row.amount !== undefined ? formatAmount(row.amount) : "—"}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={showsAmount ? 3 : 2}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No matching records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
          </div>
        </>
      )}

      <p className="text-[10px] text-muted-foreground">
        Results come from validated, read-only 6A report queries.
      </p>
    </div>
  );
}

export default function AIReporting() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messagePagination, setMessagePagination] = useState({
    hasMore: false,
    nextCursor: null,
  });
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const historyRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const suppressAutoScrollRef = useRef(false);

  useEffect(() => {
    if (suppressAutoScrollRef.current) {
      suppressAutoScrollRef.current = false;
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const closeHistory = (event) => {
      if (
        event.type === "keydown" &&
        event.key !== "Escape"
      ) {
        return;
      }
      if (
        event.type === "mousedown" &&
        historyRef.current?.contains(event.target)
      ) {
        return;
      }
      setHistoryOpen(false);
    };

    document.addEventListener("mousedown", closeHistory);
    document.addEventListener("keydown", closeHistory);
    return () => {
      document.removeEventListener("mousedown", closeHistory);
      document.removeEventListener("keydown", closeHistory);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadLatestConversation = async () => {
      try {
        const response = await getReportConversations();
        if (!active) return;

        const savedConversations = response.data || [];
        setConversations(savedConversations);

        if (savedConversations.length) {
          const latest = await getReportConversation(
            savedConversations[0].id,
          );
          if (!active) return;

          setConversationId(latest.data.id);
          setMessages(latest.data.messages || []);
          setMessagePagination(
            latest.data.pagination || { hasMore: false, nextCursor: null },
          );
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "I couldn't load your saved conversations.",
          );
        }
      } finally {
        if (active) setHistoryLoading(false);
      }
    };

    loadLatestConversation();
    return () => {
      active = false;
    };
  }, []);

  const loadConversation = async (requestedConversationId) => {
    if (!requestedConversationId || loading) return;

    setHistoryLoading(true);
    setError("");
    try {
      const response = await getReportConversation(requestedConversationId);
      setConversationId(response.data.id);
      setMessages(response.data.messages || []);
      setMessagePagination(
        response.data.pagination || { hasMore: false, nextCursor: null },
      );
      setHistoryOpen(false);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "I couldn't load that conversation.",
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    if (
      !conversationId ||
      !messagePagination.hasMore ||
      !messagePagination.nextCursor ||
      olderMessagesLoading
    ) {
      return;
    }

    const container = messagesContainerRef.current;
    const previousScrollHeight = container?.scrollHeight || 0;
    setOlderMessagesLoading(true);
    setError("");

    try {
      const response = await getReportConversation(conversationId, {
        before: messagePagination.nextCursor,
        limit: 30,
      });
      suppressAutoScrollRef.current = true;
      setMessages((current) => [
        ...(response.data.messages || []),
        ...current,
      ]);
      setMessagePagination(
        response.data.pagination || { hasMore: false, nextCursor: null },
      );

      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight - previousScrollHeight;
        }
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "I couldn't load earlier messages.",
      );
    } finally {
      setOlderMessagesLoading(false);
    }
  };

  const askQuestion = async (requestedQuestion) => {
    const prompt = String(requestedQuestion ?? question).trim();
    if (prompt.length < 5 || loading) return;

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: prompt },
    ]);
    setQuestion("");
    setError("");
    setLoading(true);

    try {
      const response = await askNaturalLanguageReport(prompt, conversationId);
      if (response.success) {
        const {
          conversationId: savedConversationId,
          ...report
        } = response.data;
        setConversationId(savedConversationId);
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: report,
          },
        ]);

        try {
          const historyResponse = await getReportConversations();
          setConversations(historyResponse.data || []);
        } catch {
          // The report is already saved; a history refresh failure should not
          // make the successful report request appear to have failed.
        }
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "I couldn't generate that report. Please try a more specific question.",
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(null);
    setMessagePagination({ hasMore: false, nextCursor: null });
    setHistoryOpen(false);
    setQuestion("");
    setError("");
    inputRef.current?.focus();
  };

  return (
    <DashboardLayout title="AI Reporting">
      <div className="h-[calc(100vh-7rem)] min-h-[600px] max-w-6xl mx-auto flex flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-sm">
        <header className="h-16 px-4 sm:px-6 border-b border-border bg-card/80 backdrop-blur-xl flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 text-white flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-black text-base">Ask 6A</h1>
              <p className="text-[10px] text-muted-foreground">
                Secure operational intelligence
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div ref={historyRef} className="relative">
              <button
                type="button"
                onClick={() => setHistoryOpen((current) => !current)}
                disabled={loading}
                aria-label="Chat history"
                aria-haspopup="dialog"
                aria-expanded={historyOpen}
                className={`h-9 flex items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-all disabled:opacity-50 ${
                  historyOpen
                    ? "border-primary/40 bg-primary/5 text-primary shadow-sm"
                    : "border-border bg-background hover:bg-muted"
                }`}
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">History</span>
                {conversations.length > 0 && (
                  <span className="hidden sm:inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                    {conversations.length}
                  </span>
                )}
                <ChevronDown
                  className={`hidden sm:block w-3.5 h-3.5 transition-transform ${
                    historyOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {historyOpen && (
                <div
                  role="dialog"
                  aria-label="Recent conversations"
                  className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/10"
                >
                  <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
                    <div>
                      <p className="text-sm font-black">Recent conversations</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Continue where you left off
                      </p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <History className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto p-2 scrollbar-thin-ui">
                    {historyLoading ? (
                      <div className="space-y-2 p-1">
                        {[0, 1, 2].map((item) => (
                          <div
                            key={item}
                            className="flex animate-pulse items-center gap-3 rounded-xl p-3"
                          >
                            <div className="h-9 w-9 rounded-xl bg-muted" />
                            <div className="flex-1 space-y-2">
                              <div className="h-3 w-3/4 rounded bg-muted" />
                              <div className="h-2.5 w-1/3 rounded bg-muted" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : conversations.length === 0 ? (
                      <div className="px-6 py-10 text-center">
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                          <MessageSquareText className="h-5 w-5" />
                        </div>
                        <p className="mt-3 text-sm font-bold">
                          No conversations yet
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Your saved reports will appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {conversations.map((conversation) => {
                          const isActive =
                            conversation.id === conversationId;

                          return (
                            <button
                              key={conversation.id}
                              type="button"
                              onClick={() =>
                                loadConversation(conversation.id)
                              }
                              className={`group flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                                isActive
                                  ? "bg-primary/10"
                                  : "hover:bg-muted"
                              }`}
                            >
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                                  isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground group-hover:text-foreground"
                                }`}
                              >
                                <MessageSquareText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`truncate text-sm font-bold ${
                                    isActive ? "text-primary" : ""
                                  }`}
                                >
                                  {conversation.title}
                                </p>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  {formatConversationDate(
                                    conversation.updatedAt,
                                  )}
                                </p>
                              </div>
                              {isActive && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={startNewChat}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border hover:bg-muted text-xs font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New chat</span>
            </button>
          </div>
        </header>

        <main
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto scrollbar-thin-ui"
        >
          {messages.length === 0 ? (
            <div className="min-h-full flex items-center justify-center px-5 py-10">
              <div className="w-full max-w-3xl text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/10 border border-primary/20 flex items-center justify-center mb-6">
                  <BarChart3 className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                  What would you like to know?
                </h2>
                <p className="mt-3 text-sm sm:text-base text-muted-foreground">
                  Ask questions about students, admissions, course fees, partners,
                  payments, and support tickets.
                </p>
                <div className="grid sm:grid-cols-2 gap-3 mt-8 text-left">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.prompt}
                      type="button"
                      onClick={() => askQuestion(suggestion.prompt)}
                      className="p-4 rounded-2xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                      <p className="text-xs font-black text-primary">
                        {suggestion.title}
                      </p>
                      <p className="text-sm font-medium mt-1.5 leading-5">
                        {suggestion.prompt}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
              {messagePagination.hasMore && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={loadOlderMessages}
                    disabled={olderMessagesLoading}
                    className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    {olderMessagesLoading && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    Load earlier messages
                  </button>
                </div>
              )}
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 sm:gap-4 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                      <Bot className="w-5 h-5" />
                    </div>
                  )}
                  <div
                    className={
                      message.role === "user"
                        ? "max-w-[82%] rounded-2xl rounded-tr-md bg-primary text-primary-foreground px-4 py-3"
                        : "flex-1 min-w-0 rounded-2xl border border-border bg-card px-4 sm:px-5 py-4 shadow-sm"
                    }
                  >
                    {message.role === "user" ? (
                      <p className="text-sm leading-6">{message.content}</p>
                    ) : (
                      <>
                        <ReportResult result={message.content} />
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard.writeText(message.content.summary)
                          }
                          className="mt-3 p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                          aria-label="Copy summary"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                  {message.role === "user" && (
                    <div className="w-9 h-9 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="rounded-2xl border border-border bg-card px-5 py-4 flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Analyzing verified 6A data…
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </main>

        <footer className="shrink-0 border-t border-border bg-card/90 backdrop-blur-xl px-4 sm:px-6 py-4">
          <div className="max-w-4xl mx-auto">
            {error && (
              <p className="mb-2 text-xs font-semibold text-red-600">{error}</p>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                askQuestion();
              }}
              className="relative rounded-2xl border border-border bg-background shadow-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all"
            >
              <textarea
                ref={inputRef}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    askQuestion();
                  }
                }}
                rows={1}
                maxLength={500}
                placeholder="Ask 6A about your operational data…"
                className="w-full min-h-14 max-h-36 resize-none bg-transparent pl-4 pr-14 py-4 outline-none text-sm leading-6"
              />
              <button
                type="submit"
                disabled={loading || question.trim().length < 5}
                className="absolute right-2.5 bottom-2.5 w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors"
                aria-label="Send question"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
              </button>
            </form>
            <p className="text-center text-[10px] text-muted-foreground mt-2">
              AI can make mistakes. Results use restricted, read-only report queries.
            </p>
          </div>
        </footer>
      </div>
    </DashboardLayout>
  );
}
