const TOKEN_KEY = "eduvision-live-token";

export const liveToken = () => sessionStorage.getItem(TOKEN_KEY) || "";
export const saveLiveToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearLiveToken = () => sessionStorage.removeItem(TOKEN_KEY);

export async function liveRequest(path, { method = "GET", body, token = liveToken() } = {}) {
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Erreur HTTP ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

export function waitForIce(pc) {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pc.removeEventListener("icegatheringstatechange", check);
      reject(new Error("ICE gathering timed out"));
    }, 15000);
    function check() {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    }
    pc.addEventListener("icegatheringstatechange", check);
    check();
  });
}
