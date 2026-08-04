import { describe, expect, it } from 'vitest';
import { activeMemberRate, campaignEfficiency, netGrowth } from '../worker/analytics';

describe('công thức phân tích', () => {
  it('tính tăng trưởng ròng', () => expect(netGrowth(386, 72)).toBe(314));
  it('tính tỷ lệ thành viên hoạt động', () => {
    expect(activeMemberRate(250, 1_000)).toBe(25);
    expect(activeMemberRate(10, 0)).toBe(0);
  });
  it('tính hiệu quả chiến dịch cơ bản', () => {
    expect(campaignEfficiency(125, 500)).toBe(25);
    expect(campaignEfficiency(2, 0)).toBe(0);
  });
});
