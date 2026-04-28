// PocketBase Hook: Auto-Cleanup 2.0 (3 Months Retention + File Purge)
// Save this to: pb_hooks/cleanup.pb.js

cronAdd("cleanupOldData", "0 0 * * *", () => {
    const days = 90;
    const date = new Date();
    date.setDate(date.getDate() - days);
    const dateStr = date.toISOString().replace('T', ' ').split('.')[0];

    console.log(`[Cron] Starting cleanup for data before ${dateStr}...`);

    // Fetch messages to delete
    const messages = $app.dao().findRecordsByFilter(
        "messages",
        "created < {:date}",
        "-created",
        1000, // Batch size
        0,
        { "date": dateStr }
    );

    if (messages.length === 0) {
        console.log("[Cron] Nothing to clean up.");
        return;
    }

    for (let msg of messages) {
        try {
            // This method automatically handles file deletion from storage!
            $app.dao().deleteRecord(msg);
        } catch (e) {
            console.error(`[Cron] Failed to delete record ${msg.id}: ${e}`);
        }
    }

    console.log(`[Cron] Successfully purged ${messages.length} old messages and their media.`);
})
