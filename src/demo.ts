export const overview = { totalMembers: 24832, newMembers: 386, leftMembers: 72, netGrowth: 314, active7d: 8954, active30d: 17640, totalPosts: 1284, totalReactions: 48572 };
const growthRows: Array<[string, number]> = [
  ['25/07', 22120], ['26/07', 22450], ['27/07', 22840], ['28/07', 23110], ['29/07', 23580], ['30/07', 23920], ['31/07', 24140], ['01/08', 24370], ['02/08', 24518], ['03/08', 24832],
];
export const growth = growthRows.map(([date, totalMembers]) => ({ date, totalMembers }));
export const posts = [
  { id: 1, excerpt: 'Bản tin thị trường tuần này: những tín hiệu đáng chú ý', chatTitle: 'Cộng đồng Đầu tư Việt', publishedAt: 'Hôm nay, 09:30', views: 12420, reactions: 936 },
  { id: 2, excerpt: 'Tài liệu hướng dẫn xây dựng chiến lược nội dung hiệu quả', chatTitle: 'Marketing thực chiến', publishedAt: 'Hôm qua, 18:15', views: 9846, reactions: 712 },
  { id: 3, excerpt: '5 cập nhật công nghệ nổi bật bạn không nên bỏ lỡ', chatTitle: 'Tech Việt Nam', publishedAt: '01/08, 08:00', views: 7531, reactions: 489 },
];
export const campaigns = [
  { id: 1, name: 'Ra mắt cộng đồng Q3', status: 'active', inviteLinks: 4, conversions: 624 },
  { id: 2, name: 'Nội dung chuyên sâu tháng 8', status: 'active', inviteLinks: 3, conversions: 318 },
  { id: 3, name: 'Hợp tác đối tác chiến lược', status: 'completed', inviteLinks: 6, conversions: 1084 },
];
