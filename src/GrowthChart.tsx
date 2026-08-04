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
  const values = data.map((point) => Number(point.totalMembers)).filter(Number.isFinite);
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 100;
  const padding = Math.max(10, Math.ceil((maximum - minimum) * 0.15));
  const domain: [number, number] = [Math.max(0, minimum - padding), maximum + padding];

  return <ResponsiveContainer>
    <AreaChart data={data}>
      <defs><linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3984f4" stopOpacity={0.28}/><stop offset="95%" stopColor="#3984f4" stopOpacity={0}/></linearGradient></defs>
      <CartesianGrid strokeDasharray="3 3" vertical={false}/>
      <XAxis dataKey="date" axisLine={false} tickLine={false}/>
      <YAxis axisLine={false} tickLine={false} domain={domain} width={62} tickFormatter={(value: number) => format.format(value)}/>
      <Tooltip formatter={(value) => [format.format(Number(value)), 'Thành viên']}/>
      <Area type="monotone" dataKey="totalMembers" stroke="#2675e8" strokeWidth={3} fill="url(#colorGrowth)"/>
    </AreaChart>
  </ResponsiveContainer>;
}
