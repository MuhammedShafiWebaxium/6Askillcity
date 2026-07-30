import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { X, Send, ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2, GraduationCap, Sparkles, Loader2 } from "lucide-react";
import { cn } from "../../components/dashboard/StatCard";
import { useSelector, useDispatch } from "react-redux";
import { showAlert } from "../../redux/alertSlice";
import { getTicketById, addMessage, updateTicketStatus, createTicket, getTicketAiAssistance } from "../../api/ticket.api";
import { getAllApprovedAdmissionPoints } from "../../api/admissionPoint.api";
import { getAllUsers } from "../../api/auth.api";
import { useSocket } from "../../context/SocketContext";

export default function TicketChat({ ticket, onClose, prefilledStudentId, prefilledCategory }) {
  const { user } = useSelector((s) => s.user);
  const dispatch = useDispatch();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(!ticket?.isNew);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ticketState, setTicketState] = useState(ticket);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAssistance, setAiAssistance] = useState(null);

  const userId = user?.userId || user?._id;
  const isCreator  = ticket && (ticket.creatorId?._id === userId || ticket.creatorId === userId);
  const isAssigned = ticket && (ticket.assignedToPartner?._id === userId || ticket.assignedToPartner === userId);

  const messagesEndRef = useRef(null);
  const messageInputRef = useRef(null);
  const { socket } = useSocket();

  // new-ticket fields
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority]     = useState("Medium");
  const [category, setCategory]     = useState(prefilledCategory || "Other");
  const [assigneeType, setAssigneeType] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [partners, setPartners]     = useState([]);
  const [usersList, setUsersList]   = useState([]);

  // chat fields
  const [status, setStatus]             = useState(ticket?.status || "Received");
  const [postponedUntil, setPostponedUntil] = useState(
    ticket?.postponedUntil ? ticket.postponedUntil.split("T")[0] : ""
  );
  const isClosed = ticketState?.status === "Closed" || status === "Closed";
  const canUpdateStatus = (user?.type === "admin" || (user?.type === "partner" && !isCreator && isAssigned)) && !isClosed;
  const canReopen = isClosed && (
    user?.type === "admin" ||
    (user?.type === "partner" && (isCreator || isAssigned))
  );


  /* ── data loading ── */
  useEffect(() => {
    if (ticket && !ticket.isNew) {
      (async () => {
        try {
          setLoading(true);
          const res = await getTicketById(ticket._id);
          if (res.success) {
            setTicketState(res.data.ticket);
            setMessages(res.data.messages);
            setStatus(res.data.ticket.status);
            if (res.data.ticket.postponedUntil)
              setPostponedUntil(res.data.ticket.postponedUntil.split("T")[0]);
          }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
      })();
    } else if (ticket?.isNew && user?.type === "admin") {
      (async () => {
        try {
          const [pRes, uRes] = await Promise.all([getAllApprovedAdmissionPoints(), getAllUsers()]);
          if (pRes.success) setPartners(pRes.data);
          if (uRes.success) setUsersList(uRes.data);
        } catch (e) { console.error(e); }
      })();
    }
  }, [ticket, user]);

  /* ── socket listener ── */
  useEffect(() => {
    if (!socket || ticket?.isNew) return;
    const fn = (msg) => { if (msg.ticketId === ticket._id) setMessages(p => [...p, msg]); };
    socket.on("new_ticket_message", fn);
    return () => socket.off("new_ticket_message", fn);
  }, [socket, ticket]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    const input = messageInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(Math.max(input.scrollHeight, 96), 192)}px`;
  }, [newMessage]);

  /* ── handlers ── */
  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const res = await addMessage(ticket._id, newMessage);
      if (res.success) setNewMessage("");
    } catch (e) { console.error(e); }
    finally { setIsSubmitting(false); }
  };

  const handleStatusChange = async (newStatus, fromPicker = false) => {
    try {
      if (newStatus === "Postponed" && !fromPicker) { setStatus("Postponed"); return; }
      if (newStatus === "Postponed" && !postponedUntil) { alert("Please select a date first"); return; }
      setIsSubmitting(true);
      const res = await updateTicketStatus(ticket._id, newStatus, newStatus === "Postponed" ? postponedUntil : null);
      setStatus(newStatus);
      if (res.success) {
        setTicketState(res.data);
      }
    } catch (e) { 
      console.error(e); 
      dispatch(showAlert({ 
        type: "error", 
        message: e.response?.data?.message || "Failed to update ticket status. The ticket may already be closed."
      }));
      setStatus(ticketState?.status || "Received"); // Revert
    }
    finally { setIsSubmitting(false); }
  };

  const handleAiAssist = async () => {
    try {
      setAiLoading(true);
      const res = await getTicketAiAssistance(ticket._id);
      if (res.success) setAiAssistance(res.data);
    } catch (e) {
      dispatch(showAlert({
        type: "error",
        message: e.response?.data?.message || "Unable to generate AI assistance.",
      }));
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title || !description || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const payload = { title, description, priority, category };
      if (assigneeType === "partner" && assigneeId) payload.assignedToPartner = assigneeId;
      if (assigneeType === "user"    && assigneeId) payload.assignedTo        = assigneeId;
      if (prefilledStudentId) payload.studentId = prefilledStudentId;
      const res = await createTicket(payload);
      if (res.success) onClose();
    } catch (e) { console.error(e); }
    finally { setIsSubmitting(false); }
  };

  /* ── render ── */
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm">
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 220 }}
        className="w-full sm:max-w-lg bg-card h-full shadow-2xl border-l border-border flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0 shadow-sm">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0 sm:hidden">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold truncate">
                {ticket?.isNew ? "Create New Ticket" : ticket.title}
              </h2>
              {ticket?.isNew && prefilledStudentId && (
                <p className="text-xs text-primary font-bold">For Student: {ticket.studentName || "Selected Student"}</p>
              )}
              {!ticket?.isNew && ticketState?.studentId && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                  <Link
                    to={`/dashboard/student-management/${ticketState.studentId._id || ticketState.studentId}`}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1 group"
                  >
                    <span>{ticketState.studentId.name}</span>
                    <ChevronRight className="w-3 h-3 text-primary/70 group-hover:text-primary transition-colors shrink-0" />
                  </Link>
                  <span className="text-[10px] text-muted-foreground">• {ticketState.studentId.enrollmentNumber || "No EN"}</span>
                </div>
              )}
              {!ticket?.isNew && (
                <p className="text-[10px] text-muted-foreground truncate opacity-70">Ticket ID: #{ticket._id}</p>
              )}
            </div>
          </div>
          <button onClick={onClose}
            className="hidden sm:flex p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {ticket?.isNew ? (
          /* ── Create Form ── */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                  placeholder="Summarize your issue..."
                  className="w-full border border-border bg-background px-4 py-2.5 rounded-xl focus:outline-none focus:border-primary text-sm transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} required
                  placeholder="Provide details..." rows={5}
                  className="w-full border border-border bg-background px-4 py-2.5 rounded-xl focus:outline-none focus:border-primary text-sm resize-none transition-colors" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)}
                  className="w-full border border-border bg-background px-4 py-2.5 rounded-xl focus:outline-none focus:border-primary text-sm">
                  {["Low", "Medium", "High", "Critical"].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-border bg-background px-4 py-2.5 rounded-xl focus:outline-none focus:border-primary text-sm">
                  {["Student", "Finance", "University", "Application", "Course Fee", "Additional Documents", "Other"].map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
              {user?.type === "admin" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Assign To</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select value={assigneeType} onChange={(e) => { setAssigneeType(e.target.value); setAssigneeId(""); }}
                      className="sm:w-1/3 border border-border bg-background px-4 py-2.5 rounded-xl focus:outline-none focus:border-primary text-sm">
                      <option value="">None (Unassigned)</option>
                      <option value="user">Admin/User</option>
                      <option value="partner">Partner</option>
                    </select>
                    {assigneeType === "partner" && (
                      <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} required
                        className="flex-1 border border-border bg-background px-4 py-2.5 rounded-xl focus:outline-none focus:border-primary text-sm">
                        <option value="">-- Select Partner --</option>
                        {partners.map(p => <option key={p._id} value={p._id}>{p.centerName} ({p.licenseeName})</option>)}
                      </select>
                    )}
                    {assigneeType === "user" && (
                      <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} required
                        className="flex-1 border border-border bg-background px-4 py-2.5 rounded-xl focus:outline-none focus:border-primary text-sm">
                        <option value="">-- Select User --</option>
                        {usersList.map(u => <option key={u._id} value={u._id}>{u.fullName} ({u.role})</option>)}
                      </select>
                    )}
                  </div>
                </div>
              )}
              <button type="submit" disabled={isSubmitting}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-medium shadow-sm hover:bg-primary/90 transition-all disabled:opacity-70 flex justify-center items-center gap-2">
                {isSubmitting ? "Creating..." : "Submit Ticket"}
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Status bar */}
            <div className="px-4 sm:px-6 py-2.5 border-b border-border bg-muted/20 flex flex-wrap gap-3 items-center shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</span>
                {canUpdateStatus ? (
                  <select value={status} onChange={(e) => handleStatusChange(e.target.value)} disabled={isSubmitting}
                    className="text-xs font-medium border border-border rounded-lg bg-background px-2 py-1 outline-none focus:border-primary">
                    {["Received", "On Progress", "Closed", "Postponed", "Reopened"].map(s => <option key={s}>{s}</option>)}
                  </select>
                ) : (
                  <span className="text-xs font-medium px-2 py-1 rounded-lg bg-muted">{status}</span>
                )}
              </div>
              {canReopen && (
                <button
                  type="button"
                  onClick={() => handleStatusChange("Reopened")}
                  disabled={isSubmitting}
                  className="text-xs font-bold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                  Re-open Ticket
                </button>
              )}
              {status === "Postponed" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <CalendarIcon className="w-4 h-4 text-purple-500 shrink-0" />
                  {canUpdateStatus ? (
                    <>
                      <input type="date" value={postponedUntil} min={new Date().toISOString().split("T")[0]}
                        onChange={(e) => setPostponedUntil(e.target.value)}
                        className="text-xs border border-border rounded-lg bg-background px-2 py-1 outline-none" />
                      <button onClick={() => handleStatusChange("Postponed", true)}
                        disabled={isSubmitting || !postponedUntil}
                        className="text-xs bg-purple-500 text-white px-3 py-1 rounded-lg disabled:opacity-50 hover:bg-purple-600 transition-colors">
                        Save
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Until {postponedUntil ? new Date(postponedUntil).toLocaleDateString() : "—"}
                    </span>
                  )}
                </div>
              )}
              {isClosed && ticketState?.closedAt && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground border-l border-border pl-3 ml-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>
                    Closed by <span className="font-semibold text-foreground">{ticketState.closedByModel === "AdmissionPoint" ? ticketState.closedBy?.centerName : ticketState.closedBy?.fullName}</span> on {new Date(ticketState.closedAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {user?.type === "admin" && (
              <div className="px-4 sm:px-6 py-3 border-b border-border bg-primary/5 shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      AI Support Assistant
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Generates a summary and editable reply. Nothing is sent automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAiAssist}
                    disabled={aiLoading}
                    className="shrink-0 text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {aiLoading ? "Analyzing..." : "Assist"}
                  </button>
                </div>
                {aiAssistance && (
                  <div className="mt-3 rounded-xl border border-primary/20 bg-background p-3 space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-muted">
                        {aiAssistance.urgency} urgency
                      </span>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-muted">
                        {aiAssistance.sentiment}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-muted">
                        {aiAssistance.category}
                      </span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">
                      <span className="font-bold">Summary: </span>{aiAssistance.summary}
                    </p>
                    {aiAssistance.recommendedAction && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-bold text-foreground">Next action: </span>{aiAssistance.recommendedAction}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setNewMessage(aiAssistance.suggestedReply)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Use suggested reply
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-muted/5">
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.senderId?._id === userId || msg.senderId === userId;
                  const isSystem = msg.message?.startsWith("Updated ticket status");
                  if (isSystem) {
                    const senderName = msg.senderModel === "AdmissionPoint" 
                      ? msg.senderId?.centerName 
                      : msg.senderId?.fullName;
                    const timeStr = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now";
                    
                    return (
                      <div key={msg._id || i} className="flex justify-center my-3">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] text-muted-foreground bg-muted border border-border px-3 py-1 rounded-full shadow-sm">
                            <span className="font-semibold text-foreground mr-1">{senderName}</span>
                            {msg.message.replace(/^Updated ticket status to/, "changed status to")}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">{timeStr}</span>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <motion.div key={msg._id || i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-2.5 shadow-sm",
                        isMe ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-background border border-border text-foreground rounded-tl-sm"
                      )}>
                        {!isMe && (
                          <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                            {msg.senderModel === "AdmissionPoint" ? msg.senderId?.centerName : msg.senderId?.fullName}
                          </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        <div className={cn("text-[10px] mt-1.5 text-right", isMe ? "text-primary-foreground/60" : "text-muted-foreground")}>
                          {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now"}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 sm:p-4 bg-card border-t border-border shrink-0">
              <form onSubmit={handleSend} className="flex items-end gap-2">
                <textarea ref={messageInputRef} value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-muted border border-transparent focus:bg-background focus:border-border rounded-xl px-4 py-3 outline-none text-sm resize-y min-h-24 max-h-48 transition-colors leading-relaxed"
                  rows={3}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }} />
                <button type="submit" disabled={!newMessage.trim() || isSubmitting}
                  className="p-3 bg-primary text-primary-foreground rounded-xl shadow-sm hover:bg-primary/90 transition-all disabled:opacity-50 shrink-0">
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
