const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const searchRegex = /\/\/ Get all unique users with push subscriptions\s*const \{ data: subs, error \} = await supabase\.from\("push_subscriptions"\)\.select\("user_id"\);\s*if \(error\) throw error;\s*if \(subs && subs\.length > 0\) \{\s*const uniqueUserIds = \[\.\.\.new Set\(subs\.map\(s => s\.user_id\)\)\];\s*\/\/ Send push to all in parallel\s*await Promise\.allSettled\(uniqueUserIds\.map\(id => sendPushToUser\(id, title, message, url\)\)\);\s*\}/;

const replaceString = `// Get all users so it appears in notification panel even if no push subscription
    const { data: users, error } = await supabase.from("profiles").select("id");
    if (error) throw error;
    
    if (users && users.length > 0) {
      const userIds = users.map(u => u.id);
      await Promise.allSettled(userIds.map(id => sendNotification(id, {
        type: 'system',
        title: title,
        message: message,
        path: url
      })));
    }`;

if (content.match(searchRegex)) {
    content = content.replace(searchRegex, replaceString);
    fs.writeFileSync('server.ts', content, 'utf8');
    console.log('Successfully patched broadcast endpoint in server.ts');
} else {
    console.log('Could not find broadcast endpoint logic in server.ts');
}
