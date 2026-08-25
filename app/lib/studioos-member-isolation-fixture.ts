export type MemberFixtureRow = {
  memberId: string;
  tenantId: string;
  guildId: string;
  characterId: string;
  value: string;
};

export function readTenantMemberFixture(rows: readonly MemberFixtureRow[], tenantId: string): MemberFixtureRow[] {
  return rows.filter((row) => row.tenantId === tenantId);
}

export function readMemberFixture(rows: readonly MemberFixtureRow[], input: { tenantId: string; memberId: string }): MemberFixtureRow[] {
  return rows.filter((row) => row.tenantId === input.tenantId && row.memberId === input.memberId);
}
