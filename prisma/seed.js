const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set in environment variables");
  }

  console.log("Seeding database...");
  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();

    // 1. Seed CPO tenant (TW*CPO)
    console.log("Upserting CPO tenant (TW*CPO)...");
    const cpoParty = await prisma.party.upsert({
      where: {
        countryCode_partyId_role: {
          countryCode: "TW",
          partyId: "CPO",
          role: "CPO",
        },
      },
      update: {
        name: "CPO",
        rateLimit: 100,
        rateLimitWindow: 60,
      },
      create: {
        countryCode: "TW",
        partyId: "CPO",
        role: "CPO",
        name: "CPO",
        rateLimit: 100,
        rateLimitWindow: 60,
      },
    });

    await prisma.credential.upsert({
      where: { partyId: cpoParty.id },
      update: {
        tokenB: "mock_cpo_token_b_123",
        tokenC: "mock_cpo_token_c_123",
      },
      create: {
        partyId: cpoParty.id,
        tokenB: "mock_cpo_token_b_123", // Align with static token in .env
        tokenC: "mock_cpo_token_c_123",
      },
    });

    // 2. Seed EMSP tenant (TW*EMSP)
    console.log("Upserting EMSP tenant (TW*EMSP)...");
    const emspParty = await prisma.party.upsert({
      where: {
        countryCode_partyId_role: {
          countryCode: "TW",
          partyId: "EMSP",
          role: "EMSP",
        },
      },
      update: {
        name: "Taiwan Roaming EMSP",
        rateLimit: 50,
        rateLimitWindow: 60,
      },
      create: {
        countryCode: "TW",
        partyId: "EMSP",
        role: "EMSP",
        name: "Taiwan Roaming EMSP",
        rateLimit: 50,
        rateLimitWindow: 60,
      },
    });

    await prisma.credential.upsert({
      where: { partyId: emspParty.id },
      update: {
        tokenB: "mock_emsp_token_b_123",
        tokenC: "mock_emsp_token_b_123",
        url: "http://localhost:5053", // Default target EMSP
      },
      create: {
        partyId: emspParty.id,
        tokenB: "mock_emsp_token_b_123",
        tokenC: "mock_emsp_token_b_123",
        url: "http://localhost:5053",
      },
    });

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
