import { API_BASE } from "../config/api";

export async function safeFetch(url, options = {}) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('Cannot connect to server. Please check your network connection.');
    }
    throw err;
  }
}

export async function authFetch(url, options = {}) {
  const token = localStorage.getItem("authToken");

  if (!token) {
    throw new Error("Missing auth token");
  }

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  headers.Authorization = `Bearer ${token}`;

  return safeFetch(API_BASE + url, {
    ...options,
    headers
  });
}