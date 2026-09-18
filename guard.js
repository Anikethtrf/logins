// Run before the application or any credentials are displayed.
(() => {
 const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 const permitted=location.protocol==='https:'||location.protocol==='chrome-extension:'||(location.protocol==='http:'&&local);
 if(window.top!==window.self||!permitted){document.documentElement.textContent='Open Pocket Vault directly using HTTPS or localhost.';return;}
 if(location.search||location.hash)history.replaceState(null,'',location.pathname);
})();
