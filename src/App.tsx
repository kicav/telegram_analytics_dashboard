import { Activity, BarChart3, Bell, ChevronDown, FileText, LayoutDashboard, Megaphone, Menu, MessageSquare, Radio, RefreshCw, Search, Settings, TrendingDown, TrendingUp, Users, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { campaigns, growth, overview, posts } from './demo';

const GrowthChart = lazy(() => import('./GrowthChart'));

type LoadState = 'loading' | 'ready' | 'error';
const format = new Intl.NumberFormat('vi-VN');

const metrics = [
  { label: 'Tổng thành viên', key: 'totalMembers', icon: Users, tone: 'blue', hint: '+8,4% so với tháng trước' },
  { label: 'Thành viên mới', key: 'newMembers', icon: TrendingUp, tone: 'green', hint: 'Trong 30 ngày qua' },
  { label: 'Thành viên rời', key: 'leftMembers', icon: TrendingDown, tone: 'red', hint: 'Trong 30 ngày qua' },
  { label: 'Tăng trưởng ròng', key: 'netGrowth', icon: BarChart3, tone: 'purple', hint: '+6,2% so với tháng trước' },
  { label: 'Hoạt động 7 ngày', key: 'active7d', icon: Activity, tone: 'cyan', hint: '36,1% tổng thành viên' },
  { label: 'Hoạt động 30 ngày', key: 'active30d', icon: Radio, tone: 'orange', hint: '71,0% tổng thành viên' },
  { label: 'Tổng bài viết', key: 'totalPosts', icon: FileText, tone: 'indigo', hint: '112 bài trong tháng này' },
  { label: 'Tổng reaction', key: 'totalReactions', icon: MessageSquare, tone: 'pink', hint: '+12,7% so với tháng trước' },
] as const;

export function App() {
  const [state, setState] = useState<LoadState>('loading');
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setState('ready'), 500); return () => window.clearTimeout(timer); }, []);
  if (state === 'loading') return <div className="center-state"><div className="spinner"/><strong>Đang tải dữ liệu phân tích…</strong><span>Vui lòng chờ trong giây lát</span></div>;
  if (state === 'error') return <div className="center-state"><div className="error-icon">!</div><strong>Không thể tải dữ liệu</strong><span>Đã xảy ra lỗi khi kết nối. Vui lòng thử lại.</span><button onClick={() => setState('ready')}><RefreshCw size={16}/> Thử lại</button></div>;
  return <div className="shell">
    <aside className={navOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><div className="logo">T</div><div><strong>Telegram</strong><span>Analytics</span></div><button className="close" onClick={() => setNavOpen(false)}><X/></button></div>
      <nav><small>TỔNG QUAN</small><a className="active"><LayoutDashboard/> Dashboard</a><small>PHÂN TÍCH</small><a><Users/> Thành viên</a><a><FileText/> Bài viết</a><a><BarChart3/> Tăng trưởng</a><a><Megaphone/> Chiến dịch</a><small>HỆ THỐNG</small><a><Settings/> Cài đặt</a></nav>
      <div className="account"><div className="avatar">NA</div><div><strong>Nguyễn An</strong><span>Quản trị viên</span></div><ChevronDown size={16}/></div>
    </aside>
    {navOpen && <button className="overlay" aria-label="Đóng menu" onClick={() => setNavOpen(false)}/>}
    <main>
      <header><button className="menu" onClick={() => setNavOpen(true)}><Menu/></button><div className="search"><Search/><input aria-label="Tìm kiếm" placeholder="Tìm kiếm nhóm, chiến dịch…"/></div><button className="icon-button"><Bell/><i/></button><div className="header-avatar">NA</div></header>
      <section className="content">
        <div className="heading"><div><h1>Tổng quan</h1><p>Theo dõi hiệu suất các nhóm và kênh Telegram của bạn.</p></div><label>Khoảng thời gian <select><option>30 ngày qua</option><option>7 ngày qua</option></select></label></div>
        <div className="notice"><span>i</span><p><strong>Dữ liệu minh họa</strong> Dashboard đang hiển thị dữ liệu demo. Kết nối Telegram webhook và D1 để bắt đầu thu thập dữ liệu thực.</p></div>
        <div className="metrics">{metrics.map(({ label, key, icon: Icon, tone, hint }) => <article className="metric" key={key}><div className={`metric-icon ${tone}`}><Icon/></div><div><span>{label}</span><strong>{format.format(overview[key])}</strong><small>{hint}</small></div></article>)}</div>
        <div className="panel growth"><div className="panel-head"><div><h2>Tăng trưởng thành viên</h2><p>Tổng thành viên trong 10 ngày gần nhất</p></div><span className="legend"><i/> Tổng thành viên</span></div><div className="chart"><Suspense fallback={<div className="chart-loading">Đang tải biểu đồ…</div>}><GrowthChart data={growth}/></Suspense></div></div>
        <div className="bottom-grid"><div className="panel"><div className="panel-head"><div><h2>Bài viết nổi bật</h2><p>Xếp hạng theo lượt xem</p></div><button className="link">Xem tất cả</button></div><div className="list">{posts.length ? posts.map((post, i) => <div className="post" key={post.id}><b>{i + 1}</b><div><strong>{post.excerpt}</strong><span>{post.chatTitle} · {post.publishedAt}</span></div><div className="post-stats"><span>{format.format(post.views)} lượt xem</span><small>{format.format(post.reactions)} reaction</small></div></div>) : <Empty/>}</div></div>
          <div className="panel"><div className="panel-head"><div><h2>Chiến dịch gần đây</h2><p>Hiệu quả thu hút thành viên</p></div><button className="link">Xem tất cả</button></div><div className="list">{campaigns.length ? campaigns.map(c => <div className="campaign" key={c.id}><div className="campaign-icon"><Megaphone/></div><div><strong>{c.name}</strong><span>{c.inviteLinks} invite link</span></div><div><em className={c.status}>{c.status === 'active' ? 'Đang chạy' : 'Hoàn tất'}</em><small>{format.format(c.conversions)} chuyển đổi</small></div></div>) : <Empty/>}</div></div></div>
        <footer>Dữ liệu cập nhật lần cuối: Hôm nay, 10:24 · Múi giờ Asia/Ho_Chi_Minh <button onClick={() => setState('error')}>Kiểm tra trạng thái lỗi</button></footer>
      </section>
    </main>
  </div>;
}

function Empty() { return <div className="empty"><FileText/><strong>Chưa có dữ liệu</strong><span>Dữ liệu sẽ xuất hiện sau khi hệ thống ghi nhận hoạt động.</span></div>; }
