import { Component, ChangeDetectionStrategy, signal, inject, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from './services/gemini.service';
import { AnalysisSection, TradingStrategy, BacktestResult } from './models/analysis.model';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { AnalysisCardComponent } from './components/analysis-card/analysis-card.component';
import { BacktestChartComponent } from './components/backtest-chart/backtest-chart.component';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, AnalysisCardComponent, BacktestChartComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .fade-in {
      animation: fadeIn 0.8s ease-in-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class AppComponent implements OnDestroy {
  private geminiService = inject(GeminiService);
  private readonly STORAGE_KEY = 'aiStockAnalyzerCache';
  private priceUpdateSubscription: Subscription | null = null;

  // Input signals
  ticker = signal<string>('NVDA');
  currentPrice = signal<number>(178.88);
  investmentAmount = signal<number | null>(null);
  positionPrice = signal<number | null>(null);
  investmentHorizon = signal<'短期' | '中期' | '长期'>('中期');
  volatilityPreference = signal<'偏好低波动' | '接受中等波动' | '寻求高波动机会'>('接受中等波动');
  riskTolerance = signal<'保守' | '稳健' | '激进'>('稳健');

  // State signals
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);
  isFromCache = signal<boolean>(false);

  // Multilingual analysis state
  analysisLanguage = signal<'zh' | 'en'>('zh');
  cachedAnalyses = signal<{ zh?: AnalysisSection[], en?: AnalysisSection[] }>({});
  analysisSections = computed(() => this.cachedAnalyses()[this.analysisLanguage()] ?? []);

  // Backtesting signals
  isBacktesting = signal<boolean>(false);
  backtestResult = signal<BacktestResult | null>(null);
  backtestError = signal<string | null>(null);
  tradableStrategy = computed<TradingStrategy | null>(() => {
    const sections = this.analysisSections();
    if (!sections) return null;
    const strategySection = sections.find(s => s.icon === 'arrows-trending-up');
    return strategySection?.strategy ?? null;
  });
  backtestSummaryEntries = computed(() => {
    const summary = this.backtestResult()?.summary;
    if (!summary) return [];
    return Object.entries(summary);
  });


  // For price update feature
  lastAnalyzedPrice = signal<number | null>(null);
  showPriceUpdateNotification = signal<boolean>(false);

  constructor() {
    this.loadFromCache();
  }

  ngOnDestroy(): void {
    this.stopPriceUpdates();
  }

  private loadFromCache(): void {
    try {
      const savedData = localStorage.getItem(this.STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        if(!parsedData.cachedAnalyses?.zh?.[5]?.strategy) {
          // Old cache format, clear it to avoid issues
          localStorage.removeItem(this.STORAGE_KEY);
          return;
        }

        this.ticker.set(parsedData.ticker);
        this.currentPrice.set(parsedData.currentPrice);
        this.investmentAmount.set(parsedData.investmentAmount);
        this.positionPrice.set(parsedData.positionPrice ?? null);
        this.investmentHorizon.set(parsedData.investmentHorizon);
        this.volatilityPreference.set(parsedData.volatilityPreference);
        this.riskTolerance.set(parsedData.riskTolerance);
        this.analysisLanguage.set(parsedData.analysisLanguage || 'zh');
        this.cachedAnalyses.set(parsedData.cachedAnalyses || {});
        this.isFromCache.set(true);

        this.lastAnalyzedPrice.set(parsedData.currentPrice);
        if (Object.keys(this.cachedAnalyses()).length > 0) {
          this.startPriceUpdates();
        }
      }
    } catch (e) {
      console.error('Failed to load or parse cached data:', e);
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
  
  clearAndReset(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.stopPriceUpdates();
    this.cachedAnalyses.set({});
    this.isFromCache.set(false);
    this.error.set(null);
    this.showPriceUpdateNotification.set(false);
    this.lastAnalyzedPrice.set(null);
    this.analysisLanguage.set('zh');
    this.isBacktesting.set(false);
    this.backtestResult.set(null);
    this.backtestError.set(null);

    // Reset inputs to default values
    this.ticker.set('NVDA');
    this.currentPrice.set(178.88);
    this.investmentAmount.set(null);
    this.positionPrice.set(null);
    this.investmentHorizon.set('中期');
    this.volatilityPreference.set('接受中等波动');
    this.riskTolerance.set('稳健');
  }

  handleTickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.ticker.set(input.value.toUpperCase());
  }

  handleCurrentPriceChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const price = parseFloat(input.value);
    if (!isNaN(price) && price >= 0) {
      this.currentPrice.set(price);
    }
  }

  handleInvestmentChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (value === '') {
      this.investmentAmount.set(null);
    } else {
      const amount = parseFloat(value);
      if (!isNaN(amount) && amount >= 0) {
        this.investmentAmount.set(amount);
      }
    }
  }

  handlePositionPriceChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (value === '') {
      this.positionPrice.set(null);
    } else {
      const price = parseFloat(value);
      if (!isNaN(price) && price >= 0) {
        this.positionPrice.set(price);
      }
    }
  }

  handleHorizonChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.investmentHorizon.set(select.value as '短期' | '中期' | '长期');
  }

  handleVolatilityChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.volatilityPreference.set(select.value as '偏好低波动' | '接受中等波动' | '寻求高波动机会');
  }
  
  handleRiskChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.riskTolerance.set(select.value as '保守' | '稳健' | '激进');
  }

  async analyzeStock(): Promise<void> {
    if (!this.ticker() || this.currentPrice() <= 0) {
      this.error.set('请输入有效的股票代码和正数的实时价格。');
      return;
    }
    
    this.isLoading.set(true);
    this.error.set(null);
    this.isFromCache.set(false);
    this.showPriceUpdateNotification.set(false);
    this.stopPriceUpdates();

    // Reset caches and backtest for a fresh analysis
    this.cachedAnalyses.set({});
    this.backtestResult.set(null);
    this.backtestError.set(null);

    try {
      const lang = this.analysisLanguage();
      const response = await this.geminiService.getStockAnalysis(
        this.ticker(), this.currentPrice(), this.investmentAmount() ?? 0, this.positionPrice(),
        this.riskTolerance(), this.investmentHorizon(), this.volatilityPreference(), lang
      );

      this.cachedAnalyses.update(cache => ({ ...cache, [lang]: response.analysis }));
      this.lastAnalyzedPrice.set(this.currentPrice());
      
      this.saveStateToCache();
      this.startPriceUpdates();

    } catch (e) {
      const err = e as Error;
      this.error.set(err.message);
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleLanguage(): Promise<void> {
    const newLang = this.analysisLanguage() === 'zh' ? 'en' : 'zh';
    this.analysisLanguage.set(newLang);
    
    // Also reset backtest result when switching language
    this.backtestResult.set(null);
    this.backtestError.set(null);

    this.saveStateToCache();

    if (!this.cachedAnalyses()[newLang] && Object.keys(this.cachedAnalyses()).length > 0) {
      this.isLoading.set(true);
      this.error.set(null);
      try {
        const response = await this.geminiService.getStockAnalysis(
          this.ticker(), this.currentPrice(), this.investmentAmount() ?? 0, this.positionPrice(),
          this.riskTolerance(), this.investmentHorizon(), this.volatilityPreference(), newLang
        );
        this.cachedAnalyses.update(cache => ({ ...cache, [newLang]: response.analysis }));
        this.saveStateToCache();
      } catch (e) {
        const err = e as Error;
        this.error.set(`Failed to fetch ${newLang === 'en' ? 'English' : 'Chinese'} analysis: ${err.message}`);
        this.analysisLanguage.set(newLang === 'zh' ? 'en' : 'zh'); // Revert on error
      } finally {
        this.isLoading.set(false);
      }
    }
  }

  async runBacktest(): Promise<void> {
    const strategy = this.tradableStrategy();
    if (!strategy) {
      this.backtestError.set('No strategy data available to run backtest.');
      return;
    }

    this.isBacktesting.set(true);
    this.backtestResult.set(null);
    this.backtestError.set(null);

    try {
      const result = await this.geminiService.getBacktestAnalysis(
        this.ticker(),
        strategy,
        this.analysisLanguage()
      );
      this.backtestResult.set(result);
    } catch (e) {
      const err = e as Error;
      this.backtestError.set(`Backtest failed: ${err.message}`);
    } finally {
      this.isBacktesting.set(false);
    }
  }

  private saveStateToCache(): void {
    const dataToSave = {
      ticker: this.ticker(),
      currentPrice: this.currentPrice(),
      investmentAmount: this.investmentAmount(),
      positionPrice: this.positionPrice(),
      investmentHorizon: this.investmentHorizon(),
      volatilityPreference: this.volatilityPreference(),
      riskTolerance: this.riskTolerance(),
      analysisLanguage: this.analysisLanguage(),
      cachedAnalyses: this.cachedAnalyses()
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToSave));
  }

  reAnalyzeWithNewPrice(): void {
    this.showPriceUpdateNotification.set(false);
    this.analyzeStock();
  }

  private startPriceUpdates(): void {
    this.stopPriceUpdates();
    this.priceUpdateSubscription = timer(15000, 15000).subscribe(async () => {
      const newPrice = await this.fetchSimulatedPrice();
      const lastPrice = this.lastAnalyzedPrice();
      if (lastPrice) {
        const changePercent = Math.abs(newPrice - lastPrice) / lastPrice;
        if (changePercent > 0.01) {
          this.currentPrice.set(newPrice);
          this.showPriceUpdateNotification.set(true);
          this.stopPriceUpdates(); // Stop polling once notification is shown
        }
      }
    });
  }

  private stopPriceUpdates(): void {
    this.priceUpdateSubscription?.unsubscribe();
    this.priceUpdateSubscription = null;
  }

  private async fetchSimulatedPrice(): Promise<number> {
    const basePrice = this.lastAnalyzedPrice() ?? this.currentPrice();
    const volatility = 0.015; 
    const randomFactor = (Math.random() - 0.5) * 2;
    const change = basePrice * volatility * randomFactor;
    const newPrice = basePrice + change;
    return Promise.resolve(parseFloat(newPrice.toFixed(2)));
  }
}