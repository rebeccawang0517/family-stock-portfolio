'use client'

import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([GaugeChart, CanvasRenderer])

interface GaugeProps {
  value: number
  title: string
  max?: number
}

export default function EChartsGauge({ value, title, max = 100 }: GaugeProps) {
  const option = {
    series: [
      {
        type: 'gauge',
        max,
        progress: { show: true, width: 14 },
        axisLine: { lineStyle: { width: 14, color: [[1, 'rgba(255,255,255,0.1)']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        title: { show: true, offsetCenter: [0, '70%'], fontSize: 12, color: '#9a9890' },
        detail: {
          valueAnimation: true,
          fontSize: 24,
          fontWeight: 'bold',
          color: '#f0ede6',
          offsetCenter: [0, '0%'],
          formatter: `{value}%`,
        },
        data: [{ value, name: title }],
      },
    ],
  }

  return <ReactEChartsCore echarts={echarts} option={option} style={{ height: 200 }} />
}
