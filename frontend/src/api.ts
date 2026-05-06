import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export const TOKEN_KEY = 'propflo.access_token';

export async function getToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

export type User = { id: string; email: string; name: string; role: string; created_at: string };
export type Lead = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: string;
  status: string;
  temperature: 'hot' | 'warm' | 'cold';
  budget?: number | null;
  interest?: string;
  notes?: string;
  ai_summary?: string | null;
  created_at: string;
};
export type Property = {
  id: string;
  title: string;
  location: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  type: string;
  status: string;
  image_url?: string;
  description?: string;
  created_at: string;
};
export type Deal = {
  id: string;
  title: string;
  client_name: string;
  property_title?: string;
  value: number;
  stage: string;
  expected_close?: string;
  notes?: string;
  created_at: string;
};
export type Task = {
  id: string;
  title: string;
  type: string;
  due_at: string;
  related_to?: string;
  priority: 'low' | 'medium' | 'high';
  completed: boolean;
  notes?: string;
  created_at: string;
};
export type Contact = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type: string;
  notes?: string;
  created_at: string;
};
export type DashboardStats = {
  total_leads: number;
  hot_leads: number;
  properties: number;
  available_properties: number;
  total_deals: number;
  won_deals: number;
  revenue: number;
  pipeline_value: number;
  tasks_today: number;
  conversion_rate: number;
  leads_by_temperature: { hot: number; warm: number; cold: number };
};
