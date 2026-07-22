import { Tier } from './user';

export interface Course {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  baseTier: Tier;
  unlockPrice: number;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Video {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  youtubeUrl: string;
  duration: number | null;
  isFreePreview: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseWithModules extends Course {
  modules: (Module & { videos: Video[] })[];
  _count?: { modules: number; accesses: number };
}

export interface CourseListItem extends Course {
  _count: { modules: number; accesses: number };
}

export interface UserCourseAccess {
  id: string;
  userId: string;
  courseId: string;
  orderId: string;
  createdAt: string;
}

export interface UserVideoProgress {
  id: string;
  userId: string;
  videoId: string;
  watched: boolean;
  watchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseDetailPublic extends Course {
  modules: (Module & {
    videos: (Video & { watched?: boolean })[];
  })[];
  hasAccess: boolean;
  watchedCount: number;
  totalVideos: number;
}

export interface CourseWithAccess extends Course {
  hasAccess: boolean;
  watchedCount: number;
  totalVideos: number;
  totalModules: number;
}
