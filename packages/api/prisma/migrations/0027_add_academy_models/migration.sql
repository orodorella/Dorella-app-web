-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "image_url" VARCHAR(500),
    "base_tier" "Tier" NOT NULL,
    "unlock_price" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "course_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "module_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "youtube_url" VARCHAR(500) NOT NULL,
    "duration" INTEGER,
    "is_free_preview" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_course_accesses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_course_accesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_video_progresses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "watched" BOOLEAN NOT NULL DEFAULT false,
    "watched_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_video_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_is_active_order_idx" ON "courses"("is_active", "order");

-- CreateIndex
CREATE INDEX "modules_course_id_idx" ON "modules"("course_id");

-- CreateIndex
CREATE INDEX "videos_module_id_idx" ON "videos"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_course_accesses_user_id_course_id_key" ON "user_course_accesses"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "user_course_accesses_course_id_idx" ON "user_course_accesses"("course_id");

-- CreateIndex
CREATE INDEX "user_course_accesses_order_id_idx" ON "user_course_accesses"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_video_progresses_user_id_video_id_key" ON "user_video_progresses"("user_id", "video_id");

-- CreateIndex
CREATE INDEX "user_video_progresses_video_id_idx" ON "user_video_progresses"("video_id");

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_course_accesses" ADD CONSTRAINT "user_course_accesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_course_accesses" ADD CONSTRAINT "user_course_accesses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_course_accesses" ADD CONSTRAINT "user_course_accesses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_video_progresses" ADD CONSTRAINT "user_video_progresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_video_progresses" ADD CONSTRAINT "user_video_progresses_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
