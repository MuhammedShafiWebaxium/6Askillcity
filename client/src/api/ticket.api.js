import { axiosInstance } from "./axiosInstance";

export const createTicket = async (ticketData) => {
  try {
    const { data } = await axiosInstance.post("/tickets", ticketData);
    return data;
  } catch (error) {
    throw error;
  }
};

export const getTickets = async (params) => {
  try {
    const { data } = await axiosInstance.get("/tickets", { params });
    return data;
  } catch (error) {
    throw error;
  }
};

export const getTicketMetrics = async (params) => {
  try {
    const { data } = await axiosInstance.get("/tickets/metrics", { params });
    return data;
  } catch (error) {
    throw error;
  }
};

export const getTicketById = async (ticketId) => {
  try {
    const { data } = await axiosInstance.get(`/tickets/${ticketId}`);
    return data;
  } catch (error) {
    throw error;
  }
};

export const updateTicketStatus = async (ticketId, status, postponedUntil = null) => {
  try {
    const { data } = await axiosInstance.patch(`/tickets/${ticketId}/status`, { status, postponedUntil });
    return data;
  } catch (error) {
    throw error;
  }
};

export const addMessage = async (ticketId, message) => {
  try {
    const { data } = await axiosInstance.post(`/tickets/${ticketId}/messages`, { message });
    return data;
  } catch (error) {
    throw error;
  }
};

export const getTicketAiAssistance = async (ticketId) => {
  const { data } = await axiosInstance.post(`/tickets/${ticketId}/ai-assist`);
  return data;
};
