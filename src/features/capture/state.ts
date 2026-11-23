export type CaptureState =
  | "idle"
  | "extracting"
  | "fetching"
  | "saved"
  | "duplicate"
  | "needs_selection"
  | "unsupported"
  | "metadata_unavailable"
  | "offline_queued";

export const CAPTURE_MESSAGES: Record<CaptureState, string> = {
  idle: "",
  extracting: "Reading the pasted link…",
  fetching: "Fetching title and artwork…",
  saved: "Saved to your library.",
  duplicate: "Already saved in your library.",
  needs_selection: "Choose the matching title to finish saving.",
  unsupported: "That link is not supported. You can still add the title manually.",
  metadata_unavailable: "Details are unavailable right now. Your original link is still here.",
  offline_queued: "Saved offline. It will be processed when you reconnect.",
};
