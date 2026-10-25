/** Shared secret the /share and /media upload functions expect (not a real secret: it ships in the bundle). */
export const UPLOAD_SECRET: string =
  import.meta.env.VITE_ORBAT_SECRET ||
  "I9ZJ4z4FDtLFXpvHKIT2TALl7k9BUDRYr5Jj3IBF7A7Jp8KJDOR";
