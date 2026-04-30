#!/usr/bin/env tsx

import { asc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { Blogs } from './blogs';
import {
  buildMainTagDescriptions,
  chunkBy,
  collectProgramNames,
  collectSubTags,
  createStats,
  dedupeBlogsByUrl,
  getNewDatabaseUrl,
  getOldDatabaseUrl,
  HELP,
  isTruthy,
  printPreflightSummary,
  readBatchSize,
} from './migrate-legacy-blogs.shared';
import { ensurePrograms, ensureTagDefinitions, processBatch } from './migrate-legacy-blogs.write';

const printResult = (result: Record<string, unknown>) => {
  console.log(JSON.stringify(result, null, 2));
};

const runMigration = async (
  oldDatabaseUrl: string,
  newDatabaseUrl: string,
  batchSize: number,
  dryRun: boolean,
) => {
  const oldPool = new Pool({ connectionString: oldDatabaseUrl });
  const newPool = new Pool({ connectionString: newDatabaseUrl });
  const oldDb = drizzle(oldPool);
  const newDb = drizzle(newPool);

  try {
    const blogs = await oldDb.select().from(Blogs).orderBy(asc(Blogs.join_time));
    if (blogs.length === 0) {
      console.log('No rows found in legacy blogs table.');
      return;
    }

    const { deduped: dedupedBlogs, duplicateRows } = dedupeBlogsByUrl(blogs);
    printPreflightSummary(blogs, dedupedBlogs, duplicateRows, batchSize);

    if (dryRun) {
      console.log('Dry run enabled. No data was written to the new database.');
      return;
    }

    const stats = createStats();
    stats.skippedDuplicateUrl = duplicateRows;
    await migrateBatches(newDb, dedupedBlogs, batchSize, stats);
    printResult({
      ok: true,
      imported: stats.processed,
      created: stats.created,
      updated: stats.updated,
      skippedInvalidUrl: stats.skippedInvalidUrl,
      skippedDuplicateUrl: stats.skippedDuplicateUrl,
      withProgram: stats.withProgram,
      withoutProgram: stats.withoutProgram,
      unknownMainTag: stats.unknownMainTag,
      unknownSource: stats.unknownSource,
    });
  } finally {
    await Promise.all([oldPool.end(), newPool.end()]);
  }
};

const migrateBatches = async (
  newDb: ReturnType<typeof drizzle>,
  blogs: (typeof Blogs.$inferSelect)[],
  batchSize: number,
  stats: ReturnType<typeof createStats>,
) => {
  const writeBatches = chunkBy(blogs, batchSize);

  await newDb.transaction(async (tx) => {
    const mainTagDescriptions = buildMainTagDescriptions();
    const mainTagIdByLabel = await ensureTagDefinitions(
      tx,
      Array.from(mainTagDescriptions.keys()),
      'MAIN',
      mainTagDescriptions,
    );
    const subTagIdByLabel = await ensureTagDefinitions(tx, collectSubTags(blogs), 'SUB');
    const programIdByName = await ensurePrograms(tx, collectProgramNames(blogs));

    for (const [index, batch] of writeBatches.entries()) {
      await processBatch(tx, batch, mainTagIdByLabel, subTagIdByLabel, programIdByName, stats);
      console.log(
        `[batch ${index + 1}/${writeBatches.length}] processed=${stats.processed} created=${stats.created} updated=${stats.updated}`,
      );
    }
  });
};

const main = async (): Promise<void> => {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP);
    return;
  }

  await runMigration(
    getOldDatabaseUrl(),
    getNewDatabaseUrl(),
    readBatchSize(),
    isTruthy(process.env.MIGRATE_LEGACY_DRY_RUN),
  );
};

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
