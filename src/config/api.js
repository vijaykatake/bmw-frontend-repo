// src/config/api.js
const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
const defaultBaseUrl = import.meta.env.DEV ? '' : 'https://biomedicalwasted-001-site1.jtempurl.com'

export const API_BASE_URL = (configuredBaseUrl || defaultBaseUrl)
  .replace(/\/+$/, '')
  .replace(/\/api$/i, '')
