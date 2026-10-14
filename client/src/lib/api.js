import { SERVER_URL } from "@/lib/socket";

// Unggah story lewat HTTP (pakai XHR supaya ada progres unggahan)
export function uploadStory({ groupId, token, uid, file, caption, onProgress }) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SERVER_URL}/api/stories`);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.setRequestHeader("x-group-id", groupId);
    xhr.setRequestHeader("x-token", token);
    xhr.setRequestHeader("x-uid", uid);
    if (caption) xhr.setRequestHeader("x-caption", encodeURIComponent(caption));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch {}
      resolve(xhr.status === 200 ? { ok: true } : { ok: false, error: body.error || "Gagal mengunggah story." });
    };
    xhr.onerror = () => resolve({ ok: false, error: "Koneksi gagal saat mengunggah." });
    xhr.send(file);
  });
}