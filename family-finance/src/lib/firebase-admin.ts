import { readFileSync } from 'fs'
import path from 'path'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Service account 來源（擇一）：
//   1. 開發/MAC MINI：FIREBASE_SERVICE_ACCOUNT_PATH = JSON 檔的路徑（相對 cwd）
//   2. Vercel 部署：FIREBASE_SERVICE_ACCOUNT_KEY = 完整 JSON 字串
// 來源檔取得：Firebase Console → Project settings → Service accounts → Generate new private key
function loadCreds(): Record<string, unknown> {
  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  if (filePath) {
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)
    const raw = readFileSync(abs, 'utf-8')
    return JSON.parse(raw)
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  if (json) {
    return JSON.parse(json)
  }
  throw new Error(
    'Firebase service account 未設定：請設 FIREBASE_SERVICE_ACCOUNT_PATH（檔案路徑）或 FIREBASE_SERVICE_ACCOUNT_KEY（JSON 字串）',
  )
}

let app: App
if (getApps().length === 0) {
  app = initializeApp({
    credential: cert(loadCreds() as Parameters<typeof cert>[0]),
  })
} else {
  app = getApps()[0]
}

export const adminDb = getFirestore(app)
export default app
