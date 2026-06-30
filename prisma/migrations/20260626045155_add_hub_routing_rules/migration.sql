-- CreateTable
CREATE TABLE "hub_routing_rules" (
    "id" TEXT NOT NULL,
    "cpo_country_code" TEXT NOT NULL,
    "cpo_party_id" TEXT NOT NULL,
    "emsp_country_code" TEXT NOT NULL,
    "emsp_party_id" TEXT NOT NULL,
    "contract_status" TEXT NOT NULL,
    "channel_status" TEXT NOT NULL,
    "emsp_base_url" TEXT NOT NULL,
    "emsp_token_b" TEXT NOT NULL,
    "routing_filters" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hub_routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hub_routing_rules_cpo_country_code_cpo_party_id_emsp_countr_key" ON "hub_routing_rules"("cpo_country_code", "cpo_party_id", "emsp_country_code", "emsp_party_id");
