import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface GrowthPoint {
  date: string | number;
  totalMembers: string | number;
}

interface GrowthChartProps {
  data: GrowthPoint[];
}

const format = new Intl.NumberFormat('vi-VN');

export default function GrowthChart({ data }: GrowthChartProps) {
  return <ResponsiveContainer>
    <AreaChart data={data}>
      <defs><linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3984f4" stopOpacity={.28}/><stop offset="95%" stopColor="#3984f4" stopOpacity={0}/></linearGradient></defs>
      <CartesianGrid strokeDasharray="3 3" vertical={false}/>
      <XAxis dataKey="date" axisLine={false} tickLine={false}/>
      <YAxis axisLine={false} tickLine={false} domain={[21000, 26000]} tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}/>
      <Tooltip formatter={(value) => [format.format(Number(value)), 'Thành viên']}/>
      <Area type="monotone" dataKey="totalMembers" stroke="#2675e8" strokeWidth={3} fill="url(#colorGrowth)"/>
    </AreaChart>
  </ResponsiveContainer>;
}
