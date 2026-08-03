type UserLike = {
  role?: string | null;
  tier?: string | null;
} | null | undefined;

type CourseLike = {
  isActive?: boolean | null;
  baseTier?: string | null;
} | null | undefined;

export type NormalizedAcademyTier = 'admin' | 'detal' | 'por_mayor' | 'gran_mayor' | null;

export function normalizeUserTier(user: UserLike): NormalizedAcademyTier {
  if (!user) return null;
  if (user.role === 'admin') return 'admin';

  switch (user.tier) {
    case 'gran_mayor':
    case 'granmayorista':
      return 'gran_mayor';
    case 'por_mayor':
    case 'mayorista':
      return 'por_mayor';
    case 'detal':
      return 'detal';
    default:
      return null;
  }
}

export function normalizeCourseAccess(course: CourseLike): 'por_mayor' | 'gran_mayor' | null {
  if (!course?.baseTier) return null;

  switch (course.baseTier) {
    case 'gran_mayor':
      return 'gran_mayor';
    case 'detal':
    case 'por_mayor':
      return 'por_mayor';
    default:
      return null;
  }
}

export function canAccessAcademy(user: UserLike): boolean {
  const tier = normalizeUserTier(user);
  return tier === 'admin' || tier === 'por_mayor' || tier === 'gran_mayor';
}

export function canAccessCourse(user: UserLike, course: CourseLike): boolean {
  const tier = normalizeUserTier(user);
  const requiredTier = normalizeCourseAccess(course);

  if (tier === 'admin') return true;
  if (!course?.isActive) return false;
  if (!tier || !requiredTier) return false;
  if (requiredTier === 'por_mayor') return tier === 'por_mayor' || tier === 'gran_mayor';
  if (requiredTier === 'gran_mayor') return tier === 'gran_mayor';
  return false;
}
