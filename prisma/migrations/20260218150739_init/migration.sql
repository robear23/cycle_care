-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "telegram_chat_id" TEXT NOT NULL,
    "partner_name" TEXT,
    "cycle_start_date" DATETIME NOT NULL,
    "cycle_length" INTEGER NOT NULL DEFAULT 28,
    "period_duration" INTEGER NOT NULL DEFAULT 5,
    "notification_time" TEXT NOT NULL DEFAULT '08:00',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "subscription_status" TEXT NOT NULL DEFAULT 'trial',
    "stripe_customer_id" TEXT,
    "trial_ends_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phase" TEXT NOT NULL,
    "message_text" TEXT NOT NULL,
    "tone" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "message_id" INTEGER NOT NULL,
    "sent_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MessageLog_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegram_chat_id_key" ON "User"("telegram_chat_id");
