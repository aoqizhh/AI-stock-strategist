import { Component, ChangeDetectionStrategy, input, ElementRef, OnChanges, SimpleChanges } from '@angular/core';
import { BacktestChartDataPoint } from '../../models/analysis.model';

// D3 is loaded from a script tag in index.html, so we declare it here to satisfy TypeScript.
declare var d3: any;

@Component({
  selector: 'app-backtest-chart',
  standalone: true,
  template: `<div class="w-full h-64 bg-gray-900/50 rounded-lg p-2"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BacktestChartComponent implements OnChanges {
  data = input.required<BacktestChartDataPoint[]>();
  
  private host: HTMLElement;
  private svg: any;
  private width: number = 0;
  private height: number = 0;
  private margin = { top: 20, right: 30, bottom: 40, left: 50 };

  constructor(private el: ElementRef) {
    this.host = this.el.nativeElement;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && this.data().length > 0) {
      this.createChart();
    }
  }

  private createChart(): void {
    d3.select(this.host).select('svg').remove();

    const chartContainer = this.host.querySelector('div');
    if (!chartContainer) return;

    this.width = chartContainer.clientWidth - this.margin.left - this.margin.right;
    this.height = chartContainer.clientHeight - this.margin.top - this.margin.bottom;
    
    this.svg = d3.select(chartContainer)
      .append('svg')
      .attr('width', this.width + this.margin.left + this.margin.right)
      .attr('height', this.height + this.margin.top + this.margin.bottom)
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);
      
    const data = this.data().map(d => ({ date: d3.timeParse("%Y-%m-%d")(d.date), value: d.value }));

    // X axis
    const x = d3.scaleTime()
      .domain(d3.extent(data, (d: any) => d.date))
      .range([0, this.width]);
    this.svg.append('g')
      .attr('transform', `translate(0, ${this.height})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(0).tickPadding(10))
      .attr('class', 'axis-style');

    // Y axis
    const yDomain = d3.extent(data, (d: any) => d.value) as [number, number];
    const yPadding = (yDomain[1] - yDomain[0]) * 0.1;
    const y = d3.scaleLinear()
      .domain([yDomain[0] - yPadding, yDomain[1] + yPadding])
      .range([this.height, 0]);
    this.svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(0).tickPadding(10).tickFormat((d: any) => `$${(d/1000).toFixed(1)}k`))
      .attr('class', 'axis-style');

    // Common style for axes
    this.svg.selectAll('.axis-style text').style('fill', '#9ca3af').style('font-size', '10px');
    this.svg.selectAll('.axis-style path').style('stroke', 'none');

    // Add a grid
    this.svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${this.height})`)
      .call(d3.axisBottom(x).tickSize(-this.height).tickFormat(() => ''))
      .selectAll('line').style('stroke', '#404040').style('stroke-opacity', '0.5');

    this.svg.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(y).tickSize(-this.width).tickFormat(() => ''))
      .selectAll('line').style('stroke', '#404040').style('stroke-opacity', '0.5');

    // Line
    this.svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#2dd4bf')
      .attr('stroke-width', 2.5)
      .attr('d', d3.line()
        .x((d: any) => x(d.date))
        .y((d: any) => y(d.value))
      );
  }
}