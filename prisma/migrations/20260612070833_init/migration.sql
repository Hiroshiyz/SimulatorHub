-- CreateTable
CREATE TABLE "parties" (
    "id" TEXT NOT NULL,
    "country_code" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT,
    "rate_limit" INTEGER,
    "rate_limit_window" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" TEXT NOT NULL,
    "token_a" TEXT,
    "token_b" TEXT,
    "token_c" TEXT,
    "url" TEXT,
    "party_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "party_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "postal_code" TEXT,
    "country" TEXT NOT NULL,
    "coordinates" JSONB NOT NULL,
    "raw_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("party_id","id")
);

-- CreateTable
CREATE TABLE "evses" (
    "location_party_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "id" TEXT,
    "status" TEXT NOT NULL,
    "raw_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evses_pkey" PRIMARY KEY ("location_party_id","location_id","uid")
);

-- CreateTable
CREATE TABLE "sessions" (
    "party_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "evse_uid" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "kwh" DOUBLE PRECISION NOT NULL,
    "raw_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("party_id","id")
);

-- CreateTable
CREATE TABLE "cdrs" (
    "party_id" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "raw_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cdrs_pkey" PRIMARY KEY ("party_id","id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parties_country_code_party_id_role_key" ON "parties"("country_code", "party_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_token_a_key" ON "credentials"("token_a");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_token_b_key" ON "credentials"("token_b");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_token_c_key" ON "credentials"("token_c");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_party_id_key" ON "credentials"("party_id");

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evses" ADD CONSTRAINT "evses_location_party_id_location_id_fkey" FOREIGN KEY ("location_party_id", "location_id") REFERENCES "locations"("party_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cdrs" ADD CONSTRAINT "cdrs_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
