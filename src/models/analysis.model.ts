export interface TradingStrategy {
  entryRange: string;
  averagingDownRange1: string;
  averagingDownRange2: string;
  scalingInRange1: string;
  scalingInRange2: string;
  stopLoss: string;
  profitTarget1: string;
  profitTarget2: string;
}

export interface AnalysisSection {
  title: string;
  icon: string; // A keyword for an icon, e.g., 'chart-bar'
  content: string;
  strategy?: TradingStrategy;
}

export interface AnalysisResponse {
  analysis: AnalysisSection[];
}

export interface BacktestSummary {
  [metric: string]: string;
}

export interface BacktestChartDataPoint {
  date: string; // 'YYYY-MM-DD'
  value: number;
}

export interface BacktestResult {
  summary: BacktestSummary;
  narrative: string;
  verdict: string;
  chartData: BacktestChartDataPoint[];
}