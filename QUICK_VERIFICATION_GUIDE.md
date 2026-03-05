# Social Media Integration - Quick Verification Guide

**TL;DR** - 5 minute quick check to verify all fixes are working

---

## Step 1: Check Error Logging (2 minutes)

Open DevTools Console and paste invalid URL:
```
https://youtube.com/watch?v=invalid-id-xyz
```

**Expected**: See detailed error in console like:
```
[Enrichment] YouTube enrichment attempt 1/3 failed, retrying in 500ms:
{code: "NETWORK_ERROR", message: "...", retryable: true}
```

✅ **Pass** = Errors are now logged with details  
❌ **Fail** = Still silently failing (check browser console open)

---

## Step 2: Check Retry Logic (1 minute)

In DevTools Network tab, throttle to "Slow 3G", then paste valid YouTube URL:
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

**Expected**: See multiple fetch attempts in Network tab

✅ **Pass** = Multiple requests visible (showing retries)  
❌ **Fail** = Only one request (no retry logic)

---

## Step 3: Verify YouTube Still Works (1 minute)

Paste this YouTube URL:
```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

**Expected Output**:
- Title: "Rick Astley - Never Gonna Give You Up..." (video title)
- Thumbnail: Shows video thumbnail
- Duration: ~3 minutes

✅ **Pass** = Shows correct metadata  
❌ **Fail** = No metadata or wrong title

---

## Step 4: Test Instagram/Facebook/Twitter Detection (30 seconds each)

### Instagram:
```
https://www.instagram.com/p/ABC123/
```
**Expected**: Provider shows "Instagram detected" or similar

### Facebook:
```
https://www.facebook.com/test
```
**Expected**: Provider shows "Facebook detected"

### Twitter/X:
```
https://x.com/user/status/123
```
**Expected**: Provider shows "X / Twitter detected"

✅ **Pass** = All correctly detected  
❌ **Fail** = Shows "Website" or wrong provider

---

## Step 5: Verify Platform Support Table (30 seconds)

**Note**: This test requires importing `detectProvider`. Choose one approach:

**Option A (If running in the app's browser context with dev tools):**
Since `detectProvider` is exported from `src/lib/utils.ts`, it should be available if imported in the current module. Import it first:

```javascript
import { detectProvider } from '@/lib/utils';

const platforms = [
  'https://youtube.com/watch?v=test',
  'https://instagram.com/p/test', 
  'https://facebook.com/test',
  'https://x.com/test/status/123',
  'https://tiktok.com/@test/video/123',
];

platforms.forEach(url => {
  const provider = detectProvider(url);
  console.log(`${new URL(url).hostname} → ${provider}`);
});
```

**Option B (Browser console test using QuickAddBar):**
Instead, go to the QuickAddBar component in the app and paste the URLs to observe the detected provider badge.
Each URL should display the correct provider icon (YouTube → red dot, Instagram → pink dot, etc.)

**Expected**: All platforms identified correctly

✅ **Pass** = All identified  
❌ **Fail** = Some show as "generic"

---

## Summary Checklist

- [ ] Error logging shows enrichment attempt details
- [ ] Retry logic visible in Network tab
- [ ] YouTube enrichment still works with correct metadata
- [ ] Instagram/Facebook/Twitter/TikTok/Reddit detected correctly  
- [ ] All 10+ platforms recognized
- [ ] No console errors for normal operations

---

## All Tests Passing?

✅ **YES** → Ready for deployment  
❌ **NO** → Check troubleshooting guide in TESTING_GUIDE_SOCIAL_MEDIA.md

---

## What Got Fixed

| Issue | Before | After |
|-------|--------|-------|
| Error Details | Silent failure | Detailed logs |
| Network Issues | Fail immediately | Retry up to 3x |
| Timeout | Could hang forever | 10s API, 5s HTTP |
| Instagram | Not supported | OpenGraph fallback |
| Facebook | Not supported | OpenGraph fallback |
| Twitter/X | Not supported | OpenGraph fallback |
| TikTok | Not supported | OpenGraph fallback |
| Reddit | Not supported | OpenGraph fallback |

---

**Time to verify**: ~5 minutes  
**Status**: ✅ Complete
