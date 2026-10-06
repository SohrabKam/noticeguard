-- CreateEnum
CREATE TYPE "ForecastProfile" AS ENUM ('EVEN', 'FRONT_LOADED', 'S_CURVE', 'BACK_LOADED');

-- AlterTable
ALTER TABLE "payment_schedules" ADD COLUMN     "forecastProfile" "ForecastProfile" NOT NULL DEFAULT 'EVEN';
