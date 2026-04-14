// Token utility functions for localStorage
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
};

export const removeToken = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const hasToken = (): boolean => {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem(TOKEN_KEY);
};

// User info functions
export const getUser = (): any | null => {
  if (typeof window === 'undefined') return null;
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
};

export const setUser = (user: any): void => {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
};

export const removeUser = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
};
