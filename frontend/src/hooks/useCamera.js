import { useCallback, useEffect, useRef, useState } from "react";
export default function useCamera() {
  const videoRef = useRef(null),
    streamRef = useRef(null),
    requestRef = useRef(0),
    mountedRef = useRef(false);
  const [active, setActive] = useState(false),
    [error, setError] = useState(""),
    [devices, setDevices] = useState([]);
  const refreshDevices = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices?.enumerateDevices();
      setDevices((list || []).filter((d) => d.kind === "videoinput"));
    } catch {
      setDevices([]);
    }
  }, []);
  const stop = useCallback(() => {
    requestRef.current++;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mountedRef.current) setActive(false);
  }, []);
  const start = useCallback(
    async (deviceId = "") => {
      stop();
      const request = requestRef.current;
      setError("");
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(
          "Camera access requires localhost or HTTPS and a supported browser.",
        );
        return false;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: "user" },
          audio: false,
        });
        if (!mountedRef.current || request !== requestRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return false;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setActive(true);
        await refreshDevices();
        return true;
      } catch (e) {
        stop();
        if (mountedRef.current)
          setError(
            e.name === "NotAllowedError"
              ? "Camera permission was denied. Allow access in your browser settings."
              : e.name === "NotFoundError"
                ? "No camera was found on this device."
                : `Could not start camera: ${e.message}`,
          );
        return false;
      }
    },
    [stop, refreshDevices],
  );
  useEffect(() => {
    mountedRef.current = true;
    refreshDevices();
    return () => {
      mountedRef.current = false;
      requestRef.current++;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [refreshDevices]);
  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.82);
  };
  return {
    videoRef,
    active,
    error,
    devices,
    start,
    stop,
    capture,
    refreshDevices,
  };
}
