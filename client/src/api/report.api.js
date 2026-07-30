import { axiosInstance } from "./axiosInstance";

export const getAcademicReport = async (groupBy) => {
  const res = await axiosInstance.get(`/reports/academic?groupBy=${groupBy}`);
  return res.data;
};

export const getAdmissionReport = async (type, options = {}) => {
  const { startDate, endDate } = options;
  let url = `/reports/admission?type=${type}`;
  if (startDate) url += `&startDate=${startDate}`;
  if (endDate) url += `&endDate=${endDate}`;
  
  const res = await axiosInstance.get(url);
  return res.data;
};

export const getDocumentReport = async (docType) => {
  const res = await axiosInstance.get(`/reports/documents?docType=${docType}`);
  return res.data;
};

export const getFinancialReport = async () => {
  const res = await axiosInstance.get("/reports/financial");
  return res.data;
};

export const getFeeWiseReport = async () => {
  const res = await axiosInstance.get("/reports/fee-wise");
  return res.data;
};

export const getReportConversations = async () => {
  const res = await axiosInstance.get("/reports/conversations");
  return res.data;
};

export const getReportConversation = async (conversationId, options = {}) => {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", options.limit);
  if (options.before) params.set("before", options.before);
  const query = params.toString();
  const res = await axiosInstance.get(
    `/reports/conversations/${conversationId}${query ? `?${query}` : ""}`,
  );
  return res.data;
};

export const askNaturalLanguageReport = async (question, conversationId) => {
  const res = await axiosInstance.post("/reports/ask", {
    question,
    conversationId: conversationId || undefined,
  });
  return res.data;
};
