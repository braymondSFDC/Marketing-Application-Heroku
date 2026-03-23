'use strict';

require('dotenv').config();

const { Worker } = require('bullmq');
const { Redis } = require('ioredis');
const { processLaunchJob } = require('./jobs/launchJourney');
const { processSyncEngagement } = require('./jobs/syncEngagement');

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  tls: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

// ---------------------------------------------------------------------------
// Journey Launch Worker
// ---------------------------------------------------------------------------

const launchWorker = new Worker(
  'journey-launch',
  async (job) => {
    console.log(`[Worker] Processing launch job ${job.id} for journey ${job.data.journeyId}`);
    return processLaunchJob(job);
  },
  {
    connection,
    concurrency: 2,
    limiter: { max: 5, duration: 60000 }, // max 5 launches per minute
  }
);

launchWorker.on('completed', (job) => {
  console.log(`[Worker] Launch job ${job.id} completed successfully`);
});

launchWorker.on('failed', (job, err) => {
  console.error(`[Worker] Launch job ${job?.id} failed:`, err.message);
});

// ---------------------------------------------------------------------------
// Engagement Sync Worker
// ---------------------------------------------------------------------------

const engagementWorker = new Worker(
  'engagement-sync',
  async (job) => {
    return processSyncEngagement(job);
  },
  {
    connection,
    concurrency: 5,
  }
);

engagementWorker.on('failed', (job, err) => {
  console.error(`[Worker] Engagement sync ${job?.id} failed:`, err.message);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown() {
  console.log('[Worker] Shutting down...');
  await launchWorker.close();
  await engagementWorker.close();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('🔧 Worker dyno started — listening for jobs');
