import { test, expect, login, admin } from './fixtures.mjs';

test('admin student list shows 10 rows per page and search returns to page 1', async ({ page, backend }) => {
  for (let i = 1; i <= 45; i++) {
    const n = String(i).padStart(2, '0');
    backend.db.users.push({ id: `paged-${n}`, name: `페이지학인${n}`, role: 'student', member_no: `PAGE-${n}`, phone: `010-1000-00${n}`, birth_date: '1990-01-01', created_at: '2026-01-01' });
  }
  await login(page, admin.id);

  const studentTable = page.locator('table').filter({ hasText: '성명 / 아이디' });
  const pager = page.getByRole('navigation', { name: '목록 페이지' }).first();
  await expect(pager).toContainText('중 1–10');
  await expect(studentTable.locator('tbody tr')).toHaveCount(10);

  await pager.getByRole('button', { name: '2', exact: true }).click();
  await expect(pager).toContainText('중 11–20');
  await expect(pager.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: 'test_artifacts/admin-pagination/students_page2.png', fullPage: true });

  // 검색하면 1페이지로 돌아가고, 10건 이하면 페이지 번호를 숨긴다(검색은 전화번호 숫자도 찾으므로 번호 전체로 검색).
  await page.getByPlaceholder('수강생 검색 (이름, 휴대전화 번호, 아이디, 회원번호)').fill('010-1000-0045');
  await expect(studentTable.locator('tbody tr')).toHaveCount(1);
  await expect(studentTable).toContainText('페이지학인45');
  await expect(page.getByRole('navigation', { name: '목록 페이지' })).toHaveCount(0);
  expect(backend.errors).toEqual([]);
});
