-- CreateTable
CREATE TABLE "dashboard_widget_role_defaults" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_widget_role_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_widget_user_overrides" (
    "id" TEXT NOT NULL,
    "salonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "widgetKey" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_widget_user_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dashboard_widget_role_defaults_salonId_idx" ON "dashboard_widget_role_defaults"("salonId");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_widget_role_defaults_salonId_role_widgetKey_key" ON "dashboard_widget_role_defaults"("salonId", "role", "widgetKey");

-- CreateIndex
CREATE INDEX "dashboard_widget_user_overrides_salonId_idx" ON "dashboard_widget_user_overrides"("salonId");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_widget_user_overrides_userId_widgetKey_key" ON "dashboard_widget_user_overrides"("userId", "widgetKey");

-- AddForeignKey
ALTER TABLE "dashboard_widget_role_defaults" ADD CONSTRAINT "dashboard_widget_role_defaults_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widget_user_overrides" ADD CONSTRAINT "dashboard_widget_user_overrides_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "salons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widget_user_overrides" ADD CONSTRAINT "dashboard_widget_user_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
