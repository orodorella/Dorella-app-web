import { prisma } from '../config/db.js';
import type { Tier } from '@prisma/client';
import { getYouTubeDuration } from './youtube.service.js';

// ── Admin: Course CRUD ──────────────────────────────────────────────

export async function listCourses() {
  return prisma.course.findMany({
    orderBy: { order: 'asc' },
    include: { _count: { select: { modules: true, accesses: true } } },
  });
}

export async function getCourse(id: string) {
  return prisma.course.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { order: 'asc' },
        include: { videos: { orderBy: { order: 'asc' } } },
      },
      _count: { select: { modules: true, accesses: true } },
    },
  });
}

export async function createCourse(data: {
  title: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  baseTier: Tier;
  unlockPrice: number;
  order?: number;
}) {
  return prisma.course.create({ data });
}

export async function updateCourse(
  id: string,
  data: Partial<{
    title: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
    baseTier: Tier;
    unlockPrice: number;
    isActive: boolean;
    order: number;
  }>
) {
  return prisma.course.update({ where: { id }, data });
}

export async function deleteCourse(id: string) {
  return prisma.course.delete({ where: { id } });
}

// ── Admin: Module CRUD ──────────────────────────────────────────────

export async function createModule(
  courseId: string,
  data: { title: string; description?: string; order?: number }
) {
  return prisma.module.create({ data: { ...data, courseId } });
}

export async function updateModule(
  id: string,
  data: Partial<{ title: string; description: string | null; order: number }>
) {
  return prisma.module.update({ where: { id }, data });
}

export async function deleteModule(id: string) {
  return prisma.module.delete({ where: { id } });
}

// ── Admin: Video CRUD ───────────────────────────────────────────────

export async function createVideo(
  moduleId: string,
  data: {
    title: string;
    description?: string;
    youtubeUrl: string;
    duration?: number;
    isFreePreview?: boolean;
    order?: number;
  }
) {
  let duration = data.duration;
  if (!duration && data.youtubeUrl) {
    duration = await getYouTubeDuration(data.youtubeUrl) ?? undefined;
  }
  return prisma.video.create({ data: { ...data, duration, moduleId } });
}

export async function updateVideo(
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    youtubeUrl: string;
    duration: number | null;
    isFreePreview: boolean;
    order: number;
  }>
) {
  if (data.youtubeUrl && data.duration === undefined) {
    const fetched = await getYouTubeDuration(data.youtubeUrl);
    if (fetched) data.duration = fetched;
  }
  return prisma.video.update({ where: { id }, data });
}

export async function deleteVideo(id: string) {
  return prisma.video.delete({ where: { id } });
}

// ── Access logic ────────────────────────────────────────────────────

const TIER_ORDER: Record<Tier, number> = {
  detal: 0,
  por_mayor: 1,
  gran_mayor: 2,
};

export function canAccessVideo(
  userTier: Tier,
  courseBaseTier: Tier,
  isFreePreview: boolean,
  hasPurchasedAccess: boolean
): boolean {
  if (isFreePreview) return true;
  if (hasPurchasedAccess) return true;
  return TIER_ORDER[userTier] >= TIER_ORDER[courseBaseTier];
}

// ── Public: Course catalog ──────────────────────────────────────────

export async function listPublishedCourses(userTier?: Tier) {
  const courses = await prisma.course.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    include: {
      _count: { select: { modules: true, accesses: true } },
    },
  });

  // Count videos per course via modules
  const courseIds = courses.map((c) => c.id);
  const moduleRows = await prisma.module.findMany({
    where: { courseId: { in: courseIds } },
    select: { id: true, courseId: true },
  });

  const moduleIdToCourseId = new Map(moduleRows.map((m) => [m.id, m.courseId]));
  const moduleIds = moduleRows.map((m) => m.id);

  const videoCounts = await prisma.video.groupBy({
    by: ['moduleId'],
    where: { moduleId: { in: moduleIds } },
    _count: true,
    _sum: { duration: true },
  });

  const totalVideosByCourse = new Map<string, number>();
  const totalDurationByCourse = new Map<string, number>();
  for (const vc of videoCounts) {
    const courseId = moduleIdToCourseId.get(vc.moduleId);
    if (courseId) {
      totalVideosByCourse.set(
        courseId,
        (totalVideosByCourse.get(courseId) || 0) + vc._count
      );
      totalDurationByCourse.set(
        courseId,
        (totalDurationByCourse.get(courseId) || 0) + (vc._sum.duration || 0)
      );
    }
  }

  return courses.map((c) => ({
    ...c,
    totalModules: c._count.modules,
    totalVideos: totalVideosByCourse.get(c.id) || 0,
    totalDuration: totalDurationByCourse.get(c.id) || 0,
    hasAccess: userTier ? TIER_ORDER[userTier] >= TIER_ORDER[c.baseTier] : false,
  }));
}

// ── Public: Course detail ───────────────────────────────────────────

export async function getCourseDetail(slug: string, userId?: string, userTier?: Tier) {
  const course = await prisma.course.findUnique({
    where: { slug, isActive: true },
    include: {
      modules: {
        orderBy: { order: 'asc' },
        include: { videos: { orderBy: { order: 'asc' } } },
      },
    },
  });

  if (!course) return null;

  let hasAccess = false;
  if (userId) {
    const access = await prisma.userCourseAccess.findUnique({
      where: { userId_courseId: { userId, courseId: course.id } },
    });
    hasAccess = !!access;
  }

  // Check tier-based access
  if (!hasAccess && userTier) {
    hasAccess = TIER_ORDER[userTier] >= TIER_ORDER[course.baseTier];
  }

  // Get watched videos
  let watchedIds = new Set<string>();
  if (userId) {
    const progress = await prisma.userVideoProgress.findMany({
      where: { userId, watched: true },
      select: { videoId: true },
    });
    watchedIds = new Set(progress.map((p) => p.videoId));
  }

  const totalVideos = course.modules.reduce((acc, m) => acc + m.videos.length, 0);
  const watchedCount = course.modules.reduce(
    (acc, m) => acc + m.videos.filter((v) => watchedIds.has(v.id)).length,
    0
  );

  const modules = course.modules.map((m) => ({
    ...m,
    videos: m.videos.map((v) => ({
      ...v,
      watched: watchedIds.has(v.id),
    })),
  }));

  return { ...course, modules, hasAccess, watchedCount, totalVideos };
}

// ── Public: Video progress ──────────────────────────────────────────

export async function markVideoWatched(userId: string, videoId: string) {
  return prisma.userVideoProgress.upsert({
    where: { userId_videoId: { userId, videoId } },
    update: { watched: true, watchedAt: new Date() },
    create: { userId, videoId, watched: true, watchedAt: new Date() },
  });
}

// ── Public: Unlock course ───────────────────────────────────────────

export async function hasCourseAccess(userId: string, courseId: string) {
  const access = await prisma.userCourseAccess.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  return !!access;
}

export async function grantCourseAccess(userId: string, courseId: string, orderId: string) {
  return prisma.userCourseAccess.create({
    data: { userId, courseId, orderId },
  });
}

export async function getCourseForUnlock(courseId: string) {
  return prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, slug: true, unlockPrice: true, baseTier: true, isActive: true },
  });
}
