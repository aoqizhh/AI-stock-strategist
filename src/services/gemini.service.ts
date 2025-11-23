import { Injectable, signal } from '@angular/core';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { AnalysisResponse, TradingStrategy, BacktestResult } from '../models/analysis.model.ts';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private genAI: GoogleGenAI;
  
  constructor() {
    // IMPORTANT: The API key is sourced from environment variables for security.
    // Do not hardcode API keys in the application.
    if (!process.env.API_KEY) {
      throw new Error("API_KEY environment variable not set.");
    }
    this.genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async getStockAnalysis(
    ticker: string, 
    currentPrice: number, 
    investmentAmount: number,
    positionPrice: number | null,
    riskTolerance: '保守' | '稳健' | '激进',
    investmentHorizon: '短期' | '中期' | '长期',
    volatilityPreference: '偏好低波动' | '接受中等波动' | '寻求高波动机会',
    language: 'zh' | 'en'
  ): Promise<AnalysisResponse> {
    const model = 'gemini-2.5-flash';
    let prompt: string;

    const tradingStrategyPromptEN = `
      6.  **Trading Strategy Reference**:
          - Based on all the analysis above, the user's planned total investment of $${investmentAmount.toLocaleString()}, and their personal preferences, provide a specific, actionable trading strategy reference.
          - **You must first use an HTML table to clearly display the core strategy parameters and add the specified CSS classes to the table elements to ensure readability on a dark background**. The table should have "Strategy Item", "Price/Range", and "Notes" columns.
          - The table content must cover: Entry Range, Averaging Down Range 1, Averaging Down Range 2, Scaling In Range 1, Scaling In Range 2, Stop-Loss Point, and two take-profit targets (Profit Target 1 and Profit Target 2).
          - **Below the table, provide a detailed explanation of the strategy's execution details and rationale. The overall strategy should be designed to maximize potential returns while maintaining a high probability of success.**
          - **In addition to the HTML content, you MUST populate the 'strategy' JSON object with the exact string values for all strategy parameters.** For example: \`"strategy": {"entryRange": "$170.00 - $175.00", "averagingDownRange1": "$165.00", "averagingDownRange2": "$160.00", "scalingInRange1": "$185.00", "scalingInRange2": "$190.00", "stopLoss": "$155.00", "profitTarget1": "$195.00", "profitTarget2": "$205.00"}\`.
          - **Finally, you must include the following disclaimer**:
          - \`<p class='mt-4 text-xs text-gray-400'>Disclaimer: This analysis is AI-generated based on simulated and public data, intended for informational and educational purposes only. It does not constitute any investment advice. The stock market is risky; invest with caution.</p>\`
          - icon: 'arrows-trending-up'
    `;

    if (language === 'en') {
      // Mappings for preferences
      const riskMap = { '保守': 'Conservative', '稳健': 'Moderate', '激进': 'Aggressive' };
      const horizonMap = { '短期': 'Short-term', '中期': 'Medium-term', '长期': 'Long-term' };
      const volatilityMap = { 
        '偏好低波动': 'Prefers Low Volatility', 
        '接受中等波动': 'Accepts Medium Volatility', 
        '寻求高波动机会': 'Seeks High Volatility Opportunities' 
      };
      
      let userPositionPromptEN = `The user is analyzing the stock ${ticker}, providing the latest real-time price of $${currentPrice.toFixed(2)}, with a planned total investment of $${investmentAmount.toLocaleString()}.`;
      if (positionPrice !== null) {
        userPositionPromptEN += ` The user currently holds a position with an average cost of $${positionPrice.toFixed(2)}.`;
      } else {
        userPositionPromptEN += ' The user does not currently hold a position.';
      }

      const userPreferencesPromptEN = `The user's risk tolerance is '${riskMap[riskTolerance]}', their investment horizon is '${horizonMap[investmentHorizon]}', and their market volatility preference is '${volatilityMap[volatilityPreference]}'.`;

      prompt = `
      You are a top-tier AI stock technical analyst and strategist, specializing in the NASDAQ market.

      **Highest Priority Directive: Principles of Analysis & Data Accuracy**
      - **Absolute Real-time Data**: User feedback emphasizes that all analysis must be based on the absolute latest, to-the-minute NASDAQ real-time market data. The use of any simulated, delayed, or outdated data is strictly forbidden. You must use the user-provided real-time price of $${currentPrice.toFixed(2)} as the benchmark for your analysis.
      - **Data Source Verification**: Before generating any numbers (especially technical indicators), you must internally cross-verify your data sources to ensure they are the most current and authoritative for NASDAQ.
      - **Fact-Based, No Assumptions**: User feedback indicates that the analysis must be grounded in verifiable historical price data and factual information. The use of any hypothetical language, such as "assuming the stock has had a major pullback" or "if market sentiment turns bullish," is strictly prohibited. All analysis and strategic recommendations must be derived from real data and the current market conditions, not from imaginary scenarios.

      ${userPositionPromptEN}
      ${userPreferencesPromptEN}

      Based on the highest priority directives above, the user-provided real-time price, global market and policy information, and queryable historical stock data, combined with the user's personal preferences, generate a detailed, professional, and personalized analysis report.
      If the stock does not trade on NASDAQ, please state this clearly and provide information on its primary exchange.
      The report must contain the following six sections and strictly adhere to the specified JSON format. The content must be professional, data-driven, and easy to read. **Crucially, the trading strategy must be optimized for maximum achievable returns and include clear guidance on averaging down and scaling in.** For all sections except "Trading Strategy Reference", the "strategy" field in the JSON output should be null.

      1.  **Current Price Analysis**:
          - Analyze the significance of the current price point of $${currentPrice.toFixed(2)} using technical charts.
          - Is it near a key support or resistance level? What does this price indicate for the short-term trend (up, down, or consolidation)?
          - icon: 'price-tag'

      2.  **Fundamental Analysis**: 
          - Based on the latest earnings reports and news, briefly analyze the company's core business, industry position, and future growth potential.
          - icon: 'beaker'

      3.  **Technical Indicator Analysis**: 
          - Analyze recent price action charts and identify key support and resistance levels.
          - **You must provide the specific current values for key technical indicators** (e.g., MACD, RSI, KDJ).
          - Based on these indicator values, provide an in-depth analysis of the likelihood of a short-term price increase or decrease.
          - Please use HTML \`<strong>\` tags to highlight indicator names and values, e.g., \`<strong>RSI (14):</strong> 65.2\`.
          - icon: 'chart-bar'

      4.  **Market & Policy Sentiment**: 
          - Analyze the potential impact of current overall market sentiment, macroeconomic factors (like interest rates, inflation), relevant industry policies, or breaking news on the stock price of ${ticker}.
          - **To enhance transparency and verifiability, please include 1-2 hyperlinks (HTML \`<a>\` tags) to key information sources within your analysis.** For instance, if mentioning the Federal Reserve's interest rate policy, link to the relevant announcement on the Fed's official website. If discussing industry news, link to reports from reputable financial news outlets like Reuters, Bloomberg, or The Wall Street Journal.
          - icon: 'newspaper'

      5.  **Future Trend Probability Prediction**:
          - Synthesizing all the above information, provide a clear probability forecast for the short-term upward vs. downward trend.
          - **You must use an HTML table to present the probabilities and add the specified CSS classes to the table elements to ensure readability on a dark background**. The table should have "Trend" and "Probability" columns.
          - Below the table, briefly explain the core logic for arriving at this probability.
          - icon: 'chart-pie'

      ${tradingStrategyPromptEN}

      Your output must be in strict JSON format. The title for each section must be in English, and the icon keyword must match those specified above.
      `;
    } else { // language === 'zh'
      const userPreferencesPrompt = `用户的风险偏好为'${riskTolerance}'，投资周期为'${investmentHorizon}'，市场波动偏好为'${volatilityPreference}'。`;
      
      let userPositionPrompt = `用户正在分析股票 ${ticker}，提供的最新实时价格为 $${currentPrice.toFixed(2)}，计划总投资额为 $${investmentAmount.toLocaleString()}。`;
      if (positionPrice !== null) {
        userPositionPrompt += ` 用户当前持仓成本为 $${positionPrice.toFixed(2)}。`;
      } else {
        userPositionPrompt += ' 用户当前未持仓。';
      }
      
      const firstSectionPrompt = `
        1.  **当前价格分析 (Current Price Analysis)**:
            - 结合技术图表，分析当前 $${currentPrice.toFixed(2)} 价格点位的重要性。
            - 它是否处于关键的支撑位或阻力位附近？这个价格对于短期趋势（上涨/下跌/盘整）有何指示意义？
            - icon: 'price-tag'`;

      const tradingStrategyPromptZH = `
        6.  **交易策略参考 (Trading Strategy Reference)**:
            - 基于以上所有分析、用户 $${investmentAmount.toLocaleString()} 的计划投资总额以及用户的个人偏好，提供具体的、可操作的交易策略参考。
            - **必须首先使用HTML表格来清晰地展示核心策略参数，并为表格元素添加指定的CSS类以确保在深色背景下可读**。表格应包含“策略项目”、“价格/区间”和“备注”三列。
            - 表格内容需要覆盖：建仓区间、补仓区间1、补仓区间2、加仓区间1、加仓区间2、止损点、以及两个分级止盈目标（止盈目标1，止盈目标2）。
            - **在表格下方，请用文字详细阐述策略的执行细节和理由。整体策略的设计应在保证较高可达成率的前提下，追求收益最大化。**
            - **除HTML内容外，您必须在'strategy' JSON对象中填入所有策略参数的精确字符串值。** 例如: \`"strategy": {"entryRange": "$170.00 - $175.00", "averagingDownRange1": "$165.00", "averagingDownRange2": "$160.00", "scalingInRange1": "$185.00", "scalingInRange2": "$190.00", "stopLoss": "$155.00", "profitTarget1": "$195.00", "profitTarget2": "$205.00"}\`。
            - **最后，必须包含以下免责声明**:
            - \`<p class='mt-4 text-xs text-gray-400'>免责声明：本分析由AI生成，基于模拟和公开数据，仅供参考和学习，不构成任何投资建议。股市有风险，投资需谨慎。</p>\`
            - icon: 'arrows-trending-up'
      `;

      prompt = `
        请扮演一个顶级的AI股票技术分析师和策略师，精通纳斯达克市场。

        **最高优先级指令：分析原则与数据准确性**
        - **绝对实时数据**: 用户的反馈强调，所有分析都必须基于绝对最新的、精确到分钟的纳斯达克 (NASDAQ) 实时市场数据。严禁使用任何形式的模拟、延迟或陈旧数据。您必须以用户提供的实时价格 $${currentPrice.toFixed(2)} 作为分析基准。
        - **数据源核实**: 在生成任何数字（尤其是技术指标）之前，请在内部交叉核实您的数据源，确保其为最新、最权威的纳斯达克数据。
        - **基于事实，杜绝假设**: 用户的反馈指出，分析必须基于可验证的历史股价数据和事实信息。严禁使用任何形式的假设性措辞，例如“假设股价已经大幅回调”或“如果市场情绪转好”。所有分析和策略建议都必须源于真实的数据和当前的市场状况，而不是凭空想象的场景。

        ${userPositionPrompt}
        ${userPreferencesPrompt}

        请基于以上最高优先级指令、用户提供的实时价格、全网的市场、政策信息、以及可查询到的历史股价数据，并结合用户的个人偏好，为用户生成一份详尽的、专业的、个性化的分析报告。
        如果股票不在纳斯达克交易，请明确指出并提供其主要交易所的信息。
        报告必须包含以下六个部分，并严格按照指定的JSON格式返回。内容需要专业、数据驱动、且易于阅读。**尤其关键的是，交易策略必须在保证高可达成率的基础上以收益最大化为目标进行优化，并包含清晰的补仓和加仓指引。** 除“交易策略参考”部分外，JSON输出中的“strategy”字段应为null。

        ${firstSectionPrompt}

        2.  **基本面分析 (Fundamental Analysis)**: 
            - 结合最新财报和新闻，简要分析公司的核心业务、行业地位和未来增长潜力。
            - icon: 'beaker'

        3.  **技术指标分析 (Technical Indicator Analysis)**: 
            - 分析近期的股价走势图，并确定关键的支撑位和阻力位。
            - **必须明确提供当前关键技术指标的具体数值**（例如 MACD, RSI, KDJ 等）。
            - 基于这些指标数值，深入分析短期内股价上涨或下跌的可能性。
            - 请使用HTML的 \`<strong>\` 标签突出指标名称和数值，例如 \`<strong>RSI (14):</strong> 65.2\`。
            - icon: 'chart-bar'

        4.  **市场与政策情绪 (Market & Policy Sentiment)**: 
            - 分析当前整体市场情绪、宏观经济因素（如利率、通胀）、相关行业政策或突发新闻对 ${ticker} 股价的潜在影响。
            - **为了提高分析的透明度和可验证性，请在分析内容中提供1-2个关键信息来源的超链接 (HTML \`<a>\` 标签)。** 例如，如果提到美联储的利率政策，可以链接到美联储官网的相关声明；如果提到行业新闻，可以链接到路透社、彭博社或华尔街日报等权威财经媒体的报道。
            - icon: 'newspaper'

        5.  **后市趋势概率预测 (Future Trend Probability Prediction)**:
            - 综合以上所有信息，给出一个明确的后市（短期内）上涨对下跌的概率预测。
            - **必须使用HTML表格格式呈现概率，并为表格元素添加指定的CSS类以确保在深色背景下可读**。表格应包含“趋势”和“概率”两列。
            - 在表格下方，请用文字简要说明得出此概率的核心逻辑。
            - icon: 'chart-pie'

        ${tradingStrategyPromptZH}

        你的输出必须是严格的JSON格式，每个部分的title必须是中文标题，icon关键字必须与上面指定的一致。
      `;
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        analysis: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              icon: { type: Type.STRING, description: "Icon keyword: price-tag, beaker, chart-bar, newspaper, chart-pie, arrows-trending-up" },
              content: { type: Type.STRING, description: "HTML-formatted content for the section." },
              strategy: {
                type: Type.OBJECT,
                nullable: true,
                properties: {
                  entryRange: { type: Type.STRING },
                  averagingDownRange1: { type: Type.STRING },
                  averagingDownRange2: { type: Type.STRING },
                  scalingInRange1: { type: Type.STRING },
                  scalingInRange2: { type: Type.STRING },
                  stopLoss: { type: Type.STRING },
                  profitTarget1: { type: Type.STRING },
                  profitTarget2: { type: Type.STRING },
                },
              }
            },
            required: ["title", "icon", "content"],
          },
        },
      },
      required: ["analysis"],
    };

    try {
      const result: GenerateContentResponse = await this.genAI.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.5,
        }
      });
      
      const jsonString = result.text;
      const parsedResult: AnalysisResponse = JSON.parse(jsonString);

      // Sanitize and format content
      parsedResult.analysis.forEach(section => {
        section.content = section.content
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      });

      return parsedResult;
    } catch (error) {
      console.error('Error generating content from Gemini API:', error);
      throw new Error('Failed to get analysis from AI. Please try again later.');
    }
  }

  async getBacktestAnalysis(
    ticker: string,
    strategy: TradingStrategy,
    language: 'zh' | 'en'
  ): Promise<BacktestResult> {
    const model = 'gemini-2.5-flash';
    let prompt: string;
    let summaryProperties: {[key: string]: {type: Type.STRING}} = {};
    let requiredSummaryKeys: string[] = [];

    if (language === 'en') {
        const keys = ['Simulation Period', 'Total Trades', 'Winning Trades', 'Losing Trades', 'Win Rate (%)', 'Net P/L (%)'];
        requiredSummaryKeys = keys;
        keys.forEach(key => summaryProperties[key] = { type: Type.STRING });

        prompt = `
        You are a quantitative analyst. Using historical data for the stock ${ticker} over the past year, please simulate the following trading strategy: 
        - Entry Range: ${strategy.entryRange}
        ${strategy.averagingDownRange1 ? `- Averaging Down Range 1: ${strategy.averagingDownRange1}` : ''}
        ${strategy.averagingDownRange2 ? `- Averaging Down Range 2: ${strategy.averagingDownRange2}` : ''}
        ${strategy.scalingInRange1 ? `- Scaling In Range 1: ${strategy.scalingInRange1}` : ''}
        ${strategy.scalingInRange2 ? `- Scaling In Range 2: ${strategy.scalingInRange2}` : ''}
        - Stop-Loss: ${strategy.stopLoss}
        - Profit Target 1: ${strategy.profitTarget1}
        - Profit Target 2: ${strategy.profitTarget2}

        When simulating, for simplicity, assume a single entry within the 'Entry Range'. Assume that 50% of the position is sold at Profit Target 1, and the remaining 50% is sold at Profit Target 2. If provided, the two 'Averaging Down' and two 'Scaling In' ranges should be considered in your narrative analysis of how the strategy might have performed under different conditions, but they will not be part of the quantitative trade simulation itself.

        Your output must be a strict JSON object with four fields: 'summary', 'narrative', 'verdict', and 'chartData'.
        1.  **summary**: An object where keys are the metric names and values are the string results. It must include: '${keys.join("', '")}'.
        2.  **narrative**: A string in markdown format analyzing the strategy's performance during key market phases (e.g., bull runs, corrections).
        3.  **verdict**: A string in markdown format with the final verdict on the strategy's historical viability.
        4.  **chartData**: An array of objects, each with a 'date' (YYYY-MM-DD format) and a 'value' (number). This should represent the daily value of a hypothetical $10,000 portfolio following the strategy. Provide at least 30 data points, including the start and end of the one-year period.
      `;
    } else { // language === 'zh'
        const keys = ['模拟周期', '总交易次数', '盈利交易', '亏损交易', '胜率 (%)', '净盈亏 (%)'];
        requiredSummaryKeys = keys;
        keys.forEach(key => summaryProperties[key] = { type: Type.STRING });

        prompt = `
        您是一位量化分析师。请使用 ${ticker} 股票过去一年的历史数据，对以下交易策略进行模拟回测：
        - 建仓区间: ${strategy.entryRange}
        ${strategy.averagingDownRange1 ? `- 补仓区间 1: ${strategy.averagingDownRange1}` : ''}
        ${strategy.averagingDownRange2 ? `- 补仓区间 2: ${strategy.averagingDownRange2}` : ''}
        ${strategy.scalingInRange1 ? `- 加仓区间 1: ${strategy.scalingInRange1}` : ''}
        ${strategy.scalingInRange2 ? `- 加仓区间 2: ${strategy.scalingInRange2}` : ''}
        - 止损点: ${strategy.stopLoss}
        - 止盈目标 1: ${strategy.profitTarget1}
        - 止盈目标 2: ${strategy.profitTarget2}

        在模拟时，为简化起见，请假设在“建仓区间”内单次建仓。假设在“止盈目标 1”卖出50%的仓位，在“止盈目标 2”卖出剩余的50%仓位。如果提供了两级“补仓区间”和两级“加仓区间”，请在您的叙述性分析中考虑它们在不同市场条件下可能如何影响策略表现，但它们本身不纳入量化交易模拟。
        
        您的输出必须是严格的JSON对象，包含四个字段：'summary', 'narrative', 'verdict', 和 'chartData'。
        1.  **summary**: 一个对象，键是指标名称，值是结果字符串。必须包含：'${keys.join("', '")}'。
        2.  **narrative**: 一个Markdown格式的字符串，分析该策略在关键市场阶段（如牛市、回调）的表现。
        3.  **verdict**: 一个Markdown格式的字符串，提供对该策略历史可行性的最终评价。
        4.  **chartData**: 一个对象数组，每个对象包含一个 'date' (YYYY-MM-DD 格式) 和一个 'value' (数字)。这应该代表一个假设的 $10,000 投资组合在遵循该策略下的每日价值。请提供至少30个数据点，并包含一年周期的开始和结束。
      `;
    }

    const schema = {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.OBJECT,
          properties: summaryProperties,
          required: requiredSummaryKeys,
        },
        narrative: { type: Type.STRING },
        verdict: { type: Type.STRING },
        chartData: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              value: { type: Type.NUMBER },
            },
            required: ['date', 'value'],
          },
        },
      },
      required: ['summary', 'narrative', 'verdict', 'chartData'],
    };

    try {
      const result: GenerateContentResponse = await this.genAI.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.3,
        }
      });
      
      const jsonString = result.text;
      const parsedResult: BacktestResult = JSON.parse(jsonString);

      // Sanitize and format markdown content to HTML
      const formatContent = (content: string) => content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      parsedResult.narrative = formatContent(parsedResult.narrative);
      parsedResult.verdict = formatContent(parsedResult.verdict);
      
      // Also format the summary values which might contain markdown
      for (const key in parsedResult.summary) {
        if (Object.prototype.hasOwnProperty.call(parsedResult.summary, key)) {
          parsedResult.summary[key] = formatContent(parsedResult.summary[key]);
        }
      }

      return parsedResult;
    } catch (error) {
      console.error('Error generating backtest from Gemini API:', error);
      throw new Error('Failed to get backtest analysis from AI.');
    }
  }
}