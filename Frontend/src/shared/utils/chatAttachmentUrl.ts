// Append Supabase's &download=<name> param so a signed URL responds with
// Content-Disposition: attachment — i.e. the browser SAVES the file instead of
// opening/streaming it. Used by the message menu and the inline download
// buttons so every attachment type (image, document, voice) downloads the same
// reliable way.
export function forceDownloadUrl(url: string, filename: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}download=${encodeURIComponent(filename || "download")}`;
}
