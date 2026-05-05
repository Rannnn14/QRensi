import { getLocalDateValue } from "./date";

export const PASSWORD_REQUEST_TYPE = "ganti_password";
export const SUBMISSION_CUTOFF_HOUR = 24;

type PasswordRequestPayload = {
  password: string;
  alasan: string;
  email?: string;
};

const PASSWORD_REQUEST_PREFIX = "password_request::";

export const isPasswordRequest = (jenis?: string | null) => jenis === PASSWORD_REQUEST_TYPE;

export const buildPasswordRequestNote = (payload: PasswordRequestPayload) =>
  `${PASSWORD_REQUEST_PREFIX}${JSON.stringify(payload)}`;

export const parsePasswordRequestNote = (note?: string | null): PasswordRequestPayload | null => {
  if (!note || !note.startsWith(PASSWORD_REQUEST_PREFIX)) {
    return null;
  }

  try {
    return JSON.parse(note.slice(PASSWORD_REQUEST_PREFIX.length)) as PasswordRequestPayload;
  } catch {
    return null;
  }
};

export const getSubmissionDisplayNote = (jenis?: string | null, note?: string | null) => {
  if (isPasswordRequest(jenis)) {
    const payload = parsePasswordRequestNote(note);
    if (!payload) {
      return "Permintaan ganti kata sandi diajukan ke admin.";
    }

    return payload.email
      ? `Email login: ${payload.email}\nAlasan: ${payload.alasan}`
      : payload.alasan;
  }

  return note || "-";
};

export const getSubmissionDisplayType = (jenis?: string | null) => {
  if (jenis === "izin") return "Izin";
  if (jenis === "sakit") return "Sakit";
  if (isPasswordRequest(jenis)) return "Ganti Kata Sandi";
  return jenis || "-";
};

export const getSubmissionStatusLabel = (status?: string | null) => {
  if (status === "pending") return "Menunggu";
  if (status === "approved") return "Disetujui";
  if (status === "rejected") return "Ditolak";
  return status || "-";
};

export const isPastSubmissionCutoff = (date = new Date()) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();

  return hours > SUBMISSION_CUTOFF_HOUR || (hours === SUBMISSION_CUTOFF_HOUR && minutes > 0);
};

export const getSubmissionCutoffLabel = () => "24.00";

export const getDefaultAttendanceStatus = (date = new Date()) =>
  isPastSubmissionCutoff(date) ? "Tidak Hadir" : "Belum Absen";

export const formatSubmissionTime = (createdAt?: string | null) => {
  if (!createdAt) return "-";

  return new Date(createdAt).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatSubmissionDateTime = (createdAt?: string | null) => {
  if (!createdAt) return "-";

  return new Date(createdAt).toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatSubmissionDate = (createdAt?: string | null) => {
  if (!createdAt) return "-";

  return new Date(createdAt).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

export const isTodaySubmission = (createdAt?: string | null, date = new Date()) => {
  if (!createdAt) return false;

  return getLocalDateValue(new Date(createdAt)) === getLocalDateValue(date);
};
