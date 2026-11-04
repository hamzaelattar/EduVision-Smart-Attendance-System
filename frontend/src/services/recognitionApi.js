import { API_BASE_URL } from "./api";
// Reserved for a future backend contract. It is never called by Demo Mode.
export const recognitionSocketUrl = () =>
  `${API_BASE_URL.replace(/^http/i, "ws").replace(/\/$/, "")}/ws/recognition`;
