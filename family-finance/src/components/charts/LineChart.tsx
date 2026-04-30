'use client'

import {
  LineChart as RechartsLine,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface LineChartProps {
  data: Array<Record<string, string | number>>
  xKey: string
  lines: Array<{ key: string; color: string; name: string }>
  title?: string
}

export default function LineChart({ data, xKey, lines, title }: LineChartProps) {
  return (
    <div>
      {title && (
        <h3 className="text-sm font-semibold mb-2" style={{ color: '#f0ede6' }}>
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <RechartsLine data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey={xKey} stroke="#9a9890" fontSize={12} />
          <YAxis stroke="#9a9890" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#2c2b27',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px',
              color: '#f0ede6',
            }}
          />
          <Legend wrapperStyle={{ color: '#ccc9bf' }} />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              name={line.name}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </RechartsLine>
      </ResponsiveContainer>
    </div>
  )
}
