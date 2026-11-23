import { defineString } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";

const DEFAULT_APP_URL = "https://watchlist-wonders.app";

export const appUrlParam = defineString("APP_URL");

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function resolveAppUrl(): string {
  const configured = appUrlParam.value();
  if (typeof configured === "string" && configured.trim()) {
    return trimTrailingSlash(configured.trim());
  }

  logger.warn("[config] APP_URL not configured. Falling back to default.");
  return DEFAULT_APP_URL;
}
