import { Router, type IRouter } from 'express';
import { requireAuth, requireRole } from '../../middleware/requireRole.js';
import * as academyService from '../../services/academy.service.js';
import { uploadCourseImage, deleteCourseImage } from '../../services/storage.service.js';
import { success, error } from '../../utils/response.js';
import { prisma } from '../../config/db.js';
import { z } from 'zod';
import Busboy from 'busboy';

const router: IRouter = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

const CourseSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().nullable(),
  baseTier: z.enum(['detal', 'por_mayor', 'gran_mayor']),
  unlockPrice: z.number().min(0),
  order: z.number().int().optional(),
});

const ModuleSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  order: z.number().int().optional(),
});

const VideoSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  youtubeUrl: z.string().url().max(500),
  duration: z.number().int().positive().optional(),
  isFreePreview: z.boolean().optional(),
  order: z.number().int().optional(),
});

// ── Courses ─────────────────────────────────────────────────────────

router.get('/courses', async (_req, res, next) => {
  try {
    const courses = await academyService.listCourses();
    success(res, courses);
  } catch (err) {
    next(err);
  }
});

router.get('/courses/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const course = await academyService.getCourse(id);
    if (!course) { error(res, 404, 'NOT_FOUND', 'Curso no encontrado'); return; }
    success(res, course);
  } catch (err) {
    next(err);
  }
});

router.post('/courses', async (req, res, next) => {
  try {
    const input = CourseSchema.parse(req.body);
    const course = await academyService.createCourse({
      ...input,
      imageUrl: input.imageUrl ?? undefined,
    });
    success(res, course, 201);
  } catch (err) {
    next(err);
  }
});

router.put('/courses/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const input = CourseSchema.partial().parse(req.body);
    const course = await academyService.updateCourse(id, {
      ...input,
      imageUrl: input.imageUrl === null ? null : input.imageUrl ?? undefined,
    });
    success(res, course);
  } catch (err) {
    next(err);
  }
});

router.delete('/courses/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await academyService.deleteCourse(id);
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

router.post('/courses/:id/image', async (req, res, next) => {
  try {
    const { id } = req.params;
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) { error(res, 404, 'NOT_FOUND', 'Curso no encontrado'); return; }

    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      error(res, 400, 'INVALID_CONTENT_TYPE', 'Se esperaba multipart/form-data');
      return;
    }

    const busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_FILE_SIZE } });
    let uploadedFile: { buffer: Buffer; filename: string; mimetype: string } | null = null;

    busboy.on('file', (_fieldname, stream, info) => {
      const { filename, mimeType } = info;
      if (!ALLOWED_TYPES.includes(mimeType)) { stream.destroy(); return; }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        uploadedFile = { buffer: Buffer.concat(chunks), filename, mimetype: mimeType };
      });
    });

    busboy.on('finish', async () => {
      try {
        if (!uploadedFile) {
          error(res, 400, 'NO_VALID_FILE', 'No se encontró un archivo válido (jpg, png, webp)');
          return;
        }

        if (course.imageUrl) {
          await deleteCourseImage(course.imageUrl).catch(() => {});
        }

        const ext = uploadedFile.filename.split('.').pop() || 'jpg';
        const uniqueName = `${Date.now()}.${ext}`;
        const url = await uploadCourseImage(id, {
          buffer: uploadedFile.buffer,
          filename: uniqueName,
          mimetype: uploadedFile.mimetype,
        });

        await prisma.course.update({ where: { id }, data: { imageUrl: url } });
        success(res, { imageUrl: url });
      } catch (err) {
        next(err);
      }
    });

    req.pipe(busboy);
  } catch (err) {
    next(err);
  }
});

router.delete('/courses/:id/image', async (req, res, next) => {
  try {
    const { id } = req.params;
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) { error(res, 404, 'NOT_FOUND', 'Curso no encontrado'); return; }
    if (!course.imageUrl) { error(res, 400, 'NO_IMAGE', 'El curso no tiene imagen'); return; }

    await deleteCourseImage(course.imageUrl);
    await prisma.course.update({ where: { id }, data: { imageUrl: null } });
    success(res, { imageUrl: null });
  } catch (err) {
    next(err);
  }
});

// ── Modules ─────────────────────────────────────────────────────────

router.post('/courses/:courseId/modules', async (req, res, next) => {
  try {
    const courseId = req.params.courseId as string;
    const input = ModuleSchema.parse(req.body);
    const mod = await academyService.createModule(courseId, input);
    success(res, mod, 201);
  } catch (err) {
    next(err);
  }
});

router.put('/modules/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const input = ModuleSchema.partial().parse(req.body);
    const mod = await academyService.updateModule(id, input);
    success(res, mod);
  } catch (err) {
    next(err);
  }
});

router.delete('/modules/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await academyService.deleteModule(id);
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

// ── Videos ──────────────────────────────────────────────────────────

router.post('/modules/:moduleId/videos', async (req, res, next) => {
  try {
    const moduleId = req.params.moduleId as string;
    const input = VideoSchema.parse(req.body);
    const video = await academyService.createVideo(moduleId, input);
    success(res, video, 201);
  } catch (err) {
    next(err);
  }
});

router.put('/videos/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    const input = VideoSchema.partial().parse(req.body);
    const video = await academyService.updateVideo(id, input);
    success(res, video);
  } catch (err) {
    next(err);
  }
});

router.delete('/videos/:id', async (req, res, next) => {
  try {
    const id = req.params.id as string;
    await academyService.deleteVideo(id);
    success(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
