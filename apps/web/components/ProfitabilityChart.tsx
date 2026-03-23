'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const MOCK_DATA_2025 = [
  { month: 'Ene', dropoffs: 120, pickups: 110, profitability: 38.5 },
  { month: 'Feb', dropoffs: 150, pickups: 145, profitability: 50.75 },
  { month: 'Mar', dropoffs: 180, pickups: 160, profitability: 56.0 },
  { month: 'Abr', dropoffs: 160, pickups: 165, profitability: 57.75 },
  { month: 'May', dropoffs: 210, pickups: 200, profitability: 70.0 },
  { month: 'Jun', dropoffs: 240, pickups: 235, profitability: 82.25 },
  { month: 'Jul', dropoffs: 190, pickups: 180, profitability: 63.0 },
  { month: 'Ago', dropoffs: 130, pickups: 125, profitability: 43.75 },
  { month: 'Sep', dropoffs: 260, pickups: 250, profitability: 87.5 },
  { month: 'Oct', dropoffs: 290, pickups: 285, profitability: 99.75 },
  { month: 'Nov', dropoffs: 350, pickups: 340, profitability: 119.0 },
  { month: 'Dic', dropoffs: 410, pickups: 390, profitability: 136.5 },
]

const MOCK_DATA_2026 = [
  { month: 'Ene', dropoffs: 140, pickups: 135, profitability: 47.25 },
  { month: 'Feb', dropoffs: 170, pickups: 160, profitability: 56.0 },
  { month: 'Mar', dropoffs: 210, pickups: 195, profitability: 68.25 }, // Hasta marzo de 2026
]

export function ProfitabilityChart() {
  const [selectedYear, setSelectedYear] = useState<'2025' | '2026'>('2026')

  const currentData = selectedYear === '2025' ? MOCK_DATA_2025 : MOCK_DATA_2026

  return (
    <Card className="col-span-4 flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle>Rentabilidad Mensual</CardTitle>
          <CardDescription>
            Entregas (Drop-offs) vs Recogidas (Pick-ups)
          </CardDescription>
        </div>
        <div>
          <select 
            className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value as '2025' | '2026')}
          >
            <option value="2026">Año 2026</option>
            <option value="2025">Año 2025</option>
          </select>
        </div>
      </CardHeader>
      <CardContent className="pl-2 flex-1">
        <div className="h-[350px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={currentData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis 
                dataKey="month" 
                stroke="#6b7280" 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#6b7280" 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(243, 244, 246, 0.4)' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="dropoffs" name="Entregas (Recepción)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pickups" name="Recogidas (Cliente)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
