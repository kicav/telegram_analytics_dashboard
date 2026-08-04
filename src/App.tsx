import {
  Activity,
  BarChart3,
  Bell,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Megaphone,
  Menu,
  MessageSquare,
  Radio,
  RefreshCw,
  Search,
  Settings,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';

const GrowthChart = lazy(() => import('./GrowthChart'));

type Page = 'overview' | 'members' | 'posts' | 'growth' | 'campaigns' | 'settings';
type LoadState = 'idle' | 'loading' | 'ready' | 'error';

interface OverviewData {
  totalMembers: number;
  newMembers: number;
  leftMembers: number;
  netGrowth: number;
  active7d: number;
  active30d: number;
  totalPosts: number;
  totalReactions: number;
}

interface GrowthPoint {
  date: string;
  totalMembers: number;
  joined: number;
  left: number;
}

interface PostRow {
  id: number;
  excerpt: string | null;
  publishedAt: string;
  chatTitle: string;
  views: number;
  reactions: number;
  forwards: number;
}

interface CampaignRow {
  id: number;
  name: string;
  status: string;
  startsAt: string | null;
  inviteLinks: number;
  conversions: number;
}

interface MemberRow {
  id: number;
  displayName: string;
  username: string | null;
  status: string;
  joinedAt: string | null;
  leftAt: string | null;
  lastActiveAt: string | null;
  chatTitle: string;
}

interface ListResponse<T> {
  data: T[];
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const emptyOverview: OverviewData = {
  totalMembers: 0,
  newMembers: 0,
  leftMembers: 0,
  netGrowth: 0,
  active7d: 0,
  active30d: 0,
  totalPosts: 0,
  totalReactions: 0,
};

const format = new Intl.NumberFormat('vi-VN');
const dateTimeFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
const API_KEY_STORAGE = 'telegram-analytics-admin-key';

const pageMeta: Record<Page, { title: string; description: string; search: string }> = {
  overview: { title: 'Tổng quan', description: 'Theo dõi hiệu suất các nhóm và kênh Telegram của bạn.', search: 'Tìm kiếm…' },
  members: { title: 'Thành viên', description: 'Danh sách thành viên đã được webhook ghi nhận.', search: 'Tìm theo tên, username hoặc nhóm…' },
  posts: { title: 'Bài viết', description: 'Bài đăng gần đây từ các kênh đã kết nối.', search: 'Tìm nội dung hoặc tên kênh…' },
  growth: { title: 'Tăng trưởng', description: 'Biến động thành viên theo dữ liệu tổng hợp hằng ngày.', search: 'Tìm kiếm…' },
  campaigns: { title: 'Chiến dịch', description: 'Theo dõi invite link và số thành viên chuyển đổi.', search: 'Tìm tên chiến dịch…' },
  settings: { title: 'Cài đặt', description: 'Thiết lập quyền truy cập dashboard trên trình duyệt này.', search: 'Tìm kiếm…' },
};

const navItems = [
  { page: 'overview' as const, label: 'Dashboard', icon: LayoutDashboard },
  { page: 'members' as const, label: 'Thành viên', icon: Users },
  { page: 'posts' as const, label: 'Bài viết', icon: FileText },
  { page: 'growth' as const, label: 'Tăng trưởng', icon: BarChart3 },
  { page: 'campaigns' as const, label: 'Chiến dịch', icon: Megaphone },
  { page: 'settings' as const, label: 'Cài đặt', icon: Settings },
];

async function apiRequest<T>(path: string, apiKey: string): Promise<T> {
  const response = await fetch(path, {
    headers: { 'X-Admin-Api-Key': apiKey },
  });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : `Yêu cầu thất bại (${response.status})`;
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

function resolvePage(): Page {
  const value = window.location.hash.replace(/^#\/?/, '');
  return navItems.some((item) => item.page === value) ? value as Page : 'overview';
}

export function App() {
  const [page, setPage] = useState<Page>(resolvePage);
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<7 | 30>(30);
  const [apiKey, setApiKey] = useState(() => window.sessionStorage.getItem(API_KEY_STORAGE) ?? '');
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [overview, setOverview] = useState<OverviewData>(emptyOverview);
  const [growth, setGrowth] = useState<GrowthPoint[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', '#/overview');
    const handleHashChange = () => setPage(resolvePage());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    setQuery('');
    if (page === 'settings' || !apiKey) {
      setLoadState('ready');
      return;
    }
    let cancelled = false;
    setLoadState('loading');
    setErrorMessage('');

    const load = async () => {
      try {
        if (page === 'overview') {
          const [overviewResult, growthResult, postResult, campaignResult] = await Promise.all([
            apiRequest<OverviewData>('/api/dashboard/overview', apiKey),
            apiRequest<ListResponse<GrowthPoint>>('/api/dashboard/member-growth', apiKey),
            apiRequest<ListResponse<PostRow>>('/api/posts?limit=5', apiKey),
            apiRequest<ListResponse<CampaignRow>>('/api/campaigns?limit=5', apiKey),
          ]);
          if (!cancelled) {
            setOverview(overviewResult);
            setGrowth(growthResult.data);
            setPosts(postResult.data);
            setCampaigns(campaignResult.data);
          }
        } else if (page === 'members') {
          const result = await apiRequest<ListResponse<MemberRow>>('/api/members?limit=200', apiKey);
          if (!cancelled) setMembers(result.data);
        } else if (page === 'posts') {
          const result = await apiRequest<ListResponse<PostRow>>('/api/posts?limit=100', apiKey);
          if (!cancelled) setPosts(result.data);
        } else if (page === 'growth') {
          const result = await apiRequest<ListResponse<GrowthPoint>>('/api/dashboard/member-growth', apiKey);
          if (!cancelled) setGrowth(result.data);
        } else if (page === 'campaigns') {
          const result = await apiRequest<ListResponse<CampaignRow>>('/api/campaigns?limit=100', apiKey);
          if (!cancelled) setCampaigns(result.data);
        }
        if (!cancelled) {
          setLastUpdated(new Date());
          setLoadState('ready');
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof ApiError && error.status === 401
          ? 'Khóa quản trị không đúng hoặc chưa được cấu hình cho Worker.'
          : error instanceof Error ? error.message : 'Không thể tải dữ liệu.';
        setErrorMessage(message);
        setLoadState('error');
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [apiKey, page, reloadToken]);

  const navigate = (nextPage: Page) => {
    window.location.hash = `/${nextPage}`;
    setPage(nextPage);
    setNavOpen(false);
  };

  const saveApiKey = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    window.sessionStorage.setItem(API_KEY_STORAGE, clean);
    setApiKey(clean);
    setReloadToken((current) => current + 1);
    navigate('overview');
  };

  const clearApiKey = () => {
    window.sessionStorage.removeItem(API_KEY_STORAGE);
    setApiKey('');
    setOverview(emptyOverview);
    setGrowth([]);
    setPosts([]);
    setCampaigns([]);
    setMembers([]);
    navigate('settings');
  };

  const retry = () => setReloadToken((current) => current + 1);
  const meta = pageMeta[page];
  const showSearch = page === 'members' || page === 'posts' || page === 'campaigns';

  return <div className="shell">
    <aside className={navOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand">
        <div className="logo">T</div>
        <div><strong>Telegram</strong><span>Analytics</span></div>
        <button className="close" onClick={() => setNavOpen(false)} aria-label="Đóng menu"><X /></button>
      </div>
      <nav>
        <small>TỔNG QUAN</small>
        {navItems.slice(0, 1).map((item) => <NavButton key={item.page} item={item} active={page === item.page} onClick={() => navigate(item.page)} />)}
        <small>PHÂN TÍCH</small>
        {navItems.slice(1, 5).map((item) => <NavButton key={item.page} item={item} active={page === item.page} onClick={() => navigate(item.page)} />)}
        <small>HỆ THỐNG</small>
        {navItems.slice(5).map((item) => <NavButton key={item.page} item={item} active={page === item.page} onClick={() => navigate(item.page)} />)}
      </nav>
      <button className="account" onClick={() => navigate('settings')}>
        <div className="avatar">QT</div>
        <div><strong>Quản trị viên</strong><span>{apiKey ? 'Đã mở khóa' : 'Chưa nhập khóa'}</span></div>
        <ChevronDown size={16} />
      </button>
    </aside>
    {navOpen && <button className="overlay" aria-label="Đóng menu" onClick={() => setNavOpen(false)} />}

    <main>
      <header>
        <button className="menu" onClick={() => setNavOpen(true)} aria-label="Mở menu"><Menu /></button>
        <div className={showSearch ? 'search' : 'search search-disabled'}>
          <Search />
          <input
            aria-label="Tìm kiếm"
            placeholder={meta.search}
            value={query}
            disabled={!showSearch}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <button className="icon-button" title="Làm mới dữ liệu" onClick={retry}><RefreshCw /></button>
        <button className="icon-button" title="Thông báo"><Bell /><i /></button>
        <button className="header-avatar" onClick={() => navigate('settings')}>QT</button>
      </header>

      <section className="content">
        <div className="heading">
          <div><h1>{meta.title}</h1><p>{meta.description}</p></div>
          {(page === 'overview' || page === 'growth') && <label>Khoảng thời gian
            <select value={period} onChange={(event) => setPeriod(Number(event.target.value) as 7 | 30)}>
              <option value={30}>30 ngày qua</option>
              <option value={7}>7 ngày qua</option>
            </select>
          </label>}
        </div>

        {!apiKey && page !== 'settings'
          ? <AccessRequired onOpenSettings={() => navigate('settings')} />
          : page === 'settings'
            ? <SettingsPage apiKey={apiKey} onSave={saveApiKey} onClear={clearApiKey} />
            : loadState === 'loading'
              ? <LoadingState />
              : loadState === 'error'
                ? <ErrorState message={errorMessage} onRetry={retry} onSettings={() => navigate('settings')} />
                : <PageContent
                    page={page}
                    overview={overview}
                    growth={growth.slice(-period)}
                    posts={posts}
                    campaigns={campaigns}
                    members={members}
                    query={query}
                    navigate={navigate}
                  />}

        {lastUpdated && page !== 'settings' && apiKey && <footer>
          Dữ liệu cập nhật lần cuối: {dateTimeFormat.format(lastUpdated)} · Múi giờ Asia/Ho_Chi_Minh
        </footer>}
      </section>
    </main>
  </div>;
}

function NavButton({ item, active, onClick }: { item: typeof navItems[number]; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return <button className={active ? 'nav-link active' : 'nav-link'} onClick={onClick}><Icon /> {item.label}</button>;
}

function PageContent(props: {
  page: Page;
  overview: OverviewData;
  growth: GrowthPoint[];
  posts: PostRow[];
  campaigns: CampaignRow[];
  members: MemberRow[];
  query: string;
  navigate: (page: Page) => void;
}) {
  if (props.page === 'overview') return <OverviewPage {...props} />;
  if (props.page === 'members') return <MembersPage members={props.members} query={props.query} />;
  if (props.page === 'posts') return <PostsPage posts={props.posts} query={props.query} />;
  if (props.page === 'growth') return <GrowthPage growth={props.growth} />;
  if (props.page === 'campaigns') return <CampaignsPage campaigns={props.campaigns} query={props.query} />;
  return null;
}

function OverviewPage({ overview, growth, posts, campaigns, navigate }: {
  overview: OverviewData;
  growth: GrowthPoint[];
  posts: PostRow[];
  campaigns: CampaignRow[];
  navigate: (page: Page) => void;
}) {
  const metrics: Array<{ label: string; key: keyof OverviewData; icon: typeof Users; tone: string; hint: string }> = [
    { label: 'Tổng thành viên', key: 'totalMembers', icon: Users, tone: 'blue', hint: 'Tổng trên các nhóm và kênh' },
    { label: 'Thành viên mới', key: 'newMembers', icon: TrendingUp, tone: 'green', hint: 'Trong 30 ngày gần nhất' },
    { label: 'Thành viên rời', key: 'leftMembers', icon: TrendingDown, tone: 'red', hint: 'Trong 30 ngày gần nhất' },
    { label: 'Tăng trưởng ròng', key: 'netGrowth', icon: BarChart3, tone: 'purple', hint: 'Thành viên mới trừ thành viên rời' },
    { label: 'Hoạt động 7 ngày', key: 'active7d', icon: Activity, tone: 'cyan', hint: 'Theo bản tổng hợp mới nhất' },
    { label: 'Hoạt động 30 ngày', key: 'active30d', icon: Radio, tone: 'orange', hint: 'Theo bản tổng hợp mới nhất' },
    { label: 'Tổng bài viết', key: 'totalPosts', icon: FileText, tone: 'indigo', hint: 'Trong 30 ngày gần nhất' },
    { label: 'Tổng reaction', key: 'totalReactions', icon: MessageSquare, tone: 'pink', hint: 'Trong 30 ngày gần nhất' },
  ];
  const hasData = Object.values(overview).some((value) => value > 0) || growth.length > 0 || posts.length > 0;

  return <>
    <div className={hasData ? 'notice success' : 'notice'}>
      <span>i</span><p><strong>{hasData ? 'Dữ liệu thật' : 'Chưa có dữ liệu'}</strong>
        {hasData ? ' Dashboard đang đọc dữ liệu trực tiếp từ Worker và D1.' : ' Hệ thống đã kết nối nhưng chưa ghi nhận hoạt động Telegram.'}
      </p>
    </div>
    <div className="metrics">
      {metrics.map(({ label, key, icon: Icon, tone, hint }) => <article className="metric" key={key}>
        <div className={`metric-icon ${tone}`}><Icon /></div>
        <div><span>{label}</span><strong>{format.format(overview[key])}</strong><small>{hint}</small></div>
      </article>)}
    </div>
    <Panel title="Tăng trưởng thành viên" subtitle="Tổng thành viên theo ngày" action={<button className="link" onClick={() => navigate('growth')}>Xem chi tiết</button>}>
      {growth.length ? <div className="chart"><Suspense fallback={<ChartLoading />}><GrowthChart data={growth} /></Suspense></div> : <Empty text="Chưa có dữ liệu tăng trưởng hằng ngày." />}
    </Panel>
    <div className="bottom-grid">
      <Panel title="Bài viết gần đây" subtitle="Xếp hạng theo lượt xem" action={<button className="link" onClick={() => navigate('posts')}>Xem tất cả</button>}>
        <PostList posts={posts.slice(0, 5)} />
      </Panel>
      <Panel title="Chiến dịch gần đây" subtitle="Hiệu quả thu hút thành viên" action={<button className="link" onClick={() => navigate('campaigns')}>Xem tất cả</button>}>
        <CampaignList campaigns={campaigns.slice(0, 5)} />
      </Panel>
    </div>
  </>;
}

function MembersPage({ members, query }: { members: MemberRow[]; query: string }) {
  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return members;
    return members.filter((member) => normalize(`${member.displayName} ${member.username ?? ''} ${member.chatTitle} ${member.status}`).includes(needle));
  }, [members, query]);

  return <Panel title={`${format.format(filtered.length)} thành viên`} subtitle="Tối đa 200 bản ghi mới nhất">
    {filtered.length ? <div className="table-wrap"><table>
      <thead><tr><th>Thành viên</th><th>Nhóm/kênh</th><th>Trạng thái</th><th>Ngày tham gia</th><th>Hoạt động gần nhất</th></tr></thead>
      <tbody>{filtered.map((member) => <tr key={member.id}>
        <td><strong>{member.displayName || 'Chưa đặt tên'}</strong><small>{member.username ? `@${member.username}` : 'Không có username'}</small></td>
        <td>{member.chatTitle}</td>
        <td><Status value={member.status} /></td>
        <td>{formatDate(member.joinedAt)}</td>
        <td>{formatDate(member.lastActiveAt)}</td>
      </tr>)}</tbody>
    </table></div> : <Empty text={query ? 'Không tìm thấy thành viên phù hợp.' : 'Chưa có thành viên được webhook ghi nhận.'} />}
  </Panel>;
}

function PostsPage({ posts, query }: { posts: PostRow[]; query: string }) {
  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return posts;
    return posts.filter((post) => normalize(`${post.excerpt ?? ''} ${post.chatTitle}`).includes(needle));
  }, [posts, query]);

  return <Panel title={`${format.format(filtered.length)} bài viết`} subtitle="Các bài đăng kênh đã được webhook ghi nhận">
    {filtered.length ? <div className="table-wrap"><table>
      <thead><tr><th>Nội dung</th><th>Kênh</th><th>Thời gian</th><th>Lượt xem</th><th>Reaction</th><th>Chuyển tiếp</th></tr></thead>
      <tbody>{filtered.map((post) => <tr key={post.id}>
        <td className="wide-cell"><strong>{post.excerpt || '[Bài đăng media]'}</strong></td>
        <td>{post.chatTitle}</td>
        <td>{formatDate(post.publishedAt)}</td>
        <td>{format.format(post.views)}</td>
        <td>{format.format(post.reactions)}</td>
        <td>{format.format(post.forwards)}</td>
      </tr>)}</tbody>
    </table></div> : <Empty text={query ? 'Không tìm thấy bài viết phù hợp.' : 'Chưa có bài viết được ghi nhận.'} />}
  </Panel>;
}

function GrowthPage({ growth }: { growth: GrowthPoint[] }) {
  const latest = growth.at(-1);
  const first = growth.at(0);
  const change = latest && first ? latest.totalMembers - first.totalMembers : 0;
  const joined = growth.reduce((sum, point) => sum + Number(point.joined || 0), 0);
  const left = growth.reduce((sum, point) => sum + Number(point.left || 0), 0);

  return <>
    <div className="summary-grid">
      <SummaryCard label="Thành viên cuối kỳ" value={latest?.totalMembers ?? 0} />
      <SummaryCard label="Thay đổi trong kỳ" value={change} signed />
      <SummaryCard label="Tham gia" value={joined} />
      <SummaryCard label="Rời nhóm" value={left} />
    </div>
    <Panel title="Biểu đồ tăng trưởng" subtitle="Dữ liệu từ bảng daily_chat_metrics">
      {growth.length ? <div className="chart chart-large"><Suspense fallback={<ChartLoading />}><GrowthChart data={growth} /></Suspense></div> : <Empty text="Chưa có dữ liệu tổng hợp theo ngày. Webhook đơn lẻ chưa tự tạo daily metrics." />}
    </Panel>
  </>;
}

function CampaignsPage({ campaigns, query }: { campaigns: CampaignRow[]; query: string }) {
  const filtered = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return campaigns;
    return campaigns.filter((campaign) => normalize(`${campaign.name} ${campaign.status}`).includes(needle));
  }, [campaigns, query]);

  return <Panel title={`${format.format(filtered.length)} chiến dịch`} subtitle="Số chuyển đổi dựa trên invite link được liên kết">
    {filtered.length ? <div className="table-wrap"><table>
      <thead><tr><th>Tên chiến dịch</th><th>Trạng thái</th><th>Bắt đầu</th><th>Invite link</th><th>Chuyển đổi</th></tr></thead>
      <tbody>{filtered.map((campaign) => <tr key={campaign.id}>
        <td><strong>{campaign.name}</strong></td>
        <td><Status value={campaign.status} /></td>
        <td>{formatDate(campaign.startsAt)}</td>
        <td>{format.format(campaign.inviteLinks)}</td>
        <td>{format.format(campaign.conversions)}</td>
      </tr>)}</tbody>
    </table></div> : <Empty text={query ? 'Không tìm thấy chiến dịch phù hợp.' : 'Chưa có chiến dịch trong D1.'} />}
  </Panel>;
}

function SettingsPage({ apiKey, onSave, onClear }: { apiKey: string; onSave: (value: string) => void; onClear: () => void }) {
  const [draft, setDraft] = useState(apiKey);
  useEffect(() => setDraft(apiKey), [apiKey]);

  return <div className="settings-grid">
    <Panel title="Khóa quản trị" subtitle="Dùng để gọi các API dashboard được bảo vệ">
      <form className="settings-form" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
        <label>ADMIN_API_KEY
          <input
            type="password"
            autoComplete="off"
            placeholder="Nhập đúng secret đã tạo trong Cloudflare"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <p>Khóa chỉ được lưu trong sessionStorage của tab trình duyệt này và sẽ mất khi phiên trình duyệt kết thúc.</p>
        <div className="form-actions">
          <button className="primary" type="submit" disabled={!draft.trim()}>Lưu và kết nối</button>
          {apiKey && <button className="secondary" type="button" onClick={onClear}>Xóa khóa khỏi trình duyệt</button>}
        </div>
      </form>
    </Panel>
    <Panel title="Trạng thái hạ tầng" subtitle="Các thành phần đã được cấu hình trong Worker">
      <ul className="status-list">
        <li><strong>Cloudflare Worker</strong><span>Đang phục vụ frontend và API cùng một tên miền</span></li>
        <li><strong>D1 binding</strong><span>Biến môi trường: DB</span></li>
        <li><strong>Webhook endpoint</strong><span>/api/telegram/webhook</span></li>
        <li><strong>Health check</strong><span>/api/health</span></li>
      </ul>
    </Panel>
  </div>;
}

function AccessRequired({ onOpenSettings }: { onOpenSettings: () => void }) {
  return <div className="access-card">
    <Settings />
    <h2>Cần nhập khóa quản trị</h2>
    <p>Dashboard không nhúng secret vào mã nguồn. Hãy nhập đúng giá trị ADMIN_API_KEY đã tạo trong Cloudflare.</p>
    <button className="primary" onClick={onOpenSettings}>Mở cài đặt</button>
  </div>;
}

function LoadingState() {
  return <div className="center-state inline-state"><div className="spinner" /><strong>Đang tải dữ liệu thật…</strong><span>Đang kết nối Worker và D1</span></div>;
}

function ErrorState({ message, onRetry, onSettings }: { message: string; onRetry: () => void; onSettings: () => void }) {
  return <div className="center-state inline-state">
    <div className="error-icon">!</div><strong>Không thể tải dữ liệu</strong><span>{message}</span>
    <div className="form-actions"><button className="primary" onClick={onRetry}><RefreshCw size={16} /> Thử lại</button><button className="secondary" onClick={onSettings}>Kiểm tra khóa</button></div>
  </div>;
}

function Panel({ title, subtitle, action, children }: { title: string; subtitle: string; action?: ReactNode; children: ReactNode }) {
  return <section className="panel"><div className="panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div>{action}</div>{children}</section>;
}

function PostList({ posts }: { posts: PostRow[] }) {
  return posts.length ? <div className="list">{posts.map((post, index) => <div className="post" key={post.id}>
    <b>{index + 1}</b><div><strong>{post.excerpt || '[Bài đăng media]'}</strong><span>{post.chatTitle} · {formatDate(post.publishedAt)}</span></div>
    <div className="post-stats"><span>{format.format(post.views)} lượt xem</span><small>{format.format(post.reactions)} reaction</small></div>
  </div>)}</div> : <Empty text="Chưa có bài viết được ghi nhận." />;
}

function CampaignList({ campaigns }: { campaigns: CampaignRow[] }) {
  return campaigns.length ? <div className="list">{campaigns.map((campaign) => <div className="campaign" key={campaign.id}>
    <div className="campaign-icon"><Megaphone /></div><div><strong>{campaign.name}</strong><span>{campaign.inviteLinks} invite link</span></div>
    <div><Status value={campaign.status} /><small>{format.format(campaign.conversions)} chuyển đổi</small></div>
  </div>)}</div> : <Empty text="Chưa có chiến dịch trong D1." />;
}

function Status({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const labelMap: Record<string, string> = {
    active: 'Đang chạy', completed: 'Hoàn tất', paused: 'Tạm dừng', draft: 'Bản nháp',
    member: 'Thành viên', administrator: 'Quản trị', creator: 'Chủ sở hữu', left: 'Đã rời', kicked: 'Bị chặn', restricted: 'Hạn chế',
  };
  return <em className={`status status-${normalized}`}>{labelMap[normalized] ?? value}</em>;
}

function SummaryCard({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
  const displayed = signed && value > 0 ? `+${format.format(value)}` : format.format(value);
  return <article className="summary-card"><span>{label}</span><strong>{displayed}</strong></article>;
}

function Empty({ text }: { text: string }) {
  return <div className="empty"><FileText /><strong>Chưa có dữ liệu</strong><span>{text}</span></div>;
}

function ChartLoading() {
  return <div className="chart-loading">Đang tải biểu đồ…</div>;
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormat.format(date);
}
