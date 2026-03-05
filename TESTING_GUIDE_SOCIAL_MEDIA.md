# Social Media Enrichment - Testing Guide

**Last Updated**: March 5, 2026  
**Status**: Ready for Testing

## Overview

This guide provides comprehensive testing procedures to verify that the social media enrichment fixes are working correctly.

---

## Quick Start: Manual Testing

### Test 1: Check Error Logging is Working

**Objective**: Verify that enrichment errors are now logged with details

**Steps**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. In the app, paste an invalid/non-existent URL: `https://youtube.com/watch?v=invalid-video-id`
4. Click "Save"
5. Check console for error messages

**Expected Output**:
```
[Enrichment] YouTube enrichment attempt 1/3 failed, retrying in 500ms:
{
  code: 'TIMEOUT' or 'NETWORK_ERROR' or 'UNKNOWN'
  message: "..."
  retryable: true
}
[Enrichment] YouTube enrichment failed after 3 attempts: ...
```

**Success Criteria**: ✅ Error messages appear with details about what failed

---

### Test 2: Check Retry Logic is Working

**Objective**: Verify that enrichment retries on transient failures

**Steps**:
1. Open browser DevTools
2. Go to Network tab
3. Set network throttling to "Slow 3G" or manually block network briefly
4. Paste a valid YouTube URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
5. Watch the Network tab and Console

**Expected Output**:
- Console shows retries being attempted
- Eventually succeeds or gracefully fails with explanation

**Success Criteria**: ✅ Multiple fetch attempts visible in Network tab (shows at least 1-3 attempts)

---

### Test 3: YouTube Enrichment Still Works

**Objective**: Verify YouTube enrichment wasn't broken by our changes

**URL**: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`

**Expected Result**:
```
Title: "Rick Astley - Never Gonna Give You Up..."
Thumbnail: [Shows video thumbnail]
Duration: ~3m
Source: YouTube API
```

**Success Criteria**: ✅ Displays "Rick Astley" and fetches correct metadata

---

### Test 4: TMDB Movie Enrichment Still Works

**Objective**: Verify TMDB enrichment wasn't broken by our changes

**Steps**:
1. In the enrichment service, temporarily test TMDB:
```typescript
// In browser console:
const result = await fetch('https://api.themoviedb.org/3/search/movie?api_key=YOUR_KEY&query=Inception');
const data = await result.json();
console.log(data.results[0]);
```

**Expected Result**: Sees Inception movie with poster URL, rating, etc.

**Success Criteria**: ✅ TMDB API responds with movie data

---

### Test 5: Instagram URL Detection Works

**Objective**: Verify Instagram URLs are detected and handled gracefully

**URL**: `https://www.instagram.com/p/C3zP5y0Ml7K/` (replace with actual post)

**Expected Result**:
```
Detected as: Instagram ✓
Enrichment: Falls back to OpenGraph metadata
Shows: Post title and thumbnail if available
```

**Success Criteria**: ✅ Correctly detects as Instagram (not generic), attempts enrichment

---

### Test 6: Facebook URL Detection Works

**Objective**: Verify Facebook URLs are detected

**URL**: `https://www.facebook.com/FacebookDevelopers/posts/...` (or any Facebook post)

**Expected Result**:
```
Detected as: Facebook ✓
Enrichment: Falls back to OpenGraph metadata
```

**Success Criteria**: ✅ Correctly detects as Facebook

---

### Test 7: Twitter/X URL Detection Works

**Objective**: Verify Twitter/X URLs are detected

**URL**: `https://x.com/user/status/1234567890` (or any X post)

**Expected Result**:
```
Detected as: X / Twitter ✓
Enrichment: Falls back to OpenGraph metadata
```

**Success Criteria**: ✅ Correctly detects as X

---

### Test 8: OpenGraph Fallback Works

**Objective**: Verify that when full API isn't available, OpenGraph tags are parsed

**Steps**:
1. Inspect HTML of a URL that has OpenGraph meta tags
2. Paste that URL into the app
3. Check if title, description, and image are extracted

**Example**:
```html
<meta property="og:title" content="My Video Title" />
<meta property="og:description" content="Video description" />
<meta property="og:image" content="thumbnail.jpg" />
```

**Expected Result**: Title and thumbnail are extracted

**Success Criteria**: ✅ OpenGraph metadata is extracted and displayed

---

### Test 9: API Key Validation at Startup

**Objective**: Verify application checks for API keys on boot

**Steps**:
1. Open App.tsx or check console on app load
2. Look for configuration validation messages

**Expected Output** (if keys missing):
```
[Enrichment] TMDB API key not configured
[Enrichment] YouTube API key not configured
```

**Success Criteria**: ✅ Warnings appear in console if keys are missing

---

## Automated Test Scenarios

### Scenario A: Complete YouTube Enrichment Flow

```javascript
// Test in browser console:

async function testYouTubeEnrichment() {
  console.log('🧪 Testing YouTube Enrichment...');
  
  // Test 1: Valid URL
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  console.log('URL:', url);
  
  // Verify provider detection
  const provider = detectProvider(url);
  console.log('Detected Provider:', provider);
  assert(provider === 'youtube', 'Provider should be youtube');
  
  // Verify video ID extraction
  const videoId = extractYouTubeVideoId(url);
  console.log('Video ID:', videoId);
  assert(videoId === 'dQw4w9WgXcQ', 'Video ID should be extracted');
  
  // Test 2: Call enrichment function
  const result = await enrichWithYouTube(videoId);
  console.log('Enrichment Result:', result);
  assert(result !== null, 'Should return enriched data');
  assert(result.title, 'Should have title');
  assert(result.thumbnail_url, 'Should have thumbnail URL');
  
  console.log('✅ YouTube Enrichment Test PASSED');
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion Failed: ${message}`);
}

testYouTubeEnrichment().catch(err => console.error('❌ Test Failed:', err));
```

---

### Scenario B: Instagram URL Detection & Graceful Fallback

```javascript
// Test in browser console:

async function testInstagramEnrichment() {
  console.log('🧪 Testing Instagram Enrichment...');
  
  const url = 'https://www.instagram.com/p/ABC123def456ghi/';
  
  // Test 1: Detection
  const provider = detectProvider(url);
  console.log('Detected Provider:', provider);
  assert(provider === 'instagram', 'Should detect as Instagram');
  
  // Test 2: Should attempt OpenGraph enrichment
  // (This will likely fail or give limited data, but shouldn't throw)
  try {
    const result = await enrichWithInstagram(url);
    console.log('Enrichment Result:', result);
    console.log('✅ Instagram Enrichment Test PASSED (gracefully handled)');
  } catch (err) {
    console.error('❌ Instagram Enrichment Test FAILED:', err);
  }
}

testInstagramEnrichment();
```

---

### Scenario C: Error Handling

```javascript
// Test in browser console:

async function testErrorHandling() {
  console.log('🧪 Testing Error Handling...');
  
  // Test 1: Missing API Key
  const originalKey = import.meta.env.VITE_YOUTUBE_API_KEY;
  delete import.meta.env.VITE_YOUTUBE_API_KEY;
  
  const result1 = await enrichWithYouTube('test-id');
  assert(result1 === null, 'Should return null when API key missing');
  console.log('✅ Missing API key handled correctly');
  
  // Test 2: Invalid Video ID
  import.meta.env.VITE_YOUTUBE_API_KEY = originalKey;
  const result2 = await enrichWithYouTube('invalid-video-id-xyz');
  console.log('Result for invalid ID:', result2);
  console.log('✅ Invalid video ID handled gracefully');
  
  console.log('✅ Error Handling Tests PASSED');
}

testErrorHandling().catch(err => console.error('❌ Test Failed:', err));
```

---

### Scenario D: All Platform Detection

```javascript
// Test in browser console:

function testAllPlatformDetection() {
  console.log('🧪 Testing Platform Detection...');
  
  const testCases = [
    { url: 'https://youtube.com/watch?v=test', expected: 'youtube' },
    { url: 'https://instagram.com/p/test', expected: 'instagram' },
    { url: 'https://facebook.com/test', expected: 'facebook' },
    { url: 'https://x.com/user/status/123', expected: 'x' },
    { url: 'https://tiktok.com/@user/video/123', expected: 'tiktok' },
    { url: 'https://reddit.com/r/movies', expected: 'reddit' },
    { url: 'https://letterboxd.com/film/test', expected: 'letterboxd' },
    { url: 'https://rottentomatoes.com/m/test', expected: 'rottentomatoes' },
    { url: 'https://imdb.com/title/tt0111161', expected: 'imdb' },
    { url: 'https://netflix.com/watch/123', expected: 'netflix' },
    { url: 'https://example.com/video', expected: 'generic' },
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach(({ url, expected }) => {
    const detected = detectProvider(url);
    if (detected === expected) {
      console.log(`✅ ${url} → ${detected}`);
      passed++;
    } else {
      console.error(`❌ ${url} → Expected: ${expected}, Got: ${detected}`);
      failed++;
    }
  });
  
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log('✅ All Platform Detection Tests PASSED');
}

testAllPlatformDetection();
```

---

## Real-World Test Scenarios

### Scenario 1: User Adds YouTube Video

**Steps**:
1. Paste: `https://www.youtube.com/watch?v=G3XbNBmKq-Q` (Naruto opening)
2. Click "Save"
3. Confirm metadata looks correct

**Expected Outcome**:
- Title fetched from YouTube
- Thumbnail displayed
- Duration calculated

---

### Scenario 2: User Adds Instagram Post

**Steps**:
1. Find an Instagram post with good OpenGraph data
2. Paste the URL into the app
3. See if title and thumbnail are extracted

**Expected Outcome**:
- Title extracted from OpenGraph
- Thumbnail extracted if available
- Allows user to confirm/edit before saving

---

### Scenario 3: User Adds Generic URL

**Steps**:
1. Paste a blog post or article
2. Click "Save"

**Expected Outcome**:
- Provider detected as "generic"
- Message shows: "Could not fetch details automatically"
- User can manually enter title and other details

---

### Scenario 4: Network Interruption Recovery

**Steps**:
1. Set DevTools network throttling to "Offline"
2. Try to add a YouTube video
3. Observe retry attempts in console
4. Turn network back online
5. Should eventually succeed

**Expected Outcome**:
- Console shows retry attempts
- Eventually succeeds when network restored

---

## Validation Checklist

- [ ] **YouTube enrichment works** - Fetches title, thumbnail, duration
- [ ] **TMDB enrichment works** - Fetches movie poster, rating, year
- [ ] **Instagram detected** - Shows correct provider icon
- [ ] **Facebook detected** - Shows correct provider icon
- [ ] **Twitter detected** - Shows correct provider icon as "X / Twitter"
- [ ] **TikTok detected** - Shows correct provider icon
- [ ] **Reddit detected** - Works as generic with OpenGraph fallback
- [ ] **Error logging shows details** - Console contains enrichment error info
- [ ] **Retry logic visible** - Network tab shows retries
- [ ] **Timeout handling works** - Should abort after timeout, not hang forever
- [ ] **API key validation works** - Warnings logged if keys missing
- [ ] **Graceful degradation** - Fails gracefully with helpful messages
- [ ] **URL detection accurate** - Detects all 10+ platforms correctly

---

## Known Limitations & Expected Behavior

### Instagram / Facebook / Twitter
- ❌ No full API integration (requires OAuth)
- ✅ Falls back to OpenGraph meta tag extraction
- ✅ Should extract title, thumbnail, description if available
- ⚠️ May be empty if social platform doesn't set OG tags

### TikTok
- ❌ Cannot be reliably scraped (anti-scraping)
- ✅ Falls back to OpenGraph tags
- ⚠️ May not extract metadata due to JavaScript rendering

### Reddit
- ✅ Should extract via OpenGraph tags
- ✅ Requires proper User-Agent header (implemented)

---

## Troubleshooting

### Problem: YouTube enrichment returns null
**Solution**:
1. Check API key is set: `import.meta.env.VITE_YOUTUBE_API_KEY`
2. Verify API key has YouTube Data API v3 enabled
3. Check quota limit not exceeded in Google Cloud Console
4. Check console for specific error message

### Problem: Instagram/Facebook enrichment not working
**Solution**:
1. Check if the URL has OpenGraph meta tags (view page source)
2. Try different post - some posts might not have OG tags
3. Check console for fetch error - might be CORS issue

### Problem: No error messages in console
**Solution**:
1. Ensure dev tools console is open
2. Check filter settings (might be filtering errors)
3. Hard refresh page (Ctrl+Shift+R)
4. Check for browser extensions blocking logs

---

## Performance Expectations

### YouTube Enrichment
- **Typical time**: 500-2000ms
- **Timeout**: 10 seconds
- **Retries**: Up to 3 attempts

### TMDB Enrichment
- **Typical time**: 500-1500ms
- **Timeout**: 10 seconds
- **Retries**: Up to 3 attempts

### OpenGraph Fallback
- **Typical time**: 2000-5000ms (fetches entire HTML)
- **Timeout**: 5 seconds
- **Retries**: No formal retries (called directly)

---

## Next Steps If Tests Pass ✅

1. ✅ Deploy to staging environment
2. ✅ Run load testing (multiple concurrent enrichments)
3. ✅ Test with different API key configurations
4. ✅ Monitor error logs for patterns
5. ✅ Gather user feedback

---

## Next Steps If Tests Fail ❌

1. Check console for specific error messages
2. Verify API keys and configuration
3. Check network connectivity
4. Review implementation in `src/services/enrichment.ts`
5. Check `src/components/QuickAddBar.tsx` for integration issues

---

**Testing Complete** when all items in the Validation Checklist are checked ✓
