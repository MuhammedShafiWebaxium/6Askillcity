import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Moon,
  LogOut,
  Trash2,
  Menu,
  User,
  LayoutDashboard,
  Users,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Bell,
  Check,
  CheckCheck,
  FileText,
  Clock,
  MessageSquare,
  Building2,
  CreditCard,
  GraduationCap,
  X,
  Activity,
  Layers,
  Volume2,
  Sparkles,
} from "lucide-react";

import logo from "../../assets/logo.png";
import { useTheme } from "../global/ThemeProvider";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "./StatCard";
import { useDispatch, useSelector } from "react-redux";
import { logOut } from "../../redux/userSlice";
import {
  addLiveNotification,
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  clearAllNotificationsThunk,
} from "../../redux/notificationSlice";
import { showAlert } from "../../redux/alertSlice";
import { useSocket } from "../../context/SocketContext";
import { triggerOsNotification } from "../../utils/pushNotification";
import { getTicketMetrics, getTickets, getTicketById, addMessage } from "../../api/ticket.api";
// Text-to-speech helper — speaks the notification title aloud in a female voice
const speakNotification = (title) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();

  const phrases = [
    `Heads up! ${title}`,
    `Just in — ${title}`,
    `New update: ${title}`,
    `Hey, attention please — ${title}`,
    `You've got a new alert: ${title}`,
  ];
  const text = phrases[Math.floor(Math.random() * phrases.length)];

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.volume = 1;

  const applyVoice = () => {
    const voices = window.speechSynthesis.getVoices();

    // Step 1: explicit "female" tag in voice name
    let chosen = voices.find((v) => /female/i.test(v.name));

    // Step 2: well-known female voice names across Windows / macOS / Android / Linux
    if (!chosen) {
      chosen = voices.find((v) =>
        /zira|heera|hazel|eva|susan|paulina|sabina|amelie|anna|ioana|joana|helena|nora|sara|vigdis|satu|tessa|samantha|victoria|karen|moira|fiona|google\s+uk\s+english\s+female|google\s+us\s+english/i.test(v.name)
      );
    }

    // Step 3: any English voice whose name contains a known-female cue
    if (!chosen) {
      chosen = voices.find((v) => v.lang.startsWith("en") && /ira|ella|amy|emma|lisa|nina|alice|aria|jenny/i.test(v.name));
    }

    if (chosen) {
      console.log("✅ Using voice:", chosen.name);
      utterance.voice = chosen;
      utterance.pitch = 1.2;
    } else {
      // No named female voice found — force a high pitch so it sounds clearly feminine
      console.warn("⚠️ No female voice found, using default with high pitch");
      utterance.pitch = 1.8;
    }

    window.speechSynthesis.speak(utterance);
  };

  // getVoices() loads asynchronously on first page load
  if (window.speechSynthesis.getVoices().length > 0) {
    applyVoice();
  } else {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      applyVoice();
    };
  }
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const getRelativeTime = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const TYPE_STYLES = {
  application_submitted: {
    border: "border-l-blue-500",
    dot: "bg-blue-500",
    icon: FileText,
    iconClass: "text-blue-500",
  },
  application_approved: {
    border: "border-l-emerald-500",
    dot: "bg-emerald-500",
    icon: Check,
    iconClass: "text-emerald-500",
  },
  application_rejected: {
    border: "border-l-rose-500",
    dot: "bg-rose-500",
    icon: X,
    iconClass: "text-rose-500",
  },
  payment_completed: {
    border: "border-l-emerald-500",
    dot: "bg-emerald-500",
    icon: CreditCard,
    iconClass: "text-emerald-500",
  },
  payment_due: {
    border: "border-l-amber-500",
    dot: "bg-amber-500",
    icon: CreditCard,
    iconClass: "text-amber-500",
  },
  new_ticket: {
    border: "border-l-amber-500",
    dot: "bg-amber-500",
    icon: MessageSquare,
    iconClass: "text-amber-500",
  },
  ticket_status_updated: {
    border: "border-l-violet-500",
    dot: "bg-violet-500",
    icon: MessageSquare,
    iconClass: "text-violet-500",
  },
  default: {
    border: "border-l-primary",
    dot: "bg-primary",
    icon: Bell,
    iconClass: "text-primary",
  },
};

const getTypeStyle = (type) => TYPE_STYLES[type] || TYPE_STYLES.default;

// ─────────────────────────────────────────────
// Sidebar Component
// ─────────────────────────────────────────────

const Sidebar = ({
  isOpen,
  setSidebarOpen,
  isCollapsed,
  setIsCollapsed,
  setShowLogoutWarning,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { user } = useSelector((state) => state.user);
  const { items: notifications } = useSelector((state) => state.notifications);
  const userName = user?.fullName || user?.centerName;
  const userRole = user?.type === "partner" ? "partner" : user?.role || "User";
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarNavRef = React.useRef(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateSidebarScrollControls = () => {
    const nav = sidebarNavRef.current;
    if (!nav) return;
    setCanScrollUp(nav.scrollTop > 8);
    setCanScrollDown(nav.scrollTop + nav.clientHeight < nav.scrollHeight - 8);
  };

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(updateSidebarScrollControls);
    window.addEventListener("resize", updateSidebarScrollControls);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateSidebarScrollControls);
    };
  }, [isCollapsed, user?.role, user?.type]);

  const isFullyOnboardedPartner = user?.type !== "partner" || user?.onboardingState === "completed";

  let menuGroups = [
    {
      label: "System",
      items: [
        {
          id: "dashboard",
          label: "Dashboard",
          icon: LayoutDashboard,
          path: "/dashboard",
        },
        ...(user?.role === "admin" || user?.role === "manager" || user?.type === "partner"
          ? [
              {
                id: "overview",
                label: "Overview",
                icon: Activity,
                path: "/dashboard/overview",
              },
            ]
          : []),
      ],
    },
    {
      label: "Academics",
      items: [
        ...(user?.type === "partner"
          ? [
              {
                id: "applications",
                label: "Enrollments",
                icon: FileText,
                path: "/dashboard/applications",
              },
              {
                id: "management",
                label: "My Students",
                icon: Users,
                path: "/dashboard/student-management",
              },
              {
                id: "courses",
                label: "Programs",
                icon: GraduationCap,
                path: "/dashboard/courses",
              },
            ]
          : []),
        ...(user?.type === "admin"
          ? [
              {
                id: "eligibility",
                label: "Review Queue",
                icon: Clock,
                path: "/dashboard/eligibility-queue",
              },
              {
                id: "management",
                label: "All Students",
                icon: Users,
                path: "/dashboard/student-management",
              },
              {
                id: "universities",
                label: "Universities",
                icon: Building2,
                path: "/dashboard/university-management",
              },
              {
                id: "partners",
                label: "Admission Points",
                icon: UserPlus,
                path: "/dashboard/partner-management",
              },
            ]
          : []),
      ],
    },
    {
      label: "Operations",
      items: [
        ...(user?.type === "partner" || user?.role === "admin"
          ? [
              {
                id: "payments",
                label: "Finance",
                icon: CreditCard,
                path: "/dashboard/payment-management",
              },
            ]
          : []),
        // Reports are temporarily disabled.
        // ...(user?.role === "admin"
        //   ? [
        //       {
        //         id: "reports",
        //         label: "Reports",
        //         icon: FileText,
        //         path: "/dashboard/reports",
        //       },
        //     ]
        //   : []),
        ...(user?.role === "admin" || user?.role === "manager" || user?.type === "partner"
          ? [
              {
                id: "documents-services",
                label: "Documents & Services",
                icon: Layers,
                path: "/dashboard/documents-services",
              },
            ]
          : []),
        {
          id: "tickets",
          label: "Help Desk",
          icon: MessageSquare,
          path: "/dashboard/tickets",
        },
        {
          id: "notifications",
          label: "Notifications",
          icon: Bell,
          path: "/dashboard/notifications",
        },
      ],
    },
  ];

  if (!isFullyOnboardedPartner) {
    menuGroups = [
      {
        label: "Activation",
        items: [
          {
            id: "onboarding",
            label: "Onboarding Sequence",
            icon: Activity,
            path: "/dashboard",
          },
        ],
      },
    ];
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed z-40 top-0 left-0 h-full bg-card/80 backdrop-blur-xl border-r border-border shadow-2xl transition-all duration-500 ease-in-out flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "w-20" : "w-64",
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5 pointer-events-none rounded-r-[2.5rem]" />
        <div className="h-24 relative flex items-center px-6 border-b border-border/50 bg-background/20 backdrop-blur-md justify-center md:justify-start">
          <div className="flex items-center justify-center w-full">
            <img
              src={logo}
              alt="6ASkillCity"
              className={cn(
                "h-14 w-auto object-contain transition-all duration-500",
                isCollapsed ? "scale-110" : "scale-125",
              )}
            />
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex p-1.5 hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all absolute -right-[14px] top-7 bg-card border border-border shadow-lg rounded-full z-50 hover:scale-110"
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Close button for mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 hover:bg-primary hover:text-primary-foreground text-muted-foreground transition-all absolute right-4 top-1/2 -translate-y-1/2 bg-card border border-border shadow-lg rounded-full z-50 hover:scale-110"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative flex-1 min-h-0">
        <nav
          ref={sidebarNavRef}
          onScroll={updateSidebarScrollControls}
          className="h-full overflow-y-auto py-6 px-4 space-y-8 scrollbar-thin-ui"
        >
          {menuGroups.map((group, idx) => (
            <div key={idx} className="space-y-2">
              {!isCollapsed && (
                <h3 className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-3">
                  {group.label}
                </h3>
              )}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive =
                    location.pathname === item.path ||
                    (location.pathname === "/dashboard" &&
                      item.id === "dashboard");

                  const hasUnread = notifications.some(
                    (n) => !n.isRead && n.link === item.path,
                  );

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        navigate(item.path);
                        setSidebarOpen(false);
                      }}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "w-full flex items-center rounded-xl transition-all duration-300 relative group/item ",
                        isCollapsed
                          ? "justify-center py-3"
                          : "space-x-3 px-3 py-2.5",
                        isActive
                          ? "text-primary-foreground font-bold"
                          : "text-muted-foreground hover:bg-primary/5 hover:text-primary",
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTabGlow"
                          className={cn(
                            "absolute bg-gradient-to-r from-primary to-primary/80 rounded-xl -z-10 shadow-lg shadow-primary/20 m-0",
                            isCollapsed ? "inset-1.5" : "inset-0",
                          )}
                          transition={{
                            type: "spring",
                            bounce: 0.2,
                            duration: 0.6,
                          }}
                        />
                      )}

                      <div
                        className={cn(
                          "relative flex items-center justify-center transition-all duration-300",
                          isActive ? "scale-110" : "group-hover/item:scale-110",
                        )}
                      >
                        <item.icon
                          className={cn(
                            "shrink-0",
                            isCollapsed ? "w-6 h-6" : "w-5 h-5",
                          )}
                        />
                        {hasUnread && isCollapsed && (
                          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-card" />
                          </span>
                        )}
                        {isActive && (
                          <span className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
                        )}
                      </div>

                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-sm tracking-tight truncate flex-1 text-left"
                        >
                          {item.label}
                        </motion.span>
                      )}

                      {!isCollapsed && isActive && (
                        <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary-foreground shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                      )}

                      {!isCollapsed && hasUnread && !isActive && (
                        <div className="absolute right-3 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {canScrollUp && (
          <div className="absolute top-0 inset-x-0 h-14 bg-gradient-to-b from-card via-card/90 to-transparent pointer-events-none flex justify-center pt-2 z-20">
            <motion.button
              type="button"
              onClick={() =>
                sidebarNavRef.current?.scrollBy({ top: -220, behavior: "smooth" })
              }
              initial={{ opacity: 0, y: -8, scale: 0.9 }}
              animate={{ opacity: 1, y: [0, -3, 0], scale: 1 }}
              transition={{
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
                y: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
              }}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              className="pointer-events-auto cursor-pointer relative w-10 h-8 rounded-full bg-card/95 backdrop-blur-xl border border-primary/20 shadow-lg shadow-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary flex items-center justify-center transition-colors overflow-hidden group/scroll"
              aria-label="Scroll sidebar up"
            >
              <span className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-blue-500/15 group-hover/scroll:opacity-0 transition-opacity" />
              <ChevronUp className="w-4 h-4 relative z-10" strokeWidth={2.5} />
            </motion.button>
          </div>
        )}

        {canScrollDown && (
          <div className="absolute bottom-0 inset-x-0 h-14 bg-gradient-to-t from-card via-card/90 to-transparent pointer-events-none flex justify-center items-end pb-2 z-20">
            <motion.button
              type="button"
              onClick={() =>
                sidebarNavRef.current?.scrollBy({ top: 220, behavior: "smooth" })
              }
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: [0, 3, 0], scale: 1 }}
              transition={{
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
                y: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
              }}
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              className="pointer-events-auto cursor-pointer relative w-10 h-8 rounded-full bg-card/95 backdrop-blur-xl border border-primary/20 shadow-lg shadow-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary flex items-center justify-center transition-colors overflow-hidden group/scroll"
              aria-label="Scroll sidebar down"
            >
              <span className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-blue-500/15 group-hover/scroll:opacity-0 transition-opacity" />
              <ChevronDown className="w-4 h-4 relative z-10" strokeWidth={2.5} />
            </motion.button>
          </div>
        )}
        </div>

        {user?.role === "admin" && (
          <div className={cn("relative z-30 shrink-0", isCollapsed ? "px-3 pb-3" : "px-3 pb-3 md:px-4 md:pb-4")}>
            {isCollapsed ? (
              <button
                type="button"
                onClick={() => {
                  navigate("/dashboard/ai-reporting");
                  setSidebarOpen(false);
                }}
                title="Ask 6A AI"
                className={cn(
                  "relative w-full aspect-square rounded-2xl flex items-center justify-center overflow-hidden border transition-all group cursor-pointer",
                  location.pathname === "/dashboard/ai-reporting"
                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/25"
                    : "bg-gradient-to-br from-primary/15 to-blue-500/10 text-primary border-primary/20 hover:border-primary/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/20",
                )}
              >
                <Sparkles className="w-6 h-6 relative z-10 group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/30" />
              </button>
            ) : (
              <div
                className={cn(
                  "group/ai-card relative overflow-hidden rounded-2xl border p-3 md:p-4 transition-all duration-300 cursor-pointer hover:-translate-y-0.5 md:hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/15 hover:ring-1 hover:ring-primary/25",
                  location.pathname === "/dashboard/ai-reporting"
                    ? "border-primary/50 bg-primary/10"
                    : "border-primary/20 bg-gradient-to-br from-primary/10 via-card to-blue-500/5 hover:border-primary/50",
                )}
                onClick={() => {
                  navigate("/dashboard/ai-reporting");
                  setSidebarOpen(false);
                }}
              >
                <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-primary/10 blur-2xl pointer-events-none transition-all duration-500 group-hover/ai-card:bg-primary/25 group-hover/ai-card:scale-150" />
                <div className="absolute inset-0 opacity-0 bg-gradient-to-tr from-primary/5 via-transparent to-blue-500/10 transition-opacity duration-300 group-hover/ai-card:opacity-100 pointer-events-none" />
                <div className="relative">
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 mb-2 md:mb-3 transition-all duration-300 group-hover/ai-card:scale-110 group-hover/ai-card:-rotate-6 group-hover/ai-card:shadow-primary/40">
                    <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 transition-transform duration-300 group-hover/ai-card:rotate-12" />
                  </div>
                  <h3 className="text-sm font-black tracking-tight transition-colors group-hover/ai-card:text-primary">
                    Ask 6A AI
                  </h3>
                  <p className="hidden md:block text-[11px] leading-4 text-muted-foreground mt-1">
                    Explore students, fees and admissions through conversation.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      navigate("/dashboard/ai-reporting");
                      setSidebarOpen(false);
                    }}
                    className="group/ai-button mt-2 md:mt-3 w-full py-1.5 md:py-2 px-3 rounded-xl bg-foreground text-background hover:bg-primary hover:text-primary-foreground text-[10px] md:text-[11px] font-black transition-all flex items-center justify-center gap-2 cursor-pointer hover:shadow-lg hover:shadow-primary/25 active:scale-[0.97]"
                  >
                    <Sparkles className="w-3.5 h-3.5 transition-transform group-hover/ai-button:rotate-12 group-hover/ai-button:scale-110" />
                    Start asking
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mobile-only Theme & Logout — explicitly hidden on md+ */}
        {!isCollapsed && (
          <div className="md:hidden px-4 py-4 space-y-2 border-t border-border/30 bg-background/10 shrink-0">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-card border border-border text-muted-foreground hover:text-primary transition-all shadow-sm"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
              <span className="text-sm font-bold">
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            </button>

            <button
              onClick={() => {
                setSidebarOpen(false);
                setShowLogoutWarning(true);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-sm"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-bold">Logout</span>
            </button>
          </div>
        )}

        <div className="p-4 border-t border-border bg-background/20">
          <div
            onClick={() => navigate("/dashboard/profile")}
            className={cn(
              "flex items-center rounded-2xl bg-card border border-border shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/20 group/user cursor-pointer",
              isCollapsed ? "justify-center p-2" : "space-x-3 px-3 py-3",
            )}
          >
            <div className="relative shrink-0">
              <User
                className={cn(
                  "rounded-full bg-primary/10 text-primary transition-all duration-300 group-hover/user:scale-110",
                  isCollapsed ? "w-10 h-10 p-2" : "w-9 h-9 p-2",
                )}
              />
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-card rounded-full shadow-sm" />
            </div>
            {!isCollapsed && (
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-sm font-black truncate leading-tight text-foreground group-hover/user:text-primary transition-colors">
                  {userName}
                </p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] font-black mt-1 opacity-70">
                  {userRole}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

// ─────────────────────────────────────────────
// DashboardLayout
// ─────────────────────────────────────────────

export const DashboardLayout = ({ children, title }) => {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = React.useRef(null);
  const { socket } = useSocket();
  const { items: notifications, unreadCount } = useSelector(
    (state) => state.notifications,
  );
  const { user } = useSelector((state) => state.user);
  const [unreadTicketChats, setUnreadTicketChats] = useState(0);
  const [showTicketChatWidget, setShowTicketChatWidget] = useState(false);
  const [ticketChatMessages, setTicketChatMessages] = useState([]);
  const [activeTicketChat, setActiveTicketChat] = useState(null);
  const [activeTicketHistory, setActiveTicketHistory] = useState([]);
  const [ticketReply, setTicketReply] = useState("");
  const activeTicketChatRef = React.useRef(null);
  React.useEffect(() => {
    activeTicketChatRef.current = activeTicketChat;
  }, [activeTicketChat]);

  React.useEffect(() => {
    if (user?.type !== "partner") return;
    (async () => {
      try {
        const metricsRes = await getTicketMetrics();
        if (metricsRes.success) setUnreadTicketChats(0);
      } catch (error) { console.error("Ticket widget fetch error:", error); }
    })();
  }, [user?.type]);

  React.useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  React.useEffect(() => {
    if (!socket) return;

    const handleNewTicketMessage = (data) => {
      if (user?.type === "partner") {
        const id = data.ticketId || data._id;
        const isActive = activeTicketChatRef.current && activeTicketChatRef.current._id === id;

        if (isActive) {
          setActiveTicketHistory((history) => [...history, data]);
        } else {
          setUnreadTicketChats((count) => count + 1);
        }

        setTicketChatMessages((messages) => {
          if (messages.some((ticket) => ticket._id === id)) {
            return messages.map((ticket) =>
              ticket._id === id
                ? {
                    ...ticket,
                    unread: isActive ? 0 : (ticket.unread || 0) + 1,
                    lastMessage: data.message || data.content,
                  }
                : ticket
            );
          }
          return [
            {
              _id: id,
              message: "Support Ticket",
              lastMessage: data.message || data.content,
              unread: isActive ? 0 : 1,
            },
            ...messages,
          ];
        });
      }
    };

    const handleNotification = (data) => {
      dispatch(addLiveNotification(data));

      // Speak the notification title aloud
      speakNotification(data.title);

      dispatch(
        showAlert({
          type: "info",
          message: `${data.title}: ${data.message}`,
        }),
      );

      // Trigger mobile/desktop OS notification bar alert via PWA service worker
      triggerOsNotification(data);
    };

    socket.on("notification", handleNotification);
    socket.on("new_ticket_message", handleNewTicketMessage);
    return () => {
      socket.off("notification", handleNotification);
      socket.off("new_ticket_message", handleNewTicketMessage);
    };
  }, [socket, dispatch, user?.type]);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showNotifications]);

  const handleNotificationClick = (notif) => {
    setShowNotifications(false);
    if (!notif.isRead) dispatch(markNotificationAsRead(notif._id));
    if (notif.link) navigate(notif.link);
  };

  const handleDeleteNotification = (e, id) => {
    e.stopPropagation();
    dispatch(deleteNotification(id));
  };

  const confirmLogout = () => {
    dispatch(logOut());
    navigate("/login");
  };

  const openTicketChat = async (ticket) => {
    setActiveTicketChat(ticket);
    setTicketChatMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg._id === ticket._id ? { ...msg, unread: 0 } : msg
      )
    );
    setUnreadTicketChats((prevCount) => {
      const currentTicketUnread = ticket.unread || 0;
      return Math.max(0, prevCount - currentTicketUnread);
    });
    try {
      const res = await getTicketById(ticket._id);
      if (res.success) setActiveTicketHistory(res.data.messages || []);
    } catch (error) { console.error("Ticket history fetch error:", error); }
  };

  const sendTicketReply = async (event) => {
    event.preventDefault();
    if (!activeTicketChat || !ticketReply.trim()) return;
    try {
      const res = await addMessage(activeTicketChat._id, ticketReply.trim());
      if (res.success) { setActiveTicketHistory((history) => [...history, res.data]); setTicketReply(""); }
    } catch (error) { console.error("Ticket reply error:", error); }
  };

  // Dropdown: latest 10 only
  const dropdownNotifications = notifications.slice(0, 10);

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar
        isOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        setShowLogoutWarning={setShowLogoutWarning}
      />

      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300 min-w-0",
          isCollapsed ? "md:pl-20" : "md:pl-64",
        )}
      >
        {/* Topbar */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between px-4 sm:px-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground">
              {title || "Dashboard"}
            </h1>
          </div>

          <div className="flex items-center space-x-3">
            {/* Notifications Bell */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 shadow-sm"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-background shadow-sm">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-[22rem] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col"
                    style={{ maxHeight: "480px" }}
                  >
                    {/* Dropdown Header */}
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-primary" />
                        <h3 className="font-bold text-sm text-foreground">
                          Notifications
                        </h3>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black">
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => dispatch(markAllNotificationsAsRead())}
                          className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1 font-bold"
                        >
                          <CheckCheck className="w-3 h-3" /> Mark all read
                        </button>
                      )}
                    </div>

                    {/* Dropdown List — latest 10 */}
                    <div className="overflow-y-auto flex-1">
                      {dropdownNotifications.length === 0 ? (
                        <div className="py-10 text-center text-muted-foreground text-sm flex flex-col items-center">
                          <Bell className="w-8 h-8 mb-2 opacity-20" />
                          <p className="font-medium">No notifications yet</p>
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {dropdownNotifications.map((notif) => {
                            const style = getTypeStyle(notif.type);
                            const IconComp = style.icon;
                            return (
                              <div
                                key={notif._id || notif.id}
                                className={cn(
                                  "p-3 rounded-xl transition-all cursor-pointer relative group border-l-2",
                                  style.border,
                                  notif.isRead
                                    ? "bg-transparent hover:bg-muted border-y border-r border-transparent hover:border-border"
                                    : "bg-primary/5 hover:bg-primary/10 border-y border-r border-primary/10",
                                )}
                                onClick={() => handleNotificationClick(notif)}
                              >
                                <div className="flex items-start gap-2.5 pr-6">
                                  <div
                                    className={cn(
                                      "mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center",
                                      notif.isRead
                                        ? "bg-muted"
                                        : "bg-primary/10",
                                    )}
                                  >
                                    <IconComp
                                      className={cn(
                                        "w-3.5 h-3.5",
                                        style.iconClass,
                                      )}
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4
                                      className={cn(
                                        "text-sm leading-snug truncate",
                                        notif.isRead
                                          ? "font-medium text-foreground/80"
                                          : "font-bold text-foreground",
                                      )}
                                    >
                                      {notif.title}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                      {notif.message}
                                    </p>
                                    <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                                      {getRelativeTime(notif.createdAt)}
                                    </span>
                                  </div>
                                  {!notif.isRead && (
                                    <div
                                      className={cn(
                                        "shrink-0 w-1.5 h-1.5 rounded-full mt-1.5",
                                        style.dot,
                                      )}
                                    />
                                  )}
                                </div>
                                <button
                                  onClick={(e) =>
                                    handleDeleteNotification(e, notif._id)
                                  }
                                  className="absolute right-2 top-2 p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Dropdown Footer */}
                    <div className="px-4 py-3 border-t border-border bg-muted/20 shrink-0">
                      <button
                        onClick={() => {
                          setShowNotifications(false);
                          navigate("/dashboard/notifications");
                        }}
                        className="w-full flex items-center justify-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
                      >
                        View All Notifications
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={toggleTheme}
              className="hidden md:flex p-2.5 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 shadow-sm"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setShowLogoutWarning(true)}
              className="hidden md:flex px-4 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors duration-200 font-medium text-sm items-center space-x-2 shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-8 overflow-x-hidden">{children}</main>
      </div>

      {user?.type === "partner" && (
        <div className="fixed bottom-6 right-6 z-40">
          {!showTicketChatWidget && unreadTicketChats > 0 && <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} onClick={() => { setShowTicketChatWidget(true); setUnreadTicketChats(0); }} className="relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/20 bg-card text-primary shadow-xl shadow-primary/10 transition hover:scale-105 hover:bg-primary/5" aria-label="Open ticket messages">
            <MessageSquare className="h-6 w-6" />
            <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-card bg-rose-500 px-1 text-[10px] font-black text-white">{unreadTicketChats}</span>
          </motion.button>}
          <AnimatePresence>{showTicketChatWidget && <motion.div initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }} className="absolute bottom-0 right-0 w-[min(23rem,calc(100vw-3rem))] overflow-hidden rounded-3xl border border-primary/20 bg-card shadow-2xl">
            <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                  <MessageSquare className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-black">Support Messages</p>
                  <p className="text-[10px] text-primary-foreground/80">{ticketChatMessages.length} ticket{ticketChatMessages.length === 1 ? "" : "s"}</p>
                </div>
              </div>
              <button
                onClick={() => setShowTicketChatWidget(false)}
                className="rounded-full p-1.5 hover:bg-white/20 text-primary-foreground transition-colors"
                aria-label="Close support messages"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {activeTicketChat ? <><div className="flex items-center gap-2 border-b border-border px-4 py-2"><button onClick={() => setActiveTicketChat(null)} className="text-xs font-bold text-primary">← All tickets</button><span className="truncate text-xs font-bold">{activeTicketChat.message}</span></div><div className="max-h-56 space-y-2 overflow-y-auto bg-muted/20 p-3">{activeTicketHistory.map((item, index) => <div key={item._id || index} className="rounded-xl bg-card p-2.5 text-xs shadow-sm"><p>{item.message || item.content}</p><span className="mt-1 block text-[9px] text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</span></div>)}</div><form onSubmit={sendTicketReply} className="flex gap-2 border-t border-border p-3"><input value={ticketReply} onChange={(e) => setTicketReply(e.target.value)} placeholder="Write a reply..." className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary" /><button className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">Send</button></form></> : <div className="max-h-72 divide-y divide-border overflow-y-auto">{ticketChatMessages.length ? ticketChatMessages.map((message, index) => <button key={message._id || index} onClick={() => openTicketChat(message)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">T</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-foreground">{message.message || "Support Ticket"}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{message.lastMessage || "Open ticket conversation"}</span></span>{message.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground">{message.unread}</span>}</button>) : <p className="py-8 text-center text-xs text-muted-foreground">No tickets yet.</p>}</div>}
            <button onClick={() => { setShowTicketChatWidget(false); navigate("/dashboard/tickets"); }} className="w-full border-t border-border px-4 py-3 text-center text-xs font-bold text-primary hover:bg-primary/5 dark:hover:bg-primary-foreground/5">Open all conversations</button>
          </motion.div>}</AnimatePresence>
        </div>
      )}

      {/* Logout Warning Modal */}
      <AnimatePresence>
        {showLogoutWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowLogoutWarning(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card w-full max-w-sm p-6 rounded-2xl shadow-xl border border-border flex flex-col"
            >
              <div className="flex items-center space-x-3 text-red-500 mb-4">
                <LogOut className="w-6 h-6" />
                <h3 className="text-xl font-bold text-foreground">
                  Confirm Logout
                </h3>
              </div>
              <p className="text-muted-foreground mb-6 text-sm flex-1">
                Are you sure you want to log out? You will need to sign in again
                to access the dashboard.
              </p>
              <div className="flex items-center justify-end space-x-3 mt-auto">
                <button
                  onClick={() => setShowLogoutWarning(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-muted text-foreground transition-colors font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmLogout}
                  className="px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors font-medium text-sm flex items-center space-x-2 shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
