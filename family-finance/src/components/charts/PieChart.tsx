'use client'

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Pie } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

interface PieChartProps {
  labels: string[]
  data: number[]
  title?: string
}

export default function PieChart({ labels, data, title }: PieChartProps) {
  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: [
          '#c8b89a', '#9a9890', '#6b6a64', '#4a3f2f',
          '#1e4a2a', '#3d2f4a', '#4a2f1a', '#2c2b27',
          '#d4c5a8', '#3d3c38',
        ],
        borderColor: '#1a1916',
        borderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#ccc9bf', font: { size: 12 } },
      },
      ...(title && {
        title: { display: true, text: title, color: '#f0ede6', font: { size: 16 } },
      }),
    },
  }

  return <Pie data={chartData} options={options} />
}
