-- DropForeignKey
ALTER TABLE "user_course_accesses" DROP CONSTRAINT "user_course_accesses_course_id_fkey";

-- DropForeignKey
ALTER TABLE "user_course_accesses" DROP CONSTRAINT "user_course_accesses_order_id_fkey";

-- DropForeignKey
ALTER TABLE "user_course_accesses" DROP CONSTRAINT "user_course_accesses_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_video_progresses" DROP CONSTRAINT "user_video_progresses_user_id_fkey";

-- DropIndex
DROP INDEX "catalogo_productos_catalogo_id_idx";

-- DropIndex
DROP INDEX "products_nombre_trgm_idx";

-- DropIndex
DROP INDEX "products_sku_trgm_idx";

-- RenameForeignKey
ALTER TABLE "users" RENAME CONSTRAINT "users_deactivated_by_fkey" TO "fk_users_deactivated_by";

-- RenameForeignKey
ALTER TABLE "users" RENAME CONSTRAINT "users_tier_changed_by_fkey" TO "fk_users_tier_changed_by";

-- AddForeignKey
ALTER TABLE "user_course_accesses" ADD CONSTRAINT "user_course_accesses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_course_accesses" ADD CONSTRAINT "user_course_accesses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_course_accesses" ADD CONSTRAINT "user_course_accesses_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_video_progresses" ADD CONSTRAINT "user_video_progresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
