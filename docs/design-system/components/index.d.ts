import type * as React from 'react';
import type { ThemeConfig } from 'antd';

export declare const theme: ThemeConfig;

export interface FinePrintProviderProps { children?: React.ReactNode }
export declare function FinePrintProvider(props: FinePrintProviderProps): React.ReactElement;

export interface LogoProps { variant?: 'wordmark' | 'mark'; size?: number; title?: string }
export declare function Logo(props: LogoProps): React.ReactElement;

export type Severity = 'critical' | 'caution' | 'good';
export type AssetStatus = 'pending' | 'changes-required' | 'approved-with-changes' | 'approved' | 'rejected';
export type Status = Severity | AssetStatus;
export interface StatusTagProps { status: Status; label?: string }
export declare function StatusTag(props: StatusTagProps): React.ReactElement;

export interface ChecksSummaryProps { critical?: number; caution?: number; good?: number; passedItems?: string[] }
export declare function ChecksSummary(props: ChecksSummaryProps): React.ReactElement;

export interface QueueItemProps {
  title: string;
  sourceKind?: 'internal' | 'affiliate';
  product?: string;
  channel?: string;
  round?: number;
  status: AssetStatus;
  statusLabel?: string;
  due?: string;
  overdue?: boolean;
  selected?: boolean;
  kind?: 'image' | 'text';
  thumb?: string;
  onClick?: () => void;
}
export declare function QueueItem(props: QueueItemProps): React.ReactElement;

export interface AdBox { n: number; x: number; y: number; w: number; h: number; label?: string }
export interface AdReviewProps { src: string; alt: string; boxes?: AdBox[]; active?: number; width?: number; onSelect?: (n: number) => void }
export declare function AdReview(props: AdReviewProps): React.ReactElement;

declare global {
  interface Window {
    FinePrint: {
      theme: ThemeConfig; FinePrintProvider: typeof FinePrintProvider; Logo: typeof Logo; StatusTag: typeof StatusTag;
      ChecksSummary: typeof ChecksSummary; QueueItem: typeof QueueItem; AdReview: typeof AdReview;
    };
  }
}
