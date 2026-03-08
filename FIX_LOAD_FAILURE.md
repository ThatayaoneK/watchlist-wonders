# 🔧 Quick Fix Guide - Website Load Failure

## Problem: Website Won't Load

Your site is stuck on a blank page or loading spinner because **the `.env` file is missing**.

---

## ✅ Solution: 15-Minute Fix

### Step 1: Create the .env File (2 minutes)

**Option A: Copy from example** (Easiest)
```powershell
cd c:\Users\Kekab\wonders\watchlist-wonders
Copy-Item .env.example -Destination .env
```

**Option B: Create manually**
Create a new file `c:\Users\Kekab\wonders\watchlist-wonders\.env` with this content:
```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_ENRICH_URL=
VITE_TMDB_API_KEY=
VITE_YOUTUBE_API_KEY=
VITE_FIREBASE_VAPID_KEY=
```

### Step 2: Fill in Firebase Credentials (5-10 minutes)

Go to [Firebase Console](https://console.firebase.google.com):

1. **Select your project** from the list
2. Click **⚙️ Project Settings** (gear icon, top-left)
3. Find **Your apps** section → Web app (should show `watchmarks` or similar)
4. Click it to reveal credentials
5. Copy these values:

| From Firebase Console | Goes into .env |
|----------------------|-----------------|
| **apiKey** | VITE_FIREBASE_API_KEY |
| **authDomain** | VITE_FIREBASE_AUTH_DOMAIN |
| **projectId** | VITE_FIREBASE_PROJECT_ID |
| **storageBucket** | VITE_FIREBASE_STORAGE_BUCKET |
| **messagingSenderId** | VITE_FIREBASE_MESSAGING_SENDER_ID |
| **appId** | VITE_FIREBASE_APP_ID |
| **measurementId** | VITE_FIREBASE_MEASUREMENT_ID |

**Example .env after filling in:**
```env
VITE_FIREBASE_API_KEY=AIzaSyDu2qB8xYz4kL9mN0pQ1rS2tU3vW4xY5z
VITE_FIREBASE_AUTH_DOMAIN=myproject-123.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=myproject-123
VITE_FIREBASE_STORAGE_BUCKET=myproject-123.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abc123def456ghi789jk
VITE_FIREBASE_MEASUREMENT_ID=G-ABCDEFGH12
VITE_FIREBASE_VAPID_KEY=BPxY...optional_public_key...
VITE_ENRICH_URL=https://us-central1-myproject-123.cloudfunctions.net/enrich
VITE_TMDB_API_KEY=optional_omit_if_not_using
VITE_YOUTUBE_API_KEY=optional_omit_if_not_using
```

### Step 3: Rebuild & Deploy (3 minutes)

```powershell
# Install dependencies (first time only)
cd c:\Users\Kekab\wonders\watchlist-wonders
bun install

# Rebuild the app with new environment variables
bun run build

# Output will go to ./dist/ folder
```

### Step 4: Clear Browser Cache (1 minute)

The service worker may have cached old files. Do this:

1. **Open DevTools** (F12 or Ctrl+Shift+I)
2. **Storage tab** → Click "Clear Site Data"
3. **Application tab** → Service Workers → Unregister all
4. **Hard refresh** (Ctrl+Shift+R)

### Step 5: Test the Site

Visit your site in the browser. You should now see:
- ✅ Login page loads (if not authenticated)
- ✅ Dashboard loads (if authenticated)
- ✅ No blank page or infinite spinner

---

## 🆘 If Still Not Working

### Check if .env file is picked up:

1. Open DevTools Console (F12)
2. Type: `console.log(import.meta.env.VITE_FIREBASE_API_KEY)`
3. You should see your API key (or first 10 chars)
4. If you see `undefined`, the .env file wasn't found

**Solution:** Make sure `.env` file is in the **root directory** (same level as `package.json`), NOT in a subfolder.

### Check if environment variables are correct:

1. Go to Firebase Console → Project Settings
2. Compare all values in your `.env` with the values in Firebase Console
3. **Common mistakes:**
   - Extra spaces in values
   - Copy-pasted quotes or special characters
   - Wrong API key (dev vs production)

### Check if rebuild succeeded:

```powershell
cd c:\Users\Kekab\wonders\watchlist-wonders
ls dist/assets/

# You should see files like:
# - index-xxxxx.js
# - index-xxxxx.css
```

If no files appear, the build failed. Check console for errors.

### Still stuck? Check these files:

```
✅ .env exists?              ls -la .env
✅ It has values?            cat .env
✅ dist/ was rebuilt?        ls -la dist/
✅ Service worker cleared?   DevTools → Application → Service Workers
✅ Browser cache cleared?    DevTools → Storage → Clear Site Data
```

---

## 📋 Checklist for Deployment

Before deploying to production, make sure:

- [ ] `.env` file created and filled with real Firebase credentials
- [ ] `bun run build` completes without errors
- [ ] `dist/` folder contains new files with current timestamp
- [ ] Browser cache and service worker cleared
- [ ] Can log in and see dashboard
- [ ] Firebase Firestore accessible and user data loads
- [ ] No errors in browser console

---

## 📝 Notes

- **Don't commit `.env`** - it contains sensitive keys
- **`.env.example`** is safe to commit (it's a template)
- **Different environments** = different `.env` files
  - Development env: local `.env`
  - Production env: set variables during deployment (Firebase Hosting, Vercel, etc.)

---

## ⏱️ Expected Timeline

| Step | Time | Status |
|------|------|--------|
| Create .env file | 2 min | Go! |
| Get Firebase credentials | 5 min | Need Firebase Console |
| Fill in .env | 3 min | Paste values |
| Rebuild project | 3 min | `bun run build` |
| Clear browser cache | 1 min | Hard refresh |
| Test site | 1 min | Should load! |
| **Total** | **~15 min** | ✅ |

---

**Once you complete these steps, your site will load!** 🚀

Need help? Check the browser console (F12) for specific error messages.
