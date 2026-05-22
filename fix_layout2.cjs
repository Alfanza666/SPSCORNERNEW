const fs = require('fs');

function patchFile(path) {
  let content = fs.readFileSync(path, 'utf8');

  // Remove the useEffect requestPermission block
  const targetStr1 = `    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }`;
  const replaceStr1 = `    // We no longer automatically request Notification permission here.`;
  content = content.replace(targetStr1, replaceStr1);

  // Add the UI button to the notification panel
  const targetStr2 = `                  <div className="max-h-96 overflow-y-auto custom-scrollbar">`;
  const replaceStr2 = `                  {'Notification' in window && Notification.permission === 'default' && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex items-center justify-between gap-3">
                      <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Nyalakan push notifikasi untuk update</p>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          subscribeToWebPush && subscribeToWebPush(true).then(() => {
                            if (Notification.permission === 'granted') window.location.reload();
                          });
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shrink-0 shadow-sm"
                      >
                        Aktifkan
                      </button>
                    </div>
                  )}
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">`;
  // For PortalLayout it might be `max-h-[32rem]`
  const targetStr3 = `                  <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">`;
  const replaceStr3 = `                  {'Notification' in window && Notification.permission === 'default' && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 flex items-center justify-between gap-3">
                      <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Nyalakan push notifikasi untuk update</p>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          subscribeToWebPush && subscribeToWebPush(true).then(() => {
                            if (Notification.permission === 'granted') window.location.reload();
                          });
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shrink-0 shadow-sm"
                      >
                        Aktifkan
                      </button>
                    </div>
                  )}
                  <div className="max-h-[32rem] overflow-y-auto custom-scrollbar">`;

  content = content.replace(targetStr2, replaceStr2);
  content = content.replace(targetStr3, replaceStr3);

  // Expose subscribeToWebPush if missing
  if (content.includes('const { notifications, unreadCount, markAllAsRead, markOneAsRead } = useNotifications();')) {
    content = content.replace(
      'const { notifications, unreadCount, markAllAsRead, markOneAsRead } = useNotifications();',
      'const { notifications, unreadCount, markAllAsRead, markOneAsRead, subscribeToWebPush } = useNotifications();'
    );
  }

  fs.writeFileSync(path, content);
  console.log('Patched', path);
}

patchFile('src/pages/dashboard/DashboardLayout.tsx');
patchFile('src/pages/dashboard/PortalLayout.tsx');
