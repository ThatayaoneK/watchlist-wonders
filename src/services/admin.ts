import { httpsCallable } from 'firebase/functions';
import { fbFunctions } from '@/lib/firebase';

export interface IngestionDay {
  date: string;
  created: number;
  success: number;
  partial: number;
  error: number;
}

export interface SystemHealth {
  ingestion: IngestionDay[];
  failureRate: number;
  recentErrors: Array<{ stage: string; count: number }>;
  embedQueue: number;
}

export interface UserBehavior {
  totalUsers: number;
  totalBookmarks: number;
  savesByDay: Array<{ date: string; saves: number }>;
  captureByDay: Array<{
    date: string;
    total: number;
    autoSaved: number;
    needsSelection: number;
    unresolved: number;
    duplicate: number;
  }>;
  captureBySurface: Record<string, number>;
  captureByStatus: Record<string, number>;
  searchUsage: Array<{ date: string; queries: number; hits: number }>;
  deadBookmarkRatio: number;
  revisitRate: number;
}

export interface IntelligenceQuality {
  classifierDistribution: Record<string, number>;
  resolveDistribution: Record<string, number>;
  averageConfidence: number;
  suggestedRatio: number;
  autoTagsPerBookmark: number;
}

export interface ContentGraph {
  topClusters: Array<{ id: string; name: string; size: number; emerging: boolean; userId: string }>;
  totalClusters: number;
}

export interface Retention {
  surfaced: number;
  opened: number;
  dismissed: number;
  openRate: number;
  dismissRate: number;
  byDay: Array<{ date: string; surfaced: number; opened: number; dismissed: number }>;
}

function callable<Req, Res>(name: string) {
  return httpsCallable<Req, Res>(fbFunctions, name);
}

export const adminService = {
  async getSystemHealth(): Promise<SystemHealth> {
    return (await callable<unknown, SystemHealth>('adminSystemHealth')({})).data;
  },
  async getUserBehavior(): Promise<UserBehavior> {
    return (await callable<unknown, UserBehavior>('adminUserBehavior')({})).data;
  },
  async getIntelligenceQuality(): Promise<IntelligenceQuality> {
    return (await callable<unknown, IntelligenceQuality>('adminIntelligenceQuality')({})).data;
  },
  async getContentGraph(): Promise<ContentGraph> {
    return (await callable<unknown, ContentGraph>('adminContentGraph')({})).data;
  },
  async getRetention(): Promise<Retention> {
    return (await callable<unknown, Retention>('adminRetention')({})).data;
  },
};
