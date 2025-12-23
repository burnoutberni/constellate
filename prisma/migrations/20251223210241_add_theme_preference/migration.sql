-- CreateEnum
CREATE TYPE "Theme" AS ENUM('LIGHT', 'DARK');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "theme" "Theme";