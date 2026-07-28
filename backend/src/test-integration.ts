import { db, initializeDatabase } from './config/db';
import { redisConnection } from './config/redis';
import { createCampaign } from './services/emailService';
import crypto from 'crypto';

import './queue/emailWorker';
async function runTest() {
  console.log('--- STARTING RATE LIMIT THROTTLING INTEGRATION TEST ---');
  try {
    console.log('Initializing database schema...');
    await initializeDatabase();
    
    // 1. Create a sender with hourly limit of 2 emails
    const senderId = crypto.randomUUID();
    const mockSender = {
      id: senderId,
      name: 'Throttle Test Sender',
      // Starts with mock_ so nodemailer doesn't try real SMTP sending
      smtp_user: 'mock_throttle_sender@ethereal.email',
      smtp_pass: 'mock_password',
      max_per_hour: 2, 
    };
    
    await db.insertInto('senders').values(mockSender).execute();
    console.log(`Created sender: ${mockSender.name} with hourly cap of ${mockSender.max_per_hour}`);

    // 2. Schedule campaign for 4 leads, staggered by 1 second each
    const leads = ['lead1@example.com', 'lead2@example.com', 'lead3@example.com', 'lead4@example.com'];
    console.log(`Scheduling staggered campaign for ${leads.length} leads...`);
    
    const { campaignId } = await createCampaign({
      userId: 'test_developer',
      subject: 'Verification Campaign',
      body: '<h3>Testing rate limiter capabilities</h3>',
      leads,
      senderId,
      startTime: new Date(),
      delayMs: 1000,
      hourlyLimit: 2,
    });
    
    console.log(`Campaign ${campaignId} scheduled. Waiting 8 seconds for worker processing...`);
    await new Promise(r => setTimeout(r, 8000));
    
    // 3. Query statuses
    const results = await db.selectFrom('emails')
      .select(['recipient', 'status', 'attempts', 'error'])
      .where('campaign_id', '=', campaignId)
      .execute();
      
    console.log('\n--- VERIFICATION METRICS ---');
    for (const email of results) {
      console.log(`Lead: ${email.recipient} | Status: ${email.status} | Attempts: ${email.attempts} | Error: ${email.error}`);
    }
    
    const processedCount = results.filter(r => r.status === 'sent' || r.status === 'failed').length;
    const rescheduledCount = results.filter(r => r.status === 'rescheduled').length;
    
    console.log(`\nSummary:`);
    console.log(`  Processed: ${processedCount}`);
    console.log(`  Rescheduled (Delayed): ${rescheduledCount}`);
    
    if (rescheduledCount > 0) {
      console.log('\n✅ PASS: Throttling correctly rescheduled emails exceeding the sender hourly limit!');
    } else {
      console.log('\n❌ FAIL: Throttling did not reschedule excess emails.');
    }
    
    // 4. Cleanup test data
    console.log('\nCleaning up database records...');
    await db.deleteFrom('emails').where('campaign_id', '=', campaignId).execute();
    await db.deleteFrom('campaigns').where('id', '=', campaignId).execute();
    await db.deleteFrom('senders').where('id', '=', senderId).execute();
    console.log('Cleanup complete.');
    
  } catch (error) {
    console.error('Integration test encountered an error:', error);
  } finally {
    // Terminate DB and Redis connections
    await redisConnection.quit();
    await db.destroy();
    console.log('--- TEST RUN FINISHED ---');
    process.exit(0);
  }
}

// Allow MySQL & Redis containers to start up fully if called in automation scripts
setTimeout(runTest, 1000);
